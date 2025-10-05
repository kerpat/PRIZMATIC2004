-- ============================================
-- PRIZMATIC Database Migration Script
-- Adds missing columns and functions
-- ============================================

-- Enable PostGIS extension if not already enabled (for location fields)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 0. CREATE MISSING TABLES
-- ============================================

-- Create app_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text NOT NULL,
    value jsonb,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);

-- Create batteries table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.batteries (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    serial_number text NOT NULL UNIQUE,
    capacity_wh integer,
    description text,
    status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'in_use'::text, 'charging'::text, 'maintenance'::text])),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT batteries_pkey PRIMARY KEY (id)
);

-- Create contract_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.contract_templates (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    content text,
    is_active boolean DEFAULT true,
    CONSTRAINT contract_templates_pkey PRIMARY KEY (id)
);

-- Create bookings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.bookings (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    status text NOT NULL DEFAULT 'active'::text,
    cost_rub numeric,
    CONSTRAINT bookings_pkey PRIMARY KEY (id),
    CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.clients(id)
);

-- Create rental_batteries table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rental_batteries (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    rental_id bigint NOT NULL,
    battery_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT rental_batteries_pkey PRIMARY KEY (id),
    CONSTRAINT rental_batteries_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rentals(id),
    CONSTRAINT rental_batteries_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES public.batteries(id)
);

-- ============================================
-- 1. ADD MISSING COLUMNS (IF NOT EXISTS)
-- ============================================

-- Add missing columns to clients table
DO $$ 
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='clients' AND column_name='email') THEN
        ALTER TABLE public.clients ADD COLUMN email text;
    END IF;

    -- Add role column if it doesn't exist (for admin/investor/user roles)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='clients' AND column_name='role') THEN
        ALTER TABLE public.clients ADD COLUMN role text DEFAULT 'user';
    END IF;

    -- Add password_hash column if it doesn't exist (for admin login)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='clients' AND column_name='password_hash') THEN
        ALTER TABLE public.clients ADD COLUMN password_hash text;
    END IF;
END $$;

-- Add missing columns to rentals table
DO $$ 
BEGIN
    -- Add ended_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='rentals' AND column_name='ended_at') THEN
        ALTER TABLE public.rentals ADD COLUMN ended_at timestamp with time zone;
    END IF;

    -- Add contract_signed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='rentals' AND column_name='contract_signed') THEN
        ALTER TABLE public.rentals ADD COLUMN contract_signed boolean DEFAULT false;
    END IF;

    -- Add contract_signature column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='rentals' AND column_name='contract_signature') THEN
        ALTER TABLE public.rentals ADD COLUMN contract_signature text;
    END IF;
END $$;

-- Add missing columns to bikes table
DO $$ 
BEGIN
    -- Add last_service_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bikes' AND column_name='last_service_date') THEN
        ALTER TABLE public.bikes ADD COLUMN last_service_date timestamp with time zone;
    END IF;
END $$;

-- ============================================
-- 2. CREATE RPC FUNCTIONS
-- ============================================

-- Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS public.add_to_balance(uuid, numeric);
DROP FUNCTION IF EXISTS public.assign_bike_to_rental(bigint, integer);
DROP FUNCTION IF EXISTS public.get_anonymous_chats();
DROP FUNCTION IF EXISTS public.get_client_chats();

