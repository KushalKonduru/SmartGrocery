-- Allow everyone to see sold marketplace items and let buyers mark purchases as sold

-- Replace the existing select policy so sold listings remain visible
DROP POLICY IF EXISTS "Users can view all available marketplace items" ON public.marketplace_items;

CREATE POLICY "Users can view marketplace listings"
ON public.marketplace_items
FOR SELECT
USING (
  status IN ('available', 'sold')
  OR auth.uid() = user_id
);

-- Allow buyers with a completed order to mark the item as sold
CREATE POLICY "Buyers can mark purchased items as sold"
ON public.marketplace_items
FOR UPDATE
USING (
  status = 'available'
  AND EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.item_id = marketplace_items.id
      AND orders.buyer_id = auth.uid()
      AND orders.payment_status = 'completed'
  )
)
WITH CHECK (
  status = 'sold'
);

