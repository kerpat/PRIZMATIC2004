-- ============================================
-- GoGoBike Full Database Schema
-- Creates all tables from scratch
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP EXISTING TABLES (CAREFUL!)
-- Uncomment only if you want to recreate everything
-- ============================================
-- DROP TABLE IF EXISTS public.rental_batteries CASCADE;
-- DROP TABLE IF EXISTS public.payments CASCADE;
-- DROP TABLE IF EXISTS public.bookings CASCADE;
-- DROP TABLE IF EXISTS public.rentals CASCADE;
-- DROP TABLE IF EXISTS public.bikes CASCADE;
-- DROP TABLE IF EXISTS public.batteries CASCADE;
-- DROP TABLE IF EXISTS public.support_messages CASCADE;
-- DROP TABLE IF EXISTS public.contract_templates CASCADE;
-- DROP TABLE IF EXISTS public.tariffs CASCADE;
-- DROP TABLE IF EXISTS public.clients CASCADE;
-- DROP TABLE IF EXISTS public.app_settings CASCADE;
-- DROP TABLE IF EXISTS public.spatial_ref_sys CASCADE;

-- ============================================
-- CREATE TABLES IN CORRECT ORDER
-- ============================================

-- 1. app_settings (no dependencies)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text NOT NULL,
    value jsonb,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);

-- 2. spatial_ref_sys (PostGIS table, usually auto-created)
CREATE TABLE IF NOT EXISTS public.spatial_ref_sys (
    srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
    auth_name character varying,
    auth_srid integer,
    srtext character varying,
    proj4text character varying,
    CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);

-- 3. clients (no dependencies)
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    name text,
    phone text UNIQUE,
    city text,
    verification_status text DEFAULT 'pending'::text,
    yookassa_payment_method_id text,
    extra jsonb,
    autopay_enabled boolean DEFAULT true,
    balance_rub numeric NOT NULL DEFAULT 0,
    last_location geometry(Point, 4326),
    auth_token text UNIQUE,
    ocr_started_at timestamp with time zone,
    ocr_completed_at timestamp with time zone,
    ocr_failed_at timestamp with time zone,
    ocr_error text,
    recognized_data jsonb,
    telegram_user_id bigint UNIQUE,
    video_selfie_file_id text,
    recognized_passport_data jsonb,
    CONSTRAINT clients_pkey PRIMARY KEY (id)
);

-- 4. tariffs (no dependencies)
CREATE TABLE IF NOT EXISTS public.tariffs (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    title text NOT NULL,
    description text,
    slug text UNIQUE,
    price_rub numeric,
    duration_days integer,
    is_active boolean DEFAULT true,
    extensions jsonb,
    short_description text,
    CONSTRAINT tariffs_pkey PRIMARY KEY (id)
);

-- 5. contract_templates (no dependencies)
CREATE TABLE IF NOT EXISTS public.contract_templates (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    content text,
    is_active boolean DEFAULT true,
    CONSTRAINT contract_templates_pkey PRIMARY KEY (id)
);

-- 6. batteries (no dependencies)
CREATE TABLE IF NOT EXISTS public.batteries (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    serial_number text NOT NULL UNIQUE,
    capacity_wh integer,
    description text,
    status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'in_use'::text, 'charging'::text, 'maintenance'::text])),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT batteries_pkey PRIMARY KEY (id)
);

-- 7. bikes (depends on clients, tariffs)
-- Create sequence first
CREATE SEQUENCE IF NOT EXISTS bikes_id_seq;

CREATE TABLE IF NOT EXISTS public.bikes (
    id integer NOT NULL DEFAULT nextval('bikes_id_seq'::regclass),
    bike_code text NOT NULL UNIQUE,
    model_name text,
    status text NOT NULL DEFAULT 'available'::text,
    location geometry(Point, 4326),
    mileage numeric DEFAULT 0,
    last_maintenance_date date,
    investor_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    city text,
    frame_number text,
    battery_numbers text[],
    registration_number text,
    iot_device_id text,
    additional_equipment text,
    tariff_id bigint,
    service_reason text,
    CONSTRAINT bikes_pkey PRIMARY KEY (id),
    CONSTRAINT bikes_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.clients(id),
    CONSTRAINT bikes_tariff_id_fkey FOREIGN KEY (tariff_id) REFERENCES public.tariffs(id)
);

