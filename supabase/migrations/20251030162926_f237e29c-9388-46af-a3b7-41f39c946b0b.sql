-- Create category enum type
CREATE TYPE public.item_category AS ENUM (
  'Dairy Products',
  'Vegetables',
  'Fruits',
  'Grains',
  'Meat & Poultry',
  'Beverages',
  'Snacks',
  'Other'
);

-- Add category column to pantry_items
ALTER TABLE public.pantry_items 
ADD COLUMN category public.item_category NOT NULL DEFAULT 'Other';

-- Add category column to marketplace_items
ALTER TABLE public.marketplace_items 
ADD COLUMN category public.item_category NOT NULL DEFAULT 'Other';

-- Create donations table
CREATE TABLE public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pantry_item_id UUID,
  name TEXT NOT NULL,
  category public.item_category NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  charity_name TEXT,
  pickup_date DATE,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on donations
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- RLS policies for donations
CREATE POLICY "Users can view their own donations"
ON public.donations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own donations"
ON public.donations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own donations"
ON public.donations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own donations"
ON public.donations
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for donations updated_at
CREATE TRIGGER update_donations_updated_at
BEFORE UPDATE ON public.donations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();