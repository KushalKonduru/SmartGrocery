-- Create expenditures table to track all spending (positive and negative)
CREATE TABLE public.expenditures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category public.item_category NOT NULL,
  amount NUMERIC NOT NULL, -- Positive for purchases, negative for losses/waste
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'resale_loss', 'expired_waste')),
  item_name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  description TEXT,
  marketplace_item_id UUID REFERENCES public.marketplace_items(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  pantry_item_id UUID REFERENCES public.pantry_items(id) ON DELETE SET NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenditures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expenditures
CREATE POLICY "Users can view their own expenditures"
  ON public.expenditures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenditures"
  ON public.expenditures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_expenditures_user_date 
  ON public.expenditures(user_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenditures_category 
  ON public.expenditures(user_id, category, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenditures_type 
  ON public.expenditures(user_id, transaction_type, transaction_date DESC);

-- Function to log purchase expenditure when order is created
CREATE OR REPLACE FUNCTION public.log_purchase_expenditure()
RETURNS TRIGGER AS $$
DECLARE
  item_category_val public.item_category;
BEGIN
  -- Get category from marketplace item (before it might be deleted)
  SELECT category INTO item_category_val
  FROM public.marketplace_items
  WHERE id = NEW.item_id;
  
  -- If category not found in marketplace, default to 'Other'
  IF item_category_val IS NULL THEN
    item_category_val := 'Other';
  END IF;
  
  -- Log positive expenditure for purchase
  -- Note: marketplace_item_id is set to NULL since the item may be deleted after purchase
  -- We have order_id for tracking instead
  INSERT INTO public.expenditures (
    user_id,
    category,
    amount,
    transaction_type,
    item_name,
    quantity,
    unit,
    description,
    order_id,
    marketplace_item_id,
    transaction_date
  )
  VALUES (
    NEW.buyer_id,
    item_category_val,
    NEW.item_price,
    'purchase',
    NEW.item_name,
    NULL,
    NULL,
    'Purchase from marketplace',
    NEW.id,
    NULL, -- Set to NULL to avoid foreign key constraint issues when marketplace item is deleted
    NEW.order_date
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log purchase expenditure on order creation
CREATE TRIGGER trigger_log_purchase_expenditure
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_purchase_expenditure();

-- Function to log resale loss when item is sold at lower price
CREATE OR REPLACE FUNCTION public.log_resale_loss()
RETURNS TRIGGER AS $$
DECLARE
  loss_amount NUMERIC;
BEGIN
  -- Calculate loss only if original_price exists and is greater than sale_price
  IF NEW.original_price IS NOT NULL AND NEW.original_price > NEW.sale_price THEN
    loss_amount := NEW.original_price - NEW.sale_price;
    
    -- Log negative expenditure for resale loss (only when actually sold)
    IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
      INSERT INTO public.expenditures (
        user_id,
        category,
        amount,
        transaction_type,
        item_name,
        quantity,
        unit,
        description,
        marketplace_item_id,
        transaction_date
      )
      VALUES (
        NEW.user_id,
        NEW.category,
        -loss_amount, -- Negative amount for loss
        'resale_loss',
        NEW.name,
        NEW.quantity,
        NEW.unit,
        CONCAT('Resale loss: sold at ₹', NEW.sale_price, ' instead of ₹', NEW.original_price),
        NEW.id,
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log resale loss when marketplace item is marked as sold
CREATE TRIGGER trigger_log_resale_loss
  AFTER UPDATE ON public.marketplace_items
  FOR EACH ROW
  WHEN (NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold'))
  EXECUTE FUNCTION public.log_resale_loss();

-- Function to log resale loss when marketplace item is deleted (sold via purchase)
CREATE OR REPLACE FUNCTION public.log_resale_loss_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  loss_amount NUMERIC;
BEGIN
  -- Calculate loss only if original_price exists and is greater than sale_price
  IF OLD.original_price IS NOT NULL AND OLD.original_price > OLD.sale_price THEN
    loss_amount := OLD.original_price - OLD.sale_price;
    
    -- Log negative expenditure for resale loss when item is deleted (sold)
    -- Note: marketplace_item_id is set to NULL since the item is being deleted
    INSERT INTO public.expenditures (
      user_id,
      category,
      amount,
      transaction_type,
      item_name,
      quantity,
      unit,
      description,
      marketplace_item_id,
      transaction_date
    )
    VALUES (
      OLD.user_id,
      OLD.category,
      -loss_amount, -- Negative amount for loss
      'resale_loss',
      OLD.name,
      OLD.quantity,
      OLD.unit,
      CONCAT('Resale loss: sold at ₹', OLD.sale_price, ' instead of ₹', OLD.original_price),
      NULL, -- Set to NULL since the marketplace item is being deleted
      now()
    );
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log resale loss when marketplace item is deleted (sold)
CREATE TRIGGER trigger_log_resale_loss_on_delete
  AFTER DELETE ON public.marketplace_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_resale_loss_on_delete();

-- Function to log expired waste when item expires
-- This will be called manually or via a scheduled job checking expiry dates
CREATE OR REPLACE FUNCTION public.log_expired_waste(
  p_user_id UUID,
  p_pantry_item_id UUID,
  p_item_name TEXT,
  p_category public.item_category,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_cost NUMERIC DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Log negative expenditure for expired waste
  INSERT INTO public.expenditures (
    user_id,
    category,
    amount,
    transaction_type,
    item_name,
    quantity,
    unit,
    description,
    pantry_item_id,
    transaction_date
  )
  VALUES (
    p_user_id,
    p_category,
    -COALESCE(p_cost, 0), -- Negative amount (use 0 if cost not available)
    'expired_waste',
    p_item_name,
    p_quantity,
    p_unit,
    'Item expired and wasted',
    p_pantry_item_id,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and log expired items (call this periodically or on demand)
CREATE OR REPLACE FUNCTION public.check_and_log_expired_items()
RETURNS void AS $$
DECLARE
  expired_item RECORD;
BEGIN
  -- Find items that expired today or earlier and haven't been logged yet
  FOR expired_item IN
    SELECT 
      pi.id,
      pi.user_id,
      pi.name,
      pi.category,
      pi.quantity,
      pi.unit,
      pi.expiry_date,
      -- Try to get cost from original purchase or estimate
      COALESCE(
        (SELECT AVG(e.amount) 
         FROM public.expenditures e 
         WHERE e.item_name = pi.name 
           AND e.transaction_type = 'purchase'
           AND e.user_id = pi.user_id
         LIMIT 1),
        0
      ) as estimated_cost
    FROM public.pantry_items pi
    WHERE pi.expiry_date IS NOT NULL
      AND pi.expiry_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 
        FROM public.expenditures e 
        WHERE e.pantry_item_id = pi.id 
          AND e.transaction_type = 'expired_waste'
      )
  LOOP
    -- Log the expired item
    PERFORM public.log_expired_waste(
      expired_item.user_id,
      expired_item.id,
      expired_item.name,
      expired_item.category,
      expired_item.quantity,
      expired_item.unit,
      expired_item.estimated_cost
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for easier expenditure analytics
CREATE OR REPLACE VIEW public.expenditure_summary AS
SELECT 
  user_id,
  category,
  DATE_TRUNC('week', transaction_date) as week_start,
  DATE_TRUNC('month', transaction_date) as month_start,
  transaction_type,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_positive,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_negative,
  SUM(amount) as net_amount,
  COUNT(*) as transaction_count
FROM public.expenditures
GROUP BY user_id, category, DATE_TRUNC('week', transaction_date), DATE_TRUNC('month', transaction_date), transaction_type;

