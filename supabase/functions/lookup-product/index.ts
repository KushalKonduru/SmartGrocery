// @ts-ignore - Supabase Edge Functions run in Deno (URL imports are valid there)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();

    if (!barcode) {
      throw new Error('Barcode is required');
    }

    const sanitizedBarcode = String(barcode).trim();

    if (!sanitizedBarcode) {
      return new Response(
        JSON.stringify({
          found: false,
          barcode: '',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    // Try OpenFoodFacts API first
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(sanitizedBarcode)}.json`,
      {
        headers: {
          "User-Agent": "SmartPantry/1.0 (https://example.com)",
        },
      },
    );

    if (!response.ok) {
      console.warn(`OpenFoodFacts request failed: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({
          found: false,
          barcode: sanitizedBarcode,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    const data = await response.json();

    const product = data.product ?? null;
    const statusVerbose: string = data.status_verbose ?? "";
    const productFound = Boolean(
      product &&
        (data.status === 1 || statusVerbose.toLowerCase().includes("found")),
    );

    if (productFound) {
      const normalizedBarcode = product.code ?? sanitizedBarcode;
      const name =
        product.product_name ||
        product.product_name_en ||
        product.generic_name ||
        "Unknown Product";
      const brand =
        product.brands ||
        product.brands_tags?.join(", ") ||
        product.brand_owner ||
        "";
      const category =
        product.categories_tags?.[0]?.replace("en:", "") ||
        product.categories?.split(",")?.[0] ||
        product.labels_tags?.[0]?.replace("en:", "") ||
        "Other";
      const image =
        product.image_url ||
        product.image_front_url ||
        product.image_front_small_url ||
        null;
      const quantityString = product.quantity || product.serving_quantity || "";
      const quantityValue = quantityString
        ? parseFloat(quantityString)
        : null;
      const unitMatch = quantityString.match(/[a-zA-Z]+/g);
      const quantityUnit = product.quantity_unit || unitMatch?.[0] || null;

      return new Response(
        JSON.stringify({
          found: true,
          name,
          brand,
          category,
          quantity: Number.isFinite(quantityValue) ? quantityValue : null,
          unit: quantityUnit,
          image_url: image,
          barcode: normalizedBarcode || sanitizedBarcode,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    return new Response(
      JSON.stringify({
        found: false,
        barcode: sanitizedBarcode,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        found: false,
        barcode: null,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
});
