-- Allow buyers to delete marketplace items they've purchased
-- This enables deletion when an order is created

-- Drop existing delete policy
DROP POLICY IF EXISTS "Users can delete their own marketplace items" ON public.marketplace_items;

-- Create new policy that allows:
-- 1. Owners to delete their own items
-- 2. Buyers to delete items they've purchased (have a completed order)
CREATE POLICY "Users can delete marketplace items"
ON public.marketplace_items
FOR DELETE
USING (
  -- Owner can delete their own items
  auth.uid() = user_id
  OR
  -- Buyer can delete items they've purchased
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.item_id = marketplace_items.id
    AND orders.buyer_id = auth.uid()
    AND orders.payment_status = 'completed'
  )
);

