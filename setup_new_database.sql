-- ============================================================================
-- PRIZMATIC Database Schema Setup Script
-- Для новой базы данных Supabase: https://gkxbcgugrorsqqxjhbtj.supabase.co
-- ============================================================================

-- Включаем расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- 1. ТАБЛИЦА: clients (пользователи/клиенты)
-- ============================================================================
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
  last_location geography(Point, 4326), -- USER-DEFINED тип заменен на geography
  auth_token text UNIQUE,
  ocr_started_at timestamp with time zone,
  ocr_completed_at timestamp with time zone,
  ocr_failed_at timestamp with time zone,
  ocr_error text,
  recognized_data jsonb,
  telegram_user_id bigint,
  video_selfie_file_id text,
  recognized_passport_data jsonb,
  email text,
  role text DEFAULT 'user'::text,
  password_hash text,
  vk_user_id bigint UNIQUE,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);

-- Индексы для clients
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_telegram_user_id ON public.clients(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_vk_user_id ON public.clients(vk_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_auth_token ON public.clients(auth_token);
CREATE INDEX IF NOT EXISTS idx_clients_verification_status ON public.clients(verification_status);

-- ============================================================================
-- 2. ТАБЛИЦА: tariffs (тарифы)
-- ============================================================================
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

-- Индексы для tariffs
CREATE INDEX IF NOT EXISTS idx_tariffs_slug ON public.tariffs(slug);
CREATE INDEX IF NOT EXISTS idx_tariffs_is_active ON public.tariffs(is_active);

-- ============================================================================
-- 3. ТАБЛИЦА: bikes (велосипеды)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS bikes_id_seq;

CREATE TABLE IF NOT EXISTS public.bikes (
  id integer NOT NULL DEFAULT nextval('bikes_id_seq'::regclass),
  bike_code text NOT NULL UNIQUE,
  model_name text,
  status text NOT NULL DEFAULT 'available'::text,
  location geography(Point, 4326), -- USER-DEFINED тип заменен на geography
  mileage numeric DEFAULT 0,
  last_maintenance_date date,
  investor_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  city text,
  frame_number text,
  battery_numbers text[], -- ARRAY заменен на text[]
  registration_number text,
  iot_device_id text,
  additional_equipment text,
  tariff_id bigint,
  service_reason text,
  last_service_date timestamp with time zone,
  CONSTRAINT bikes_pkey PRIMARY KEY (id),
  CONSTRAINT bikes_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.clients(id),
  CONSTRAINT bikes_tariff_id_fkey FOREIGN KEY (tariff_id) REFERENCES public.tariffs(id)
);

-- Индексы для bikes
CREATE INDEX IF NOT EXISTS idx_bikes_bike_code ON public.bikes(bike_code);
CREATE INDEX IF NOT EXISTS idx_bikes_status ON public.bikes(status);
CREATE INDEX IF NOT EXISTS idx_bikes_city ON public.bikes(city);
CREATE INDEX IF NOT EXISTS idx_bikes_investor_id ON public.bikes(investor_id);
CREATE INDEX IF NOT EXISTS idx_bikes_tariff_id ON public.bikes(tariff_id);

-- ============================================================================
-- 4. ТАБЛИЦА: batteries (батареи)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.batteries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  serial_number text NOT NULL UNIQUE,
  capacity_wh integer,
  description text,
  status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'in_use'::text, 'charging'::text, 'maintenance'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT batteries_pkey PRIMARY KEY (id)
);

-- Индексы для batteries
CREATE INDEX IF NOT EXISTS idx_batteries_serial_number ON public.batteries(serial_number);
CREATE INDEX IF NOT EXISTS idx_batteries_status ON public.batteries(status);

-- ============================================================================
-- 5. ТАБЛИЦА: rentals (аренды)
-- ============================================================================
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
  ended_at timestamp with time zone,
  contract_signed boolean DEFAULT false,
  contract_signature text,
  CONSTRAINT rentals_pkey PRIMARY KEY (id),
  CONSTRAINT rentals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.clients(id),
  CONSTRAINT rentals_tariff_id_fkey FOREIGN KEY (tariff_id) REFERENCES public.tariffs(id),
  CONSTRAINT rentals_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES public.bikes(id)
);

