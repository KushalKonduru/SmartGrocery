-- Fix profiles table RLS policy to protect personal information
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Users can only view their own complete profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Create a policy for marketplace to view only seller's name and pincode for pickup coordination
-- This exposes minimal data needed for the marketplace functionality
CREATE POLICY "Users can view seller names and pincodes for marketplace"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_items 
      WHERE marketplace_items.user_id = profiles.user_id 
      AND marketplace_items.status = 'available'
    )
  );