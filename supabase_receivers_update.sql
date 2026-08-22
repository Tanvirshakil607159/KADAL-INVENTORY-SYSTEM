-- Run this script in your Supabase SQL Editor to add the 'address' column to the 'recipients' table

ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS receiver_address text;

-- Also ensure challans table has the receiver address and contact columns just in case
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS receiver_address text;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS receiver_contact text;

-- Reload the PostgREST schema cache so the API recognizes the new columns
NOTIFY pgrst, 'reload schema';
