import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function categorizeItem(itemName: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return 'Other';

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a food categorization assistant. Categorize items into one of these categories ONLY: Fruits, Vegetables, Dairy Products, Meat & Poultry, Grains, Snacks, Beverages, Other. Return ONLY the exact category name, nothing else.'
          },
          {
            role: 'user',
            content: `Categorize this item: ${itemName}`
          }
        ],
      }),
    });

    if (!response.ok) return 'Other';
    
    const data = await response.json();
    const category = data.choices?.[0]?.message?.content?.trim() || 'Other';
    
    // Validate category - exact database enum values
    const validCategories = ['Fruits', 'Vegetables', 'Dairy Products', 'Meat & Poultry', 'Grains', 'Snacks', 'Beverages', 'Other'];
    return validCategories.includes(category) ? category : 'Other';
  } catch (error) {
    console.error('Categorization error:', error);
    return 'Other';
  }
}

function normalizeUnit(unit: string): string {
  const lowerUnit = unit.toLowerCase().trim();
  
  // Map common variations to valid database units: kg, g, L, mL, pieces
  const unitMap: Record<string, string> = {
    'kilogram': 'kg',
    'kilograms': 'kg',
    'kilo': 'kg',
    'kg': 'kg',
    'gram': 'g',
    'grams': 'g',
    'g': 'g',
    'liter': 'L',
    'liters': 'L',
    'litre': 'L',
    'litres': 'L',
    'l': 'L',
    'milliliter': 'mL',
    'milliliters': 'mL',
    'millilitre': 'mL',
    'millilitres': 'mL',
    'ml': 'mL',
    'piece': 'pieces',
    'pieces': 'pieces',
    'pcs': 'pieces',
    'pc': 'pieces',
    'unit': 'pieces',
    'units': 'pieces',
  };
  
  return unitMap[lowerUnit] || 'pieces';
}

interface ParsedItemDetails {
  quantity: number | null;
  unit: string | null;
  name: string;
}

function parseItemDetails(phrase: string): ParsedItemDetails {
  const detailRegex = /(?:(\d+(?:\.\d+)?)\s*(kilograms?|kgs?|kg|grams?|gs?|g|liters?|litres?|ls?|l|milliliters?|millilitres?|mls?|ml|pieces?|pcs?|units?)\s+of\s+)?(.+)/i;
  const match = phrase.match(detailRegex);

  if (!match) {
    return { quantity: null, unit: null, name: phrase.trim() };
  }

  const quantity = match[1] ? parseFloat(match[1]) : null;
  const rawUnit = match[2] ? normalizeUnit(match[2]) : null;
  const name = match[3]?.trim() ?? phrase.trim();

  return { quantity, unit: rawUnit, name };
}

function normalizeLocation(location: string | undefined): 'pantry' | 'cart' | 'market' | null {
  if (!location) return null;
  const loc = location.toLowerCase();
  if (loc.includes('pantry')) return 'pantry';
  if (loc.includes('shopping') || loc.includes('cart') || loc === 'list') return 'cart';
  if (loc.includes('market')) return 'market';
  return null;
}

