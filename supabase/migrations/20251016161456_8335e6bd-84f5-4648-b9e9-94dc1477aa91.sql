-- Create marketplace_items table for selling expiring items
CREATE TABLE public.marketplace_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pantry_item_id UUID REFERENCES public.pantry_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_price NUMERIC,
  sale_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  expiry_date DATE,
  image_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own marketplace items"
ON public.marketplace_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all available marketplace items"
ON public.marketplace_items
FOR SELECT
USING (status = 'available' OR auth.uid() = user_id);

CREATE POLICY "Users can update their own marketplace items"
ON public.marketplace_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own marketplace items"
ON public.marketplace_items
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_marketplace_items_updated_at
BEFORE UPDATE ON public.marketplace_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();