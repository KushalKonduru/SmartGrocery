import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../../src/integrations/supabase/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY")!;

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  category: Database["public"]["Enums"]["item_category"];
}

const CATEGORY_KEYWORDS: Record<
  Database["public"]["Enums"]["item_category"],
  string[]
> = {
  "Dairy Products": ["milk", "curd", "cheese", "butter", "paneer", "ghee", "yogurt"],
  Vegetables: ["tomato", "onion", "potato", "carrot", "spinach", "cabbage"],
  Fruits: ["apple", "banana", "mango", "orange", "grape", "watermelon"],
  Grains: ["rice", "wheat", "atta", "flour", "dal", "lentil"],
  "Meat & Poultry": ["chicken", "mutton", "egg", "fish"],
  Beverages: ["tea", "coffee", "juice", "soda", "cola"],
  Snacks: ["chips", "biscuit", "cookie", "namkeen", "chocolate"],
  Other: [],
};

function detectCategory(name: string): Database["public"]["Enums"]["item_category"] {
  const lower = name.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return cat as any;
  }
  return "Other";
}

function parseLine(line: string): ParsedItem | null {
  const clean = line.trim();
  if (!clean) return null;

  const priceMatch = clean.match(/(\d+(\.\d{1,2})?)\s*$/);
  if (!priceMatch) return null;

  const price = parseFloat(priceMatch[1]);
  const beforePrice = clean.slice(0, priceMatch.index).trim();

  const parts = beforePrice.split(/\s+/);
  if (parts.length === 0) return null;

  let quantity: number | null = null;
  let unit: string | null = null;
  const nameParts: string[] = [];

  for (const p of parts) {
    if (/^\d+(\.\d+)?$/.test(p) && quantity === null) {
      quantity = parseFloat(p);
    } else if (quantity !== null && !unit) {
      unit = p;
    } else {
      nameParts.push(p);
    }
  }

  const name = nameParts.join(" ") || beforePrice;
  const category = detectCategory(name);

  return {
    name,
    quantity,
    unit,
    price,
    category,
  };

}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const imageUrl: string | undefined = body.imageUrl;

    if (!imageUrl) {
      return new Response("imageUrl is required", { status: 400, headers: corsHeaders });
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      },
    );

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error("Vision error", errText);
      return new Response("OCR failed", { status: 500, headers: corsHeaders });
    }

    const visionJson = await visionRes.json();
    const text: string | undefined =
      visionJson?.responses?.[0]?.fullTextAnnotation?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ items: [], rawText: "", message: "No text detected" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const lines = text.split(/\r?\n/);
    const items: ParsedItem[] = [];

    for (const line of lines) {
      const item = parseLine(line);
      if (item && item.name && item.price !== null) {
        items.push(item);
      }
    }

    return new Response(
      JSON.stringify({ items, rawText: text }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e) {
    console.error(e);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
