# Инструкция по миграции базы данных

## Шаг 1: Подготовка новой базы данных

### 1.1 Выполните SQL скрипт создания структуры

Откройте SQL Editor в новой Supabase инстанции (`https://gkxbcgugrorsqqxjhbtj.supabase.co`) и выполните файл:

```bash
setup_new_database.sql
```

Или через psql:
```bash
psql "postgresql://postgres:kerpat2004!!@db.gkxbcgugrorsqqxjhbtj.supabase.co:5432/postgres" < setup_new_database.sql
```

### 1.2 Создайте Storage Buckets

В Supabase Dashboard → Storage → Create Bucket:

1. **passports** (Private)
   - Public: ❌ No
   - File size limit: 10 MB
   - Allowed MIME types: `image/jpeg`, `image/png`, `video/mp4`

2. **support_files** (Private)
   - Public: ❌ No
   - File size limit: 10 MB
   - Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`

3. **contracts** (Private)
   - Public: ❌ No
   - File size limit: 5 MB
   - Allowed MIME types: `application/pdf`

## Шаг 2: Миграция данных (если есть старая база)

### 2.1 Экспорт данных из старой базы

Подключитесь к старой базе и экспортируйте данные:

```bash
# Экспорт только данных (без структуры)
pg_dump "postgresql://postgres:[password]@db.avamqfmuhiwtlumjkzmv.supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --file=old_database_data.sql
```

Или экспортируйте таблицы по отдельности:

```sql
-- В старой базе данных через SQL Editor
COPY (SELECT * FROM public.clients) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.tariffs) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.bikes) TO STDOUT WITH CSV HEADER;
-- и так далее для каждой таблицы
```

### 2.2 Импорт данных в новую базу

**Важно**: Импортируйте в правильном порядке (учитывая внешние ключи):

```bash
# Порядок импорта:
1. clients (независимая)
2. tariffs (независимая)
3. batteries (независимая)
4. app_settings (независимая)
5. contract_templates (независимая)
6. bikes (зависит от clients, tariffs)
7. rentals (зависит от clients, bikes, tariffs)
8. bookings (зависит от clients)
9. rental_batteries (зависит от rentals, batteries)
10. payments (зависит от clients, rentals)
11. support_messages (зависит от clients)
```

Пример импорта через psql:

```bash
psql "postgresql://postgres:kerpat2004!!@db.gkxbcgugrorsqqxjhbtj.supabase.co:5432/postgres" < old_database_data.sql
```

### 2.3 Миграция файлов из Storage

Если у вас есть файлы в Storage старой базы, их нужно перенести:

```javascript
// Скрипт для миграции Storage (Node.js)
const { createClient } = require('@supabase/supabase-js');

const oldSupabase = createClient(
  'https://avamqfmuhiwtlumjkzmv.supabase.co',
  'OLD_SERVICE_ROLE_KEY'
);

const newSupabase = createClient(
  'https://gkxbcgugrorsqqxjhbtj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE'
);

async function migrateStorage(bucketName) {
  // Получить список файлов из старого bucket
  const { data: files, error } = await oldSupabase
    .storage
    .from(bucketName)
    .list();

  if (error) {
    console.error('Error listing files:', error);
    return;
  }

  // Копировать каждый файл
  for (const file of files) {
    const { data: fileData, error: downloadError } = await oldSupabase
      .storage
      .from(bucketName)
      .download(file.name);

    if (downloadError) {
      console.error(`Error downloading ${file.name}:`, downloadError);
      continue;
    }

    const { error: uploadError } = await newSupabase
      .storage
      .from(bucketName)
      .upload(file.name, fileData, {
        contentType: file.metadata?.mimetype
      });

    if (uploadError) {
      console.error(`Error uploading ${file.name}:`, uploadError);
    } else {
      console.log(`✅ Migrated ${file.name}`);
    }
  }
}

// Запустить миграцию
(async () => {
  await migrateStorage('passports');
  await migrateStorage('support_files');
  await migrateStorage('contracts');
})();
```

## Шаг 3: Проверка миграции

### 3.1 Проверьте количество записей

```sql
-- В новой базе данных
SELECT 'clients' as table_name, COUNT(*) as count FROM public.clients
UNION ALL
SELECT 'tariffs', COUNT(*) FROM public.tariffs
UNION ALL
SELECT 'bikes', COUNT(*) FROM public.bikes
UNION ALL
SELECT 'rentals', COUNT(*) FROM public.rentals
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL
SELECT 'batteries', COUNT(*) FROM public.batteries
UNION ALL
SELECT 'bookings', COUNT(*) FROM public.bookings
UNION ALL
SELECT 'support_messages', COUNT(*) FROM public.support_messages;
```

Сравните с результатами из старой базы.

### 3.2 Проверьте функции

```sql
-- Проверка функций
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### 3.3 Проверьте триггеры