-- 8. bookings (depends on clients)
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

-- 9. rentals (depends on clients, tariffs, bikes)
CREATE TABLE IF NOT EXISTS public.rentals (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    bike_id integer,
    tariff_id bigint,
    starts_at timestamp with time zone,
    current_period_ends_at timestamp with time zone,
    status text NOT NULL DEFAULT 'active'::text,
    total_paid_rub numeric DEFAULT 0,
    extra_data jsonb,
    CONSTRAINT rentals_pkey PRIMARY KEY (id),
    CONSTRAINT rentals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.clients(id),
    CONSTRAINT rentals_tariff_id_fkey FOREIGN KEY (tariff_id) REFERENCES public.tariffs(id),
    CONSTRAINT rentals_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES public.bikes(id)
);

-- 10. payments (depends on clients, rentals, bookings)
CREATE TABLE IF NOT EXISTS public.payments (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    client_id uuid,
    amount_rub numeric,
    method text,
    status text,
    rental_id bigint,
    payment_type text,
    yookassa_payment_id text UNIQUE,
    payment_method_title text,
    description text,
    booking_id bigint,
    CONSTRAINT payments_pkey PRIMARY KEY (id),
    CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
    CONSTRAINT payments_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rentals(id),
    CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);

-- 11. rental_batteries (depends on rentals, batteries)
CREATE TABLE IF NOT EXISTS public.rental_batteries (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    rental_id bigint NOT NULL,
    battery_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT rental_batteries_pkey PRIMARY KEY (id),
    CONSTRAINT rental_batteries_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rentals(id),
    CONSTRAINT rental_batteries_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES public.batteries(id)
);

-- 12. support_messages (depends on clients)
CREATE TABLE IF NOT EXISTS public.support_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    client_id uuid,
    sender text NOT NULL,
    message_text text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    anonymous_chat_id text,
    file_url text,
    file_type text,
    CONSTRAINT support_messages_pkey PRIMARY KEY (id),
    CONSTRAINT support_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_auth_token ON public.clients(auth_token);
CREATE INDEX IF NOT EXISTS idx_clients_telegram_user_id ON public.clients(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_rentals_user_id ON public.rentals(user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON public.rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_bike_id ON public.rentals(bike_id);
CREATE INDEX IF NOT EXISTS idx_bikes_status ON public.bikes(status);
CREATE INDEX IF NOT EXISTS idx_bikes_city ON public.bikes(city);
CREATE INDEX IF NOT EXISTS idx_bikes_bike_code ON public.bikes(bike_code);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_yookassa_payment_id ON public.payments(yookassa_payment_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_client_id ON public.support_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_anonymous_chat_id ON public.support_messages(anonymous_chat_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- ============================================
-- CREATE RPC FUNCTIONS
-- ============================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.add_to_balance(uuid, numeric);
DROP FUNCTION IF EXISTS public.assign_bike_to_rental(bigint, integer);
DROP FUNCTION IF EXISTS public.get_anonymous_chats();
DROP FUNCTION IF EXISTS public.get_client_chats();

-- Function: add_to_balance
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
CREATE OR REPLACE FUNCTION public.assign_bike_to_rental(
    p_rental_id bigint,
    p_bike_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.rentals
    SET bike_id = p_bike_id
    WHERE id = p_rental_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental with id % not found', p_rental_id;
    END IF;
    
    UPDATE public.bikes
    SET status = 'rented'
    WHERE id = p_bike_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bike with id % not found', p_bike_id;
    END IF;
END;
$$;

-- Function: get_anonymous_chats
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
-- INSERT DEFAULT DATA
-- ============================================

INSERT INTO public.app_settings (key, value)
VALUES 
    ('maintenance_mode', '{"enabled": false, "message": "Система на обслуживании"}'::jsonb),
    ('default_city', '"Воронеж"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Full schema created successfully!' as status;
