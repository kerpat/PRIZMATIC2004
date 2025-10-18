-- Включаем Realtime для таблиц

-- 1. Включаем публикацию изменений для таблицы clients
ALTER TABLE clients REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE clients;

-- 2. Включаем публикацию изменений для таблицы rentals
ALTER TABLE rentals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE rentals;

-- 3. Включаем публикацию изменений для таблицы bookings
ALTER TABLE bookings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- Проверяем, что таблицы добавлены в публикацию
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