```sql
-- Проверка триггеров
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

## Шаг 4: Обновление переменных окружения

### 4.1 Vercel

Dashboard → Settings → Environment Variables:

```bash
SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.M8mN42RHgUlvft5rHiyq5kVBSoEgUQ9fJxWh_Uu5Dtw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
```

После обновления нажмите **Redeploy**.

### 4.2 Render.com

Для каждого сервиса (prizmatic-server, ocr-worker):

Dashboard → Environment Variables:

```bash
SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
```

Нажмите **Save** и сервисы автоматически перезапустятся.

### 4.3 Telegram Bot (.env)

```bash
cd telegram-bot
nano .env
```

Обновите:
```bash
SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
```

Перезапустите бота:
```bash
# Если используете systemd
sudo systemctl restart prizmatic-bot

# Если используете screen
screen -r prizmatic-bot
# Ctrl+C для остановки
# python bot.py для запуска
```

### 4.4 Локальная разработка

```bash
cd site
cp config.example.js config.js
# Файл уже содержит новые учетные данные
```

## Шаг 5: Тестирование

### Чеклист проверки:

- [ ] Открывается главная страница приложения
- [ ] Работает вход пользователя (VK ID, телефон)
- [ ] Работает карта и отображение велосипедов
- [ ] Работает регистрация через Telegram Bot
- [ ] OCR обрабатывает документы
- [ ] Работает админ-панель
- [ ] Платежи проходят через ЮKassa
- [ ] Работает чат поддержки
- [ ] Сохраняются файлы в Storage
- [ ] Отправляются уведомления

### Тестовые запросы SQL:

```sql
-- Проверка связей
SELECT 
  r.id as rental_id,
  c.name as client_name,
  b.bike_code,
  t.title as tariff_title
FROM rentals r
LEFT JOIN clients c ON r.user_id = c.id
LEFT JOIN bikes b ON r.bike_id = b.id
LEFT JOIN tariffs t ON r.tariff_id = t.id
LIMIT 5;

-- Проверка геолокации
SELECT 
  id,
  bike_code,
  ST_AsGeoJSON(location) as location_json
FROM bikes
WHERE location IS NOT NULL
LIMIT 5;
```

## Шаг 6: Откат (если что-то пошло не так)

Если после миграции возникли проблемы, можно быстро вернуться к старой базе:

### 6.1 Откат через Vercel
```bash
SUPABASE_URL=https://avamqfmuhiwtlumjkzmv.supabase.co
SUPABASE_ANON_KEY=[старый ключ]
```
Redeploy.

### 6.2 Откат Render
Аналогично обновите env vars на старые значения.

### 6.3 Откат Telegram Bot
Верните старые значения в `.env` и перезапустите.

## Дополнительные команды

### Сброс последовательностей (sequences)

Если после импорта данных возникают ошибки с ID:

```sql
-- Сбросить sequences для таблиц с IDENTITY
SELECT setval('tariffs_id_seq', (SELECT MAX(id) FROM tariffs));
SELECT setval('batteries_id_seq', (SELECT MAX(id) FROM batteries));
SELECT setval('rentals_id_seq', (SELECT MAX(id) FROM rentals));
SELECT setval('rental_batteries_id_seq', (SELECT MAX(id) FROM rental_batteries));
SELECT setval('payments_id_seq', (SELECT MAX(id) FROM payments));
SELECT setval('bookings_id_seq', (SELECT MAX(id) FROM bookings));
SELECT setval('contract_templates_id_seq', (SELECT MAX(id) FROM contract_templates));
SELECT setval('bikes_id_seq', (SELECT MAX(id) FROM bikes));
```

### Включение Realtime для таблиц

Если нужно включить Realtime updates:

```sql
-- В SQL Editor новой базы
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE rentals;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE bikes;
```

## Помощь и поддержка

Если возникли проблемы:
1. Проверьте логи в Vercel Dashboard
2. Проверьте логи в Render Dashboard
3. Проверьте логи Telegram Bot
4. Проверьте SQL запросы в Supabase SQL Editor

## Завершение

После успешной миграции и проверки:
- ✅ Удалите старые env vars (сохраните backup)
- ✅ Обновите документацию
- ✅ Уведомите команду
- ✅ Мониторьте приложение первые 24 часа

---

**Дата создания**: 3 ноября 2025  
**Версия**: 1.0

