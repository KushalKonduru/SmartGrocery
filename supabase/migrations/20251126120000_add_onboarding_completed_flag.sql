-- Add onboarding completion flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark existing users as completed so they are not re-onboarded
UPDATE public.profiles
SET onboarding_completed = true
WHERE onboarding_completed IS NOT TRUE;

