-- ============================================
-- Add Missing Columns to Existing Tables
-- Safe to run multiple times
-- ============================================

-- Add missing columns to bookings table
DO $$ 
BEGIN
    -- Add expires_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='bookings' AND column_name='expires_at') THEN
        ALTER TABLE public.bookings ADD COLUMN expires_at timestamp with time zone;
        RAISE NOTICE 'Added expires_at to bookings';
    ELSE
        RAISE NOTICE 'expires_at already exists in bookings';
    END IF;
END $$;

-- Add missing columns to clients table
DO $$ 
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='clients' AND column_name='email') THEN
        ALTER TABLE public.clients ADD COLUMN email text;
        RAISE NOTICE 'Added email to clients';
    END IF;

    -- Add role column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='clients' AND column_name='role') THEN
        ALTER TABLE public.clients ADD COLUMN role text DEFAULT 'user';
        RAISE NOTICE 'Added role to clients';
    END IF;

    -- Add password_hash column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='clients' AND column_name='password_hash') THEN
        ALTER TABLE public.clients ADD COLUMN password_hash text;
        RAISE NOTICE 'Added password_hash to clients';
    END IF;
END $$;

-- Add missing columns to rentals table
DO $$ 
BEGIN
    -- Add ended_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='rentals' AND column_name='ended_at') THEN
        ALTER TABLE public.rentals ADD COLUMN ended_at timestamp with time zone;
        RAISE NOTICE 'Added ended_at to rentals';
    END IF;

    -- Add contract_signed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='rentals' AND column_name='contract_signed') THEN
        ALTER TABLE public.rentals ADD COLUMN contract_signed boolean DEFAULT false;
        RAISE NOTICE 'Added contract_signed to rentals';
    END IF;

    -- Add contract_signature column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='rentals' AND column_name='contract_signature') THEN
        ALTER TABLE public.rentals ADD COLUMN contract_signature text;
        RAISE NOTICE 'Added contract_signature to rentals';
    END IF;
END $$;

-- Add missing columns to bikes table
DO $$ 
BEGIN
    -- Add last_service_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='bikes' AND column_name='last_service_date') THEN
        ALTER TABLE public.bikes ADD COLUMN last_service_date timestamp with time zone;
        RAISE NOTICE 'Added last_service_date to bikes';
    END IF;
END $$;

-- Verify all columns were added
SELECT 
    'bookings' as table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'bookings'
AND column_name IN ('expires_at', 'status', 'cost_rub')
UNION ALL
SELECT 
    'clients' as table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'clients'
AND column_name IN ('email', 'role', 'password_hash')
UNION ALL
SELECT 
    'rentals' as table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'rentals'
AND column_name IN ('ended_at', 'contract_signed', 'contract_signature')
UNION ALL
SELECT 
    'bikes' as table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'bikes'
AND column_name IN ('last_service_date')
ORDER BY table_name, column_name;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Missing columns added successfully! Schema cache refreshed.' as status;