-- Индексы для rentals
CREATE INDEX IF NOT EXISTS idx_rentals_user_id ON public.rentals(user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_bike_id ON public.rentals(bike_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON public.rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_starts_at ON public.rentals(starts_at);

-- ============================================================================
-- 6. ТАБЛИЦА: rental_batteries (связь аренд и батарей)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rental_batteries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  rental_id bigint NOT NULL,
  battery_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rental_batteries_pkey PRIMARY KEY (id),
  CONSTRAINT rental_batteries_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rentals(id),
  CONSTRAINT rental_batteries_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES public.batteries(id)
);

-- Индексы для rental_batteries
CREATE INDEX IF NOT EXISTS idx_rental_batteries_rental_id ON public.rental_batteries(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_batteries_battery_id ON public.rental_batteries(battery_id);

-- ============================================================================
-- 7. ТАБЛИЦА: bookings (бронирования)
-- ============================================================================
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

-- Индексы для bookings
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_expires_at ON public.bookings(expires_at);

-- ============================================================================
-- 8. ТАБЛИЦА: payments (платежи)
-- ============================================================================
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
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT payments_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rentals(id)
);

-- Индексы для payments
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_rental_id ON public.payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_yookassa_payment_id ON public.payments(yookassa_payment_id);

-- ============================================================================
-- 9. ТАБЛИЦА: support_messages (сообщения поддержки)
-- ============================================================================
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

-- Индексы для support_messages
CREATE INDEX IF NOT EXISTS idx_support_messages_client_id ON public.support_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_anonymous_chat_id ON public.support_messages(anonymous_chat_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_is_read ON public.support_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at DESC);

-- ============================================================================
-- 10. ТАБЛИЦА: app_settings (настройки приложения)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL,
  value jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);

-- ============================================================================
-- 11. ТАБЛИЦА: contract_templates (шаблоны договоров)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  name text NOT NULL,
  content text,
  is_active boolean DEFAULT true,
  CONSTRAINT contract_templates_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- 12. ТАБЛИЦА: spatial_ref_sys (для PostGIS)
-- ============================================================================
-- Эта таблица обычно создается расширением PostGIS автоматически
-- Если нужно создать вручную:
CREATE TABLE IF NOT EXISTS public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying(256),
  auth_srid integer,
  srtext character varying(2048),
  proj4text character varying(2048),
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);

-- ============================================================================
-- ФУНКЦИИ
-- ============================================================================

-- Функция: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Функция: add_to_balance
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
END;
$$;

-- Функция: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.clients
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Функция: assign_bike_to_rental (версия с bigint)
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
  
  UPDATE public.bikes
  SET status = 'in_use'
  WHERE id = p_bike_id;
END;
$$;

