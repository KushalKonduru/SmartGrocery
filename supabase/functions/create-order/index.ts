import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { itemId } = await req.json();

    // Validate input
    if (!itemId || typeof itemId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid item ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify buyer profile exists and is complete
    const { data: buyerProfile, error: buyerProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (buyerProfileError || !buyerProfile) {
      console.error('Buyer profile not found:', buyerProfileError);
      return new Response(
        JSON.stringify({ error: 'Please complete your profile before making purchases' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!buyerProfile.full_name || !buyerProfile.phone || !buyerProfile.address || !buyerProfile.pincode) {
      return new Response(
        JSON.stringify({ error: 'Please complete all profile fields before making purchases' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the marketplace item with availability check
    const { data: item, error: itemError } = await supabase
      .from('marketplace_items')
      .select('*')
      .eq('id', itemId)
      .eq('status', 'available')
      .single();

    if (itemError || !item) {
      console.error('Item not found or unavailable:', itemError);
      return new Response(
        JSON.stringify({ error: 'Item not available for purchase' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-purchase
    if (item.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot buy your own items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get seller profile for pickup location
    const { data: sellerProfile, error: sellerProfileError } = await supabase
      .from('profiles')
      .select('address, pincode')
      .eq('user_id', item.user_id)
      .single();

    if (sellerProfileError || !sellerProfile) {
      console.error('Seller profile not found:', sellerProfileError);
      return new Response(
        JSON.stringify({ error: 'Seller information not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mock payment processing (SERVER-SIDE)
    // TODO: Replace with real payment gateway (Stripe/Razorpay) before production
    console.log('Processing mock payment for user:', user.id, 'item:', itemId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const mockPaymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Mock delivery partner assignment
    const deliveryPartners = ['Dunzo', 'Swiggy Genie', 'Porter', 'Shadowfax'];
    const deliveryPartner = deliveryPartners[Math.floor(Math.random() * deliveryPartners.length)];
    const trackingId = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create order in a transaction-like manner
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: item.user_id,
        item_id: item.id,
        item_name: item.name,
        item_price: item.sale_price,
        payment_id: mockPaymentId,
        payment_status: 'completed',
        delivery_status: 'pending',
        delivery_partner: deliveryPartner,
        tracking_id: trackingId,
        pickup_address: `${sellerProfile.address}, ${sellerProfile.pincode}`,
        delivery_address: `${buyerProfile.address}, ${buyerProfile.pincode}`,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation failed:', orderError);
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete marketplace item after purchase
    const { error: deleteError } = await supabase
      .from('marketplace_items')
      .delete()
      .eq('id', item.id);

    if (deleteError) {
      console.error('Failed to delete marketplace item:', deleteError);
      // Note: In a real system, we'd rollback the order here
      return new Response(
        JSON.stringify({ error: 'Failed to finalize purchase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order created successfully:', order.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        order: {
          id: order.id,
          trackingId: order.tracking_id,
          deliveryPartner: order.delivery_partner,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-order function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
