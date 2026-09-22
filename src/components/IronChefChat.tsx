import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import ironChefLogo from "@/assets/iron-chef-logo.png";

interface VideoSuggestion {
  id: string;
  title: string;
  channel: string;
  url: string;
  thumbnail: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  videos?: VideoSuggestion[];
}

export const IronChefChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "👨‍🍳 Hey there! I'm Iron Chef, your AI cooking companion! Ask me for any recipe, cooking tips, or culinary advice. What would you like to cook today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message immediately
    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Prepare messages for API (exclude system messages from history)
      const messagesToSend = updatedMessages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      const { data, error } = await supabase.functions.invoke('iron-chef-chat', {
        body: { 
          messages: messagesToSend
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        // Even if there's an error, check if there's a fallback message
        if (data?.choices?.[0]?.message?.content) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: data.choices[0].message.content 
          }]);
        } else {
          throw new Error(error.message || 'Failed to invoke chat function');
        }
        return;
      }

      // Handle response - check multiple possible formats
      let assistantMessage: string | null = null;

      if (data?.choices?.[0]?.message?.content) {
        assistantMessage = data.choices[0].message.content;
      } else if (data?.message?.content) {
        assistantMessage = data.message.content;
      } else if (data?.content) {
        assistantMessage = data.content;
      } else if (typeof data === 'string') {
        assistantMessage = data;
      } else if (data?.error && data?.choices?.[0]?.message?.content) {
        // Even if there's an error, use the fallback message if available
        assistantMessage = data.choices[0].message.content;
        console.warn('Received error but using fallback message:', data.error);
      }

      if (!assistantMessage) {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response from chat service');
      }

      const videoSuggestions: VideoSuggestion[] = Array.isArray(data?.videos)
        ? data.videos
        : Array.isArray(data?.videoSuggestions)
          ? data.videoSuggestions
          : [];

      const assistantResponse: Message = { role: 'assistant', content: assistantMessage };
      if (videoSuggestions.length > 0) {
        assistantResponse.videos = videoSuggestions;
      }

      setMessages(prev => [...prev, assistantResponse]);
    } catch (error: any) {
      console.error('Chat error:', error);
      
      // Try to extract a meaningful error message
      let errorMessage = "Failed to get response from Iron Chef. Please try again.";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Show error toast
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Add an error message to the chat so user knows what happened
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "👨‍🍳 I'm sorry, I encountered an error. Please try again or check your connection. If the problem persists, the AI service may need to be configured." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-[600px] flex flex-col bg-card">
      <CardHeader className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
        <CardTitle className="flex items-center gap-3">
          <img src={ironChefLogo} alt="Iron Chef" className="w-12 h-12 rounded-full bg-white p-1 floating" />
          <div>
            <div className="text-xl">Iron Chef</div>
            <div className="text-sm font-normal opacity-90">AI Recipe Assistant</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 bg-card">
        <ScrollArea className="flex-1 p-4 bg-card" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  {message.videos && message.videos.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        YouTube inspiration
                      </p>
                      <div className="space-y-3">
                        {message.videos.map((video) => (
                          <a
                            key={video.id}
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex gap-3 rounded-lg border bg-background/60 p-2 transition hover:border-primary"
                          >
                            <div className="w-28 h-16 overflow-hidden rounded-md bg-secondary">
                              <img
                                src={video.thumbnail}
                                alt={video.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {video.channel}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary-foreground animate-pulse" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm">Cooking up a response...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <form onSubmit={sendMessage} className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for a recipe or cooking advice..."
              disabled={loading}
            />
            <Button type="submit" disabled={loading} className="hero-button">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
