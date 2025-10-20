-- Включение Realtime для таблицы clients
-- Это позволит клиентам получать обновления статуса верификации в реальном времени

-- Проверка текущего статуса публикации
SELECT tablename, schemaname 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'clients';

-- Если clients не в списке, добавляем
ALTER PUBLICATION supabase_realtime ADD TABLE clients;

-- Проверка после добавления
SELECT tablename, schemaname 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'clients';

-- Результат должен быть:
-- tablename | schemaname
-- ----------+-----------
-- clients   | public

-- Готово! Теперь клиенты будут получать уведомления при изменении verification_status