function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&').substring(0, 100);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { command, expiryDate, pendingItemId } = await req.json();
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Handle expiry date update for pending item
    if (pendingItemId && expiryDate) {
      const { error } = await supabase
        .from('pantry_items')
        .update({ expiry_date: expiryDate })
        .eq('id', pendingItemId)
        .eq('user_id', user.id);

      if (error) throw error;
      return new Response(
        JSON.stringify({ response: `Expiry date set successfully!` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!command || !command.trim()) {
      return new Response(
        JSON.stringify({ response: "I didn't catch any command. Try saying something like 'Add 2 kilograms of rice to pantry'." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lowerCommand = command.toLowerCase();

    // Clear commands
    if (lowerCommand.includes('clear') && (lowerCommand.includes('pantry') || lowerCommand.includes('shopping'))) {
      if (lowerCommand.includes('pantry')) {
        const { error } = await supabase
          .from('pantry_items')
          .delete()
          .eq('user_id', user.id);
        if (error) throw error;
        return new Response(
          JSON.stringify({ response: "Your pantry has been cleared." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (lowerCommand.includes('shopping') || lowerCommand.includes('cart')) {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);
        if (error) throw error;
        return new Response(
          JSON.stringify({ response: "Your shopping list is now empty." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Remove commands
    const removeMatch = command.match(/remove\s+(.+?)\s+from\s+(pantry|shopping\s+list|shopping|cart|market)/i);
    if (removeMatch) {
      const details = parseItemDetails(removeMatch[1]);
      const location = normalizeLocation(removeMatch[2]);

      if (!location) {
        return new Response(
          JSON.stringify({ response: `I couldn't figure out where to remove ${details.name}. Please specify pantry or shopping list.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (location === 'pantry') {
        const itemName = sanitizeSearch(details.name);
        const { data: item } = await supabase
          .from('pantry_items')
          .select('id, name, quantity, unit')
          .eq('user_id', user.id)
          .ilike('name', `%${itemName}%`)
          .limit(1)
          .maybeSingle();

        if (!item) {
          return new Response(
            JSON.stringify({ response: `I couldn't find ${details.name} in your pantry.` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const currentQuantity = Number(item.quantity);
        const quantityToRemove = details.quantity ?? currentQuantity;

        if (details.unit && details.unit !== item.unit) {
          return new Response(
            JSON.stringify({ response: `The units don't match. ${item.name} is tracked in ${item.unit}.` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (quantityToRemove < currentQuantity) {
          const { error } = await supabase
            .from('pantry_items')
            .update({ quantity: currentQuantity - quantityToRemove })
            .eq('id', item.id);
          if (error) throw error;
          return new Response(
            JSON.stringify({ response: `Removed ${quantityToRemove} ${item.unit} of ${item.name} from your pantry. ${currentQuantity - quantityToRemove} ${item.unit} remain.` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('pantry_items')
          .delete()
          .eq('id', item.id);
        if (error) throw error;
        return new Response(
          JSON.stringify({ response: `Removed ${item.name} from your pantry.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (location === 'cart') {
        const itemName = sanitizeSearch(details.name);
        const { data: item } = await supabase
          .from('cart_items')
          .select('id, name, quantity, unit')
          .eq('user_id', user.id)
          .ilike('name', `%${itemName}%`)
          .limit(1)
          .maybeSingle();

        if (!item) {
          return new Response(
            JSON.stringify({ response: `I couldn't find ${details.name} in your shopping list.` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const currentQuantity = Number(item.quantity);
        const quantityToRemove = details.quantity ?? currentQuantity;

        if (details.unit && details.unit !== item.unit) {
          return new Response(
            JSON.stringify({ response: `The units don't match. ${item.name} is tracked in ${item.unit}.` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (quantityToRemove < currentQuantity) {
          const { error } = await supabase
            .from('cart_items')
            .update({ quantity: currentQuantity - quantityToRemove })
            .eq('id', item.id);
          if (error) throw error;
          return new Response(
            JSON.stringify({ response: `Removed ${quantityToRemove} ${item.unit} of ${item.name} from your shopping list.` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', item.id);
        if (error) throw error;
        return new Response(
          JSON.stringify({ response: `Removed ${item.name} from your shopping list.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (location === 'market') {
        const itemName = sanitizeSearch(details.name);
        const { error } = await supabase
          .from('marketplace_items')
          .delete()
          .eq('user_id', user.id)
          .ilike('name', `%${itemName}%`);
        if (error) throw error;
        return new Response(
          JSON.stringify({ response: `Removed ${details.name} from your marketplace listings.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Move commands (primarily between pantry and shopping list)
    const moveMatch = command.match(/move\s+(.+?)\s+from\s+(pantry|shopping\s+list|shopping|cart)\s+to\s+(pantry|shopping\s+list|shopping|cart|market)/i);
    if (moveMatch) {
      const details = parseItemDetails(moveMatch[1]);
      const fromLocation = normalizeLocation(moveMatch[2]);
      const toLocation = normalizeLocation(moveMatch[3]);

      if (!fromLocation || !toLocation) {
        return new Response(
          JSON.stringify({ response: "Please specify where to move the item from and to. For example, 'Move milk from pantry to shopping list'." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (toLocation === 'market') {
        return new Response(
          JSON.stringify({ response: "To sell items in the market, say something like 'Sell 1 kilogram of apples in market for 50'." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (fromLocation === toLocation) {
        return new Response(
          JSON.stringify({ response: "The source and destination are the same. Nothing to move!" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const itemName = sanitizeSearch(details.name);
      const sourceTable = fromLocation === 'pantry' ? 'pantry_items' : 'cart_items';
      const targetTable = toLocation === 'pantry' ? 'pantry_items' : 'cart_items';

      const { data: sourceItem } = await supabase
        .from(sourceTable)
        .select('id, name, quantity, unit')
        .eq('user_id', user.id)
        .ilike('name', `%${itemName}%`)
        .limit(1)
        .maybeSingle();

      if (!sourceItem) {
        return new Response(
          JSON.stringify({ response: `I couldn't find ${details.name} in your ${fromLocation === 'pantry' ? 'pantry' : 'shopping list'}.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const moveQuantity = details.quantity ?? Number(sourceItem.quantity);
      const sourceQuantity = Number(sourceItem.quantity);

      if (details.unit && details.unit !== sourceItem.unit) {
        return new Response(
          JSON.stringify({ response: `The units don't match. ${sourceItem.name} is tracked in ${sourceItem.unit}.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedUnit = sourceItem.unit;
      const normalizedName = sourceItem.name;

      // Upsert into destination
      const { data: existingTarget } = await supabase
        .from(targetTable)
        .select('id, quantity')
        .eq('user_id', user.id)
        .ilike('name', `%${itemName}%`)
        .limit(1)
        .maybeSingle();

      if (existingTarget) {
        const { error } = await supabase
          .from(targetTable)
          .update({ quantity: Number(existingTarget.quantity) + moveQuantity })
          .eq('id', existingTarget.id);
        if (error) throw error;
      } else {
        // Insert new record
        if (toLocation === 'pantry') {
          const category = await categorizeItem(normalizedName);
          const { error } = await supabase
            .from('pantry_items')
            .insert({
              user_id: user.id,
              name: normalizedName,
              quantity: moveQuantity,
              unit: normalizedUnit,
              category,
            });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('cart_items')
            .insert({
              user_id: user.id,
              name: normalizedName,
              quantity: moveQuantity,
              unit: normalizedUnit,
            });
          if (error) throw error;
        }
      }

      // Update or delete from source
      if (moveQuantity < sourceQuantity) {
        const { error } = await supabase
          .from(sourceTable)
          .update({ quantity: sourceQuantity - moveQuantity })
          .eq('id', sourceItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(sourceTable)
          .delete()
          .eq('id', sourceItem.id);
        if (error) throw error;
      }

      const destinationLabel = toLocation === 'pantry' ? 'pantry' : 'shopping list';
      return new Response(
        JSON.stringify({ response: `Moved ${moveQuantity} ${normalizedUnit} of ${normalizedName} to your ${destinationLabel}.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buy commands
    const buyMatch = command.match(/buy\s+(.+?)(?:\s+now|\s+please|\s+from\s+market)?$/i);
    if (buyMatch) {
      const details = parseItemDetails(buyMatch[1]);
      const itemName = sanitizeSearch(details.name);

      const { data: marketplaceItem } = await supabase
        .from('marketplace_items')
        .select('id, user_id, name, sale_price, quantity, unit, pickup_location, pincode')
        .eq('status', 'available')
        .neq('user_id', user.id)
        .ilike('name', `%${itemName}%`)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!marketplaceItem) {
        return new Response(
          JSON.stringify({ response: `I couldn't find ${details.name} in the marketplace right now.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('address, pincode')
        .eq('user_id', user.id)
        .single();

      if (!buyerProfile) {
        return new Response(
          JSON.stringify({ response: "Please complete your profile with address and pincode before purchasing." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('address, pincode')
        .eq('user_id', marketplaceItem.user_id)
        .single();

      if (!sellerProfile) {
        return new Response(
          JSON.stringify({ response: "Seller information is incomplete, so I can't finish the purchase." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const mockPaymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const deliveryPartners = ['Dunzo', 'Swiggy Genie', 'Porter', 'Shadowfax'];
      const deliveryPartner = deliveryPartners[Math.floor(Math.random() * deliveryPartners.length)];
      const trackingId = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: marketplaceItem.user_id,
          item_id: marketplaceItem.id,
          item_name: marketplaceItem.name,
          item_price: marketplaceItem.sale_price,
          payment_id: mockPaymentId,
          payment_status: 'completed',
          delivery_status: 'pending',
          delivery_partner: deliveryPartner,
          tracking_id: trackingId,
          pickup_address: marketplaceItem.pickup_location ?? sellerProfile.address,
          delivery_address: `${buyerProfile.address}, ${buyerProfile.pincode}`,
        });

      if (orderError) throw orderError;

      const { error: deleteError } = await supabase
        .from('marketplace_items')
        .delete()
        .eq('id', marketplaceItem.id);
      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ response: `Purchased ${marketplaceItem.name}! Your order is confirmed with tracking ID ${trackingId}.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sell commands
    const sellMatch = command.match(/sell\s+(.+?)(?:\s+in\s+market)?(?:\s+for\s+(.+))?$/i);
    if (sellMatch) {
      const details = parseItemDetails(sellMatch[1]);
      const priceText = sellMatch[2]?.match(/(\d+(?:\.\d+)?)/);

      if (!priceText) {
        return new Response(
          JSON.stringify({ response: "Please specify a price. For example, 'Sell 1 kilogram of apples in market for 50'." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const salePrice = parseFloat(priceText[1]);
      const quantity = details.quantity ?? 1;
      const unit = details.unit ?? 'pieces';
      const itemName = details.name;

      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('address, pincode')
        .eq('user_id', user.id)
        .single();

      if (!sellerProfile) {
        return new Response(
          JSON.stringify({ response: "Please complete your profile with address and pincode before listing items in the market." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const category = await categorizeItem(itemName);

      const { error } = await supabase
        .from('marketplace_items')
        .insert({
          user_id: user.id,
          name: itemName,
          sale_price: salePrice,
          quantity,
          unit,
          category,
          pickup_location: sellerProfile.address,
          pincode: sellerProfile.pincode,
          status: 'available',
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ response: `Listed ${quantity} ${unit} of ${itemName} in the marketplace for ₹${salePrice}.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add commands
    const addMatch = command.match(/add\s+(.+?)(?:\s+to\s+(shopping\s+list|cart|pantry|list|both|market))?$/i);
    if (addMatch) {
      const details = parseItemDetails(addMatch[1]);
      const rawDestination = addMatch[2]?.toLowerCase();
      const destination = normalizeLocation(rawDestination);
      const defaultUnit = details.unit ?? 'pieces';
      const quantity = details.quantity ?? 1;
      const itemName = details.name;

      let addToPantry = false;
      let addToCart = false;

      if (!rawDestination || rawDestination === 'both') {
        addToPantry = true;
        addToCart = true;
      } else if (destination === 'pantry') {
        addToPantry = true;
      } else if (destination === 'cart') {
        addToCart = true;
      }

      if (destination === 'market') {
        return new Response(
          JSON.stringify({ response: "To sell items, say 'Sell 1 kilogram of apples in market for 50' so I know the price too." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const addedLocations: string[] = [];
      let needsExpiry = false;
      let pantryItemId: string | null = null;

      if (addToPantry) {
        const category = await categorizeItem(itemName);
        const { data: pantryData, error: pantryError } = await supabase
          .from('pantry_items')
          .insert({
            user_id: user.id,
            name: itemName,
            quantity,
            unit: defaultUnit,
            category,
          })
          .select('id')
          .single();

        if (pantryError) throw pantryError;
        needsExpiry = true;
        pantryItemId = pantryData.id;
        addedLocations.push('pantry');
      }

      if (addToCart) {
        const { error: cartError } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            name: itemName,
            quantity,
            unit: defaultUnit,
          });

        if (cartError) throw cartError;
        addedLocations.push('shopping list');
      }

      const baseResponse = `Added ${quantity} ${defaultUnit} of ${itemName} to your ${addedLocations.join(' and ')}.`;

      if (needsExpiry && pantryItemId) {
        return new Response(
          JSON.stringify({
            response: `${baseResponse} When does it expire? For example, say "in 30 days" or "on January 15th 2026".`,
            needsExpiry: true,
            pendingItemId: pantryItemId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ response: baseResponse }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check availability command
    const checkMatch = lowerCommand.match(/do i have (.+?)(?:\?|$)/i);
    if (checkMatch) {
      const itemName = sanitizeSearch(checkMatch[1].trim());
      
      const { data: items } = await supabase
        .from('pantry_items')
        .select('name, quantity, unit')
        .eq('user_id', user.id)
        .ilike('name', `%${itemName}%`);

      if (items && items.length > 0) {
        const item = items[0];
        return new Response(
          JSON.stringify({ response: `Yes, you have ${item.quantity} ${item.unit} of ${item.name}.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ response: `No, you don't have ${checkMatch[1].trim()} in your pantry.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Expiry checks
    if (lowerCommand.includes('expir')) {
      const today = new Date();
      let startDate = today;
      let endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      if (lowerCommand.includes('next week')) {
        startDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
      }

      const { data: items } = await supabase
        .from('pantry_items')
        .select('name, expiry_date')
        .eq('user_id', user.id)
        .not('expiry_date', 'is', null)
        .gte('expiry_date', startDate.toISOString().split('T')[0])
        .lte('expiry_date', endDate.toISOString().split('T')[0]);

      if (items && items.length > 0) {
        return new Response(
          JSON.stringify({ response: `You have ${items.length} item${items.length > 1 ? 's' : ''} expiring in that period: ${items.map(i => i.name).join(', ')}.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ response: "Good news—nothing is expiring during that time window." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List / show commands
    if (lowerCommand.includes('what do i have') || (lowerCommand.includes('list') && lowerCommand.includes('pantry')) || lowerCommand.includes('show me')) {
      const { data: items } = await supabase
        .from('pantry_items')
        .select('name, quantity, unit')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (items && items.length > 0) {
        const summary = items
          .slice(0, 10)
          .map(i => `${i.quantity} ${i.unit} of ${i.name}`)
          .join(', ');
        const suffix = items.length > 10 ? ', and more' : '';
        return new Response(
          JSON.stringify({ response: `You have ${items.length} items in your pantry: ${summary}${suffix}.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ response: "Your pantry is empty right now." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ response: "I didn't understand that command. Try 'Add 2 kilograms of rice to pantry' or 'Do I have eggs?'." }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
