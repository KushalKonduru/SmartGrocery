-- Create consumed_items table for real-time consumption tracking
CREATE TABLE IF NOT EXISTS public.consumed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pantry_item_id UUID REFERENCES public.pantry_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category public.item_category NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  cost NUMERIC NULL,
  brand TEXT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consumed_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY IF NOT EXISTS "Users can select their consumed items"
  ON public.consumed_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their consumed items"
  ON public.consumed_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for fast analytics
CREATE INDEX IF NOT EXISTS idx_consumed_items_user_time
  ON public.consumed_items(user_id, consumed_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumed_items_category
  ON public.consumed_items(user_id, category, consumed_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumed_items_name
  ON public.consumed_items(user_id, name, consumed_at DESC);

-- Enable real-time on the table
-- (Supabase Realtime will pick up changes when DB is configured; this is a reminder comment)