-- Функция: assign_bike_to_rental (версия с integer для совместимости)
CREATE OR REPLACE FUNCTION public.assign_bike_to_rental(
  p_rental_id integer,
  p_bike_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.rentals
  SET bike_id = p_bike_id
  WHERE id = p_rental_id;
  
  UPDATE public.bikes
  SET status = 'in_use'
  WHERE id = p_bike_id;
END;
$$;

-- Функция: get_bikes_with_locations
CREATE OR REPLACE FUNCTION public.get_bikes_with_locations()
RETURNS TABLE(
  id integer,
  bike_code text,
  model_name text,
  status text,
  location_geojson json
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.bike_code,
    b.model_name,
    b.status,
    CASE 
      WHEN b.location IS NOT NULL THEN
        ST_AsGeoJSON(b.location)::json
      ELSE
        NULL
    END as location_geojson
  FROM public.bikes b;
END;
$$;

-- Функция: get_clients_with_locations
CREATE OR REPLACE FUNCTION public.get_clients_with_locations()
RETURNS TABLE(
  id uuid,
  name text,
  location_geojson json
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    CASE 
      WHEN c.last_location IS NOT NULL THEN
        ST_AsGeoJSON(c.last_location)::json
      ELSE
        NULL
    END as location_geojson
  FROM public.clients c;
END;
$$;

-- Функция: get_client_chats
CREATE OR REPLACE FUNCTION public.get_client_chats()
RETURNS TABLE(
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
    COUNT(*) FILTER (WHERE sm.is_read = false AND sm.sender = 'user') as unread_count
  FROM public.clients c
  INNER JOIN public.support_messages sm ON sm.client_id = c.id
  GROUP BY c.id, c.name, c.phone
  ORDER BY MAX(sm.created_at) DESC;
END;
$$;

-- Функция: get_anonymous_chats
CREATE OR REPLACE FUNCTION public.get_anonymous_chats()
RETURNS TABLE(
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
    COUNT(*) FILTER (WHERE sm.is_read = false AND sm.sender = 'user') as unread_count
  FROM public.support_messages sm
  WHERE sm.anonymous_chat_id IS NOT NULL
  GROUP BY sm.anonymous_chat_id
  ORDER BY MAX(sm.created_at) DESC;
END;
$$;

-- Функция: handle_rental_activation (триггер)
CREATE OR REPLACE FUNCTION public.handle_rental_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Когда аренда становится активной, обновляем статус велосипеда
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    UPDATE public.bikes
    SET status = 'in_use'
    WHERE id = NEW.bike_id;
  END IF;
  
  -- Когда аренда завершается, освобождаем велосипед
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status = 'active' THEN
    UPDATE public.bikes
    SET status = 'available'
    WHERE id = NEW.bike_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ТРИГГЕРЫ
-- ============================================================================

-- Триггер для app_settings
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Триггер для rentals
DROP TRIGGER IF EXISTS trigger_handle_rental_activation ON public.rentals;
CREATE TRIGGER trigger_handle_rental_activation
  AFTER INSERT OR UPDATE ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_rental_activation();

-- ============================================================================
-- STORAGE BUCKETS (для Supabase Storage)
-- ============================================================================
-- Эти команды нужно выполнить через Supabase Dashboard или API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('passports', 'passports', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('support_files', 'support_files', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);

-- ============================================================================
-- RLS (Row Level Security) POLICIES - Базовые примеры
-- ============================================================================

-- Включаем RLS для таблиц
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Политика для clients: пользователи видят только свои данные
CREATE POLICY "Users can view own data" ON public.clients
  FOR SELECT
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "Users can update own data" ON public.clients
  FOR UPDATE
  USING (auth.uid() = id OR is_admin());

-- Политика для rentals: пользователи видят только свои аренды
CREATE POLICY "Users can view own rentals" ON public.rentals
  FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

-- Политика для payments: пользователи видят только свои платежи
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT
  USING (auth.uid() = client_id OR is_admin());

-- Политика для support_messages: пользователи видят только свои сообщения
CREATE POLICY "Users can view own messages" ON public.support_messages
  FOR SELECT
  USING (auth.uid() = client_id OR is_admin());

CREATE POLICY "Users can insert own messages" ON public.support_messages
  FOR INSERT
  WITH CHECK (auth.uid() = client_id OR anonymous_chat_id IS NOT NULL);

-- ============================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ (опционально)
-- ============================================================================

-- Добавьте тестовые тарифы
INSERT INTO public.tariffs (title, description, slug, price_rub, duration_days, is_active, short_description)
VALUES 
  ('Почасовая аренда', 'Аренда велосипеда на час', 'hourly', 150, 0, true, '150₽/час'),
  ('Дневной тариф', 'Аренда велосипеда на весь день', 'daily', 600, 1, true, '600₽/день'),
  ('Недельный тариф', 'Аренда на неделю со скидкой', 'weekly', 3500, 7, true, '3500₽/неделя'),
  ('Месячный тариф', 'Выгодная месячная подписка', 'monthly', 12000, 30, true, '12000₽/месяц')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- КОММЕНТАРИИ
-- ============================================================================
COMMENT ON TABLE public.clients IS 'Таблица пользователей/клиентов системы';
COMMENT ON TABLE public.bikes IS 'Таблица велосипедов';
COMMENT ON TABLE public.rentals IS 'Таблица аренд';
COMMENT ON TABLE public.tariffs IS 'Таблица тарифов';
COMMENT ON TABLE public.payments IS 'Таблица платежей';
COMMENT ON TABLE public.batteries IS 'Таблица аккумуляторов';
COMMENT ON TABLE public.bookings IS 'Таблица бронирований';
COMMENT ON TABLE public.support_messages IS 'Таблица сообщений поддержки';

-- ============================================================================
-- ЗАВЕРШЕНО
-- ============================================================================
-- Скрипт создания базы данных завершен.
-- 
-- ВАЖНО: После выполнения этого скрипта:
-- 1. Создайте Storage Buckets в Supabase Dashboard:
--    - passports (private)
--    - support_files (private)
--    - contracts (private)
-- 
-- 2. Настройте RLS политики в соответствии с вашими требованиями безопасности
-- 
-- 3. Выполните миграцию данных из старой базы (если требуется)
--
-- 4. Обновите все environment variables на серверах (Vercel, Render, etc.)
--
-- 5. Протестируйте все функции приложения
-- ============================================================================

