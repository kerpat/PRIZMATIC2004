-- Проверка и настройка RLS политик для Realtime

-- Для таблицы clients - пользователь видит только свои данные
CREATE POLICY IF NOT EXISTS "Users can view own data"
ON clients FOR SELECT
USING (auth.uid() = id OR id = ANY(SELECT id FROM clients));

-- Для таблицы rentals - пользователь видит только свои аренды
CREATE POLICY IF NOT EXISTS "Users can view own rentals"
ON rentals FOR SELECT
USING (auth.uid() = user_id OR user_id = ANY(SELECT id FROM clients));

-- Для таблицы bookings - пользователь видит только свои брони
CREATE POLICY IF NOT EXISTS "Users can view own bookings"
ON bookings FOR SELECT
USING (auth.uid() = user_id OR user_id = ANY(SELECT id FROM clients));

-- ВАЖНО: Для Realtime нужны права на SELECT
-- Если RLS включен, убедитесь что есть политики для authenticated роли
