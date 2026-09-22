import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface PantryItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expiry_date?: string;
}

interface ChatRequest {
  messages: Message[];
  pantryItems?: PantryItem[];
  expiringItems?: PantryItem[];
  ignoreIngredients?: string[];
  isSuggestion?: boolean;
}

interface ChatResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  error?: string;
  videos?: VideoSuggestion[];
  dishes?: string[];
}

interface VideoSuggestion {
  id: string;
  title: string;
  channel: string;
  url: string;
  thumbnail: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchYouTubeVideos(query: string, apiKey: string): Promise<VideoSuggestion[]> {
  if (!query || !apiKey) {
    return [];
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("maxResults", "3");
    url.searchParams.set("q", query);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorText = await response.text();
      console.error("YouTube API error:", errorText);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data.items)) {
      return [];
    }

    return data.items
      .filter((item: any) => item.id?.videoId)
      .map((item: any) => {
        const videoId = item.id.videoId;
        const thumbnails = item.snippet?.thumbnails || {};
        const thumbnail =
          thumbnails.high?.url ||
          thumbnails.medium?.url ||
          thumbnails.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
          id: videoId,
          title: item.snippet?.title || "Recipe video",
          channel: item.snippet?.channelTitle || "YouTube Creator",
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail,
        } as VideoSuggestion;
      });
  } catch (error) {
    console.error("Failed to fetch YouTube videos:", error);
    return [];
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { 
      messages, 
      pantryItems = [], 
      expiringItems = [], 
      ignoreIngredients = ['salt', 'water', 'pepper', 'black pepper', 'oil', 'vegetable oil', 'cooking oil'],
      isSuggestion = false
    } = requestBody as ChatRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required and must not be empty' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return new Response(
          JSON.stringify({ error: 'Each message must have role and content fields' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Get Google Gemini API key
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || '';

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_KEY_HERE') {
      // Fallback: return a helpful error message
      return new Response(
        JSON.stringify({ 
          error: 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your Supabase secrets.',
          choices: [{
            message: {
              role: 'assistant',
              content: "👨‍🍳 I'm sorry, but I'm currently unable to connect to my cooking knowledge base. Please contact the administrator to configure the Gemini API key. In the meantime, I can tell you that a great way to start cooking is to keep it simple - try making scrambled eggs or a simple pasta dish!"
            }
          }],
          videos: []
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build pantry context with detailed information - format for easy AI parsing
    const pantryItemNames = pantryItems.length > 0 
      ? pantryItems.map(item => item.name.toLowerCase()).join(', ')
      : '';
    
    const pantryItemDetails = pantryItems.length > 0 
      ? pantryItems.map(item => `- ${item.quantity} ${item.unit} ${item.name}`).join('\n')
      : 'No items in pantry';
    
    const expiringItemNames = expiringItems.length > 0
      ? expiringItems.map(item => item.name.toLowerCase()).join(', ')
      : '';
    
    const expiringItemDetails = expiringItems.length > 0
      ? expiringItems.map(item => `- ${item.name} (expires ${item.expiry_date})`).join('\n')
      : 'No items expiring soon';

    console.log('Pantry items received:', pantryItems.length, pantryItemNames);
    console.log('Expiring items received:', expiringItems.length, expiringItemNames);
    console.log('Is suggestion mode:', isSuggestion);

    const latestUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';
    const isRecipeRequest = latestUserMessage.toLowerCase().includes('recipe') || 
                           latestUserMessage.toLowerCase().includes('how to make') ||
                           latestUserMessage.toLowerCase().includes('how do i make');

    // Determine which items to use based on the request
    const useExpiringItems = latestUserMessage.toLowerCase().includes('expiring');
    const itemsToUse = useExpiringItems && expiringItems.length > 0 
      ? expiringItems 
      : pantryItems;

    let systemPrompt = `You are Iron Chef, a friendly AI cooking assistant. You have DIRECT ACCESS to the user's pantry inventory.

═══════════════════════════════════════════════════════════════
USER'S CURRENT PANTRY INVENTORY (USE THESE ITEMS):
═══════════════════════════════════════════════════════════════
${pantryItemDetails}

═══════════════════════════════════════════════════════════════
ITEMS EXPIRING SOON (within 7 days):
═══════════════════════════════════════════════════════════════
${expiringItemDetails}

═══════════════════════════════════════════════════════════════
COMMON INGREDIENTS (assume user always has these):
${ignoreIngredients.join(', ')}
═══════════════════════════════════════════════════════════════

CRITICAL INSTRUCTIONS:
- You have the EXACT list of items in the user's pantry above
- DO NOT ask the user what they have - you already know
- DO NOT request ingredient lists - use the inventory provided
- When suggesting recipes, use ONLY items from the pantry list above

IMPORTANT RULES:

1. RECIPE SUGGESTIONS (when user asks "suggest recipes based on pantry/expiring items"):
   - Look at the pantry inventory above
   - Create 5-8 dish suggestions using ONLY those items
   - Format your response as a simple numbered list:
     1. Dish Name
     2. Dish Name
     3. Dish Name
     (etc.)
   - Do NOT write full recipes - just dish names
   - Do NOT ask what items they have - use the inventory list above
   - If pantry is empty, respond: "Your pantry is empty. Please add some items first!"
   - If user asks about expiring items, prioritize dishes using: ${expiringItemNames || 'none'}

2. When user requests a specific recipe (e.g., "recipe for chocolate cake"):
   - FIRST: Check the pantry list above to see which ingredients are available
   - If an ingredient is missing but has a common substitute:
     * Eggs → automatically suggest eggless version
     * Butter → suggest using oil or margarine
     * Milk → suggest plant-based alternatives if available
     * Mention the substitution clearly: "I noticed you don't have eggs, so here's an eggless version..."
   - If critical ingredients are missing and CANNOT be substituted (e.g., flour, sugar for cake):
     * Respond EXACTLY: "Oh no, you've run out of [list missing ingredients]. Would you like me to order it on Blinkit or the marketplace?"
     * Then provide these three options on separate lines:
       - "Check Marketplace" (links to /marketplace)
       - "Order on Blinkit" (links to https://blinkit.com/s/?q=[ingredients])
       - "Order on Swiggy" (links to https://www.swiggy.com/search?query=[ingredients])
     * DO NOT provide the recipe if critical ingredients are missing
   - If all ingredients are available (or can be substituted), provide the full recipe with:
     * List of ingredients with quantities
     * Step-by-step instructions
     * Cooking tips or variations when relevant

3. Always format recipes clearly with proper sections for Ingredients and Instructions.`;

    // For suggestion mode, add very specific instruction with pantry items emphasized
    if (isSuggestion) {
      const targetItems = useExpiringItems && expiringItems.length > 0
        ? expiringItemNames
        : pantryItemNames;
      
      systemPrompt += `\n\n═══════════════════════════════════════════════════════════════
CURRENT USER REQUEST: Suggest recipes
═══════════════════════════════════════════════════════════════
User wants recipe suggestions using these items: ${targetItems || 'none'}

YOUR TASK:
1. Look at the pantry inventory listed above
2. Create 5-8 dish names that can be made with those items
3. Return ONLY a numbered list like this:
   1. Dish Name
   2. Dish Name
   3. Dish Name
   (continue for 5-8 dishes)

DO NOT:
- Ask what items they have (you already have the list)
- Provide full recipes (just dish names)
- Include ingredients or instructions
- Ask for more information

START YOUR RESPONSE WITH THE NUMBERED LIST IMMEDIATELY.`;
    }

    // Convert messages to Gemini format
    // Gemini uses a different format: contents array with parts containing text
    // Gemini requires alternating user/model messages
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // Filter out system messages and the initial greeting
    const conversationMessages = messages.filter(
      msg => msg.role !== 'system' && 
      !(msg.role === 'assistant' && msg.content.includes("Hey there! I'm Iron Chef"))
    );

    // Always include system prompt at the start for suggestion mode
    // For regular messages, include it in the first message or as context
    if (isSuggestion || (conversationMessages.length === 1 && conversationMessages[0].role === 'user')) {
      // For suggestions or first message, combine system prompt with user message
      const userMessage = conversationMessages[0]?.content || '';
      
      // For suggestions, include pantry items directly in the message
      let enhancedMessage = systemPrompt;
      if (isSuggestion) {
        const targetItems = useExpiringItems && expiringItems.length > 0
          ? `\n\nUse these expiring items: ${expiringItemNames}`
          : `\n\nUse these pantry items: ${pantryItemNames}`;
        enhancedMessage += `${targetItems}\n\nUser request: "${userMessage}"\n\nNow provide the numbered list of dish names.`;
      } else {
        enhancedMessage += `\n\nUser request: ${userMessage}`;
      }
      
      contents.push({
        role: 'user',
        parts: [{ text: enhancedMessage }]
      });
    } else {
      // For ongoing conversations, add system context at the start
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I am Iron Chef, your friendly AI cooking assistant. I have access to your pantry data. How can I help you with cooking today?' }]
      });

      // Add conversation history, converting roles
      for (const msg of conversationMessages) {
        const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role: geminiRole,
          parts: [{ text: msg.content }]
        });
      }
    }

    // Gemini API endpoint
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // Make API request to Gemini
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
        }
      }),
    });

    if (!response.ok) {
      let errorText: string;
      try {
        const errorData = await response.json();
        errorText = JSON.stringify(errorData);
      } catch {
        errorText = await response.text();
      }
      
      console.error(`AI API error (${response.status}):`, errorText);
      
      // Return a user-friendly error response
      return new Response(
        JSON.stringify({
          error: `AI service error: ${response.status}`,
          choices: [{
            message: {
              role: 'assistant',
              content: "👨‍🍳 I'm having trouble connecting to my cooking knowledge base right now. Please try again in a moment, or check with the administrator if the problem persists."
            }
          }],
          videos: []
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    // Handle Gemini API response format
    let assistantContent: string;
    let videoSuggestions: VideoSuggestion[] = [];
    
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      // Standard Gemini response format
      assistantContent = data.candidates[0].content.parts[0].text;
    } else if (data.error) {
      // Gemini API error
      console.error('Gemini API error:', data.error);
      throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
    } else {
      console.error('Unexpected Gemini API response format:', JSON.stringify(data));
      throw new Error('Invalid response format from Gemini API');
    }

    const latestUserQuery =
      [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';

    // Extract dish names if in suggestion mode
    let dishes: string[] | undefined;
    if (isSuggestion) {
      // Parse dish names from response (handle various formats)
      const lines = assistantContent
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => {
          const lower = line.toLowerCase();
          // Skip lines that are headers or instructions
          return line.length > 0 && 
                 !lower.match(/^(here|dishes?|recipes?|you can|suggestions?|based on|with your|i can|let me)/i) &&
                 line.length < 100; // Reasonable dish name length
        });
      
      dishes = lines
        .map(line => {
          // Remove numbering/bullets (1., 2., -, •, *, etc.) and any leading/trailing punctuation
          let cleaned = line.replace(/^[\d\.\-\•\*\)]\s*/, '').trim();
          // Remove trailing punctuation that might be part of formatting
          cleaned = cleaned.replace(/[\.\:;]$/, '').trim();
          return cleaned;
        })
        .filter(dish => dish.length > 2 && dish.length < 80) // Valid dish name length
        .slice(0, 10); // Limit to 10 dishes
      
      // If we couldn't parse dishes, try a different approach - look for common patterns
      if (dishes.length === 0) {
        // Try to find dish names in the text (look for capitalized words or common dish patterns)
        const dishPattern = /(?:^|\n)[\d\.\-\•\*\)]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
        const matches = [...assistantContent.matchAll(dishPattern)];
        dishes = matches
          .map(match => match[1]?.trim())
          .filter(dish => dish && dish.length > 2 && dish.length < 80)
          .slice(0, 10);
      }
    }

    // Only fetch YouTube videos for full recipe requests, not suggestions
    if (YOUTUBE_API_KEY && latestUserQuery && !isSuggestion) {
      videoSuggestions = await fetchYouTubeVideos(latestUserQuery, YOUTUBE_API_KEY);
    }

    // Ensure we return the expected format
    const formattedResponse: ChatResponse = {
      choices: [{
        message: {
          role: 'assistant',
          content: assistantContent
        }
      }],
      videos: videoSuggestions
    };

    if (dishes && dishes.length > 0) {
      formattedResponse.dishes = dishes;
    }
    
    return new Response(JSON.stringify(formattedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in iron-chef-chat:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        choices: [{
          message: {
            role: 'assistant',
            content: "👨‍🍳 I encountered an unexpected error. Please try again, and if the problem persists, contact support."
          }
        }],
        videos: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
