import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ✅ Type fixes
interface SupabaseFunctionResponse {
  response: string;
  needsExpiry?: boolean;
  pendingItemId?: string;
}

export const VoiceAssistant = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState(
    "Click the microphone to start. Try: 'Add 2 kilograms of rice to pantry' or 'Do I have eggs?'"
  );
  const [voiceRate, setVoiceRate] = useState(1);
  const [voicePitch, setVoicePitch] = useState(1);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [awaitingExpiry, setAwaitingExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);

      if (event.results[current].isFinal) {
        processCommand(transcriptText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);

      if (event.error === "no-speech") {
        speak("I didn't hear anything. Please try again.");
      } else {
        toast({
          title: "Error",
          description: `Speech recognition error: ${event.error}`,
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const processCommand = async (command: string) => {
    try {
      if (command.toLowerCase().includes("stop listening")) {
        recognitionRef.current?.stop();
        setIsListening(false);
        speak("Stopping voice assistant.");
        return;
      }

      setResponse("Processing your command...");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = sessionData?.session;
      if (!session) throw new Error("Please sign in to use voice commands");

      const { data, error } = await supabase.functions.invoke<SupabaseFunctionResponse>(
        "voice-command",
        {
          body: { command },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;
      if (!data) throw new Error("No response from server");

      const responseText = data.response;
      setResponse(responseText);
      speak(responseText);

      if (data.needsExpiry && data.pendingItemId) {
        setAwaitingExpiry(true);
        setPendingItemId(data.pendingItemId);
      }
    } catch (error: any) {
      const errorMsg = error.message || "Failed to process command";
      setResponse(errorMsg);
      speak(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleExpirySubmit = async () => {
    if (!expiryDate || !pendingItemId) return;

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = sessionData?.session;
      if (!session) throw new Error("Please sign in to use voice commands");

      const { data, error } = await supabase.functions.invoke<SupabaseFunctionResponse>(
        "voice-command",
        {
          body: {
            command: "",
            pendingItemId,
            expiryDate,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;
      if (!data) throw new Error("No response from server");

      setResponse(data.response);
      speak(data.response);
      setAwaitingExpiry(false);
      setPendingItemId(null);
      setExpiryDate("");

      toast({
        title: "Success",
        description: "Expiry date set successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to set expiry date",
        variant: "destructive",
      });
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = voiceRate;
      utterance.pitch = voicePitch;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
        <CardTitle className="flex items-center gap-3">
          <Volume2 className="w-6 h-6" />
          <div>
            <div className="text-xl">Voice Assistant</div>
            <div className="text-sm font-normal opacity-90">
              Speak to manage your pantry
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {/* Microphone Button */}
        <div className="flex justify-center">
          <Button
            onClick={toggleListening}
            size="lg"
            className={`w-24 h-24 rounded-full ${
              isListening
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {isListening ? (
              <MicOff className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </Button>
        </div>

        {/* Transcript Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">You said:</h3>
          <div className="min-h-[60px] p-4 bg-muted rounded-lg">
            <p className="text-sm">
              {transcript || (isListening ? "Listening..." : "Click the microphone to start")}
            </p>
          </div>
        </div>

        {/* Response Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Assistant:</h3>
          <div className="min-h-[80px] p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm">{response}</p>
          </div>
        </div>

        {/* Expiry Date Input */}
        {awaitingExpiry && (
          <div className="space-y-3 p-4 bg-accent/10 rounded-lg border border-accent">
            <div className="flex items-center gap-2 text-accent">
              <Calendar className="w-5 h-5" />
              <h3 className="font-semibold">Set Expiry Date</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry-date">Enter the expiry date for this item:</Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <Button onClick={handleExpirySubmit} disabled={!expiryDate} className="w-full">
              Set Expiry Date
            </Button>
          </div>
        )}

        {/* Voice Settings */}
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Voice Speed: {voiceRate.toFixed(1)}x
            </label>
            <Slider
              value={[voiceRate]}
              onValueChange={(value) => setVoiceRate(value[0])}
              min={0.5}
              max={2}
              step={0.1}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Voice Pitch: {voicePitch.toFixed(1)}
            </label>
            <Slider
              value={[voicePitch]}
              onValueChange={(value) => setVoicePitch(value[0])}
              min={0.5}
              max={2}
              step={0.1}
            />
          </div>
        </div>

        {/* Example Commands */}
        <div className="space-y-2 pt-4 border-t">
          <h3 className="text-sm font-semibold text-muted-foreground">Example Commands:</h3>
          <ul className="text-xs space-y-1 text-muted-foreground">
            <li>• "Add 2 kilograms of rice to pantry"</li>
            <li>• "Add 1 litre of milk to shopping list"</li>
            <li>• "Add 500 grams of chicken to both"</li>
            <li>• "Do I have eggs?"</li>
            <li>• "What's expiring this week?"</li>
            <li>• "What do I have in my pantry?"</li>
            <li>• "Stop listening"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
