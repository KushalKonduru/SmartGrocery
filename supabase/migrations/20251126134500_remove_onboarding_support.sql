-- Roll back onboarding-specific schema changes

-- Drop the trigger and helper function that auto-created profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_profile();

-- Remove the onboarding completion flag
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS onboarding_completed;