-- Function: add_to_balance
-- Safely adds/subtracts amount from client balance
CREATE OR REPLACE FUNCTION public.add_to_balance(
    client_id_to_update uuid,
    amount_to_add numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.clients
    SET balance_rub = balance_rub + amount_to_add
    WHERE id = client_id_to_update;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client with id % not found', client_id_to_update;
    END IF;
END;
$$;

-- Function: assign_bike_to_rental
-- Assigns a bike to a rental and updates bike status
CREATE OR REPLACE FUNCTION public.assign_bike_to_rental(
    p_rental_id bigint,
    p_bike_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update rental with bike_id
    UPDATE public.rentals
    SET bike_id = p_bike_id
    WHERE id = p_rental_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental with id % not found', p_rental_id;
    END IF;
    
    -- Update bike status to 'rented'
    UPDATE public.bikes
    SET status = 'rented'
    WHERE id = p_bike_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bike with id % not found', p_bike_id;
    END IF;
END;
$$;

-- Function: get_anonymous_chats
-- Returns list of anonymous support chats
CREATE OR REPLACE FUNCTION public.get_anonymous_chats()
RETURNS TABLE (
    chat_id text,
    last_message_time timestamp with time zone,
    unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.anonymous_chat_id as chat_id,
        MAX(sm.created_at) as last_message_time,
        COUNT(*) FILTER (WHERE sm.is_read = false AND sm.sender = 'client') as unread_count
    FROM public.support_messages sm
    WHERE sm.anonymous_chat_id IS NOT NULL
    GROUP BY sm.anonymous_chat_id
    ORDER BY last_message_time DESC;
END;
$$;

-- Function: get_client_chats
-- Returns list of client support chats
CREATE OR REPLACE FUNCTION public.get_client_chats()
RETURNS TABLE (
    client_id uuid,
    client_name text,
    client_phone text,
    last_message_time timestamp with time zone,
    unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        MAX(sm.created_at) as last_message_time,
        COUNT(*) FILTER (WHERE sm.is_read = false AND sm.sender = 'client') as unread_count
    FROM public.clients c
    INNER JOIN public.support_messages sm ON sm.client_id = c.id
    WHERE sm.client_id IS NOT NULL
    GROUP BY c.id, c.name, c.phone
    ORDER BY last_message_time DESC;
END;
$$;

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Index on clients auth_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_auth_token ON public.clients(auth_token);

-- Index on clients telegram_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_telegram_user_id ON public.clients(telegram_user_id);

-- Index on rentals user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_rentals_user_id ON public.rentals(user_id);

-- Index on rentals status for filtering
CREATE INDEX IF NOT EXISTS idx_rentals_status ON public.rentals(status);

-- Index on bikes status for filtering
CREATE INDEX IF NOT EXISTS idx_bikes_status ON public.bikes(status);

-- Index on bikes city for filtering
CREATE INDEX IF NOT EXISTS idx_bikes_city ON public.bikes(city);

-- Index on payments client_id for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);

-- Index on payments yookassa_payment_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_payments_yookassa_payment_id ON public.payments(yookassa_payment_id);

-- Index on support_messages for chat queries
CREATE INDEX IF NOT EXISTS idx_support_messages_client_id ON public.support_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_anonymous_chat_id ON public.support_messages(anonymous_chat_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at DESC);

-- ============================================
-- 4. SET UP ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on tables (if not already enabled)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DO $$ 
BEGIN
    -- Drop and recreate clients policies
    DROP POLICY IF EXISTS "Users can view own data" ON public.clients;
    CREATE POLICY "Users can view own data" ON public.clients
        FOR SELECT
        USING (auth.uid() = id);

    DROP POLICY IF EXISTS "Users can update own data" ON public.clients;
    CREATE POLICY "Users can update own data" ON public.clients
        FOR UPDATE
        USING (auth.uid() = id);

    -- Drop and recreate rentals policies
    DROP POLICY IF EXISTS "Users can view own rentals" ON public.rentals;
    CREATE POLICY "Users can view own rentals" ON public.rentals
        FOR SELECT
        USING (auth.uid() = user_id);

    -- Drop and recreate payments policies
    DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
    CREATE POLICY "Users can view own payments" ON public.payments
        FOR SELECT
        USING (auth.uid() = client_id);

    -- Drop and recreate support_messages policies
    DROP POLICY IF EXISTS "Users can view own messages" ON public.support_messages;
    CREATE POLICY "Users can view own messages" ON public.support_messages
        FOR SELECT
        USING (auth.uid() = client_id);

    DROP POLICY IF EXISTS "Users can insert own messages" ON public.support_messages;
    CREATE POLICY "Users can insert own messages" ON public.support_messages
        FOR INSERT
        WITH CHECK (auth.uid() = client_id);
END $$;

-- ============================================
-- 5. CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Trigger: Update app_settings updated_at on change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. INSERT DEFAULT DATA (IF NOT EXISTS)
-- ============================================

-- Insert default app settings
INSERT INTO public.app_settings (key, value)
VALUES 
    ('maintenance_mode', '{"enabled": false, "message": "Система на обслуживании"}'::jsonb),
    ('default_city', '"Воронеж"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant permissions to service role (for backend operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Refresh Supabase schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Migration completed successfully!' as status;
