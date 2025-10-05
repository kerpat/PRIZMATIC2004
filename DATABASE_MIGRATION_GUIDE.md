# Руководство по миграции базы данных GoGoBike

## Что добавляет эта миграция

### 1. Новые колонки:
- **clients**: `email`, `role`, `password_hash`
- **rentals**: `ended_at`, `contract_signed`, `contract_signature`
- **bikes**: `last_service_date`

### 2. RPC Функции:
- `add_to_balance(client_id, amount)` - безопасное изменение баланса
- `assign_bike_to_rental(rental_id, bike_id)` - назначение велосипеда на аренду
- `get_anonymous_chats()` - получение списка анонимных чатов поддержки
- `get_client_chats()` - получение списка чатов клиентов

### 3. Индексы для производительности:
- Индексы на часто используемые поля для ускорения запросов

### 4. Row Level Security (RLS):
- Политики безопасности для защиты данных пользователей

### 5. Триггеры:
- Автоматическое обновление `updated_at` в `app_settings`

## Как применить миграцию

### Вариант 1: Через Supabase Dashboard (рекомендуется)

1. Откройте ваш проект на [supabase.com](https://supabase.com)
2. Перейдите в **SQL Editor**
3. Создайте новый запрос
4. Скопируйте содержимое файла `database_migration.sql`
5. Вставьте в редактор
6. Нажмите **Run** или `Ctrl+Enter`
7. Дождитесь сообщения "Migration completed successfully!"

### Вариант 2: Через Supabase CLI

```bash
# Установите Supabase CLI если еще не установлен
npm install -g supabase

# Войдите в аккаунт
supabase login

# Свяжите проект
supabase link --project-ref your-project-ref

# Примените миграцию
supabase db push --file database_migration.sql
```

### Вариант 3: Через psql (для продвинутых)

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f database_migration.sql
```

## Важно: Обновление Schema Cache

После применения миграции **обязательно** обновите schema cache в Supabase:

### Через Dashboard:
1. Перейдите в **Settings** → **API**
2. Нажмите кнопку **Reload schema cache** (или просто подождите 1-2 минуты)

### Или через SQL:
```sql
NOTIFY pgrst, 'reload schema';
```

Это необходимо, чтобы Supabase увидел новые таблицы и функции.

## Проверка успешности миграции

После применения миграции выполните следующие проверки:

### 1. Проверка функций:

```sql
-- Проверка add_to_balance
SELECT add_to_balance('your-test-user-id'::uuid, 100);

-- Проверка get_anonymous_chats
SELECT * FROM get_anonymous_chats();

-- Проверка get_client_chats
SELECT * FROM get_client_chats();
```

### 2. Проверка колонок:

```sql
-- Проверка новых колонок в clients
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('email', 'role', 'password_hash');

-- Проверка новых колонок в rentals
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rentals' 
AND column_name IN ('ended_at', 'contract_signed', 'contract_signature');
```

### 3. Проверка индексов:

```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';
```

## Откат миграции (если нужно)

Если что-то пошло не так, вы можете откатить изменения:

```sql
-- Удалить функции
DROP FUNCTION IF EXISTS public.add_to_balance(uuid, numeric);
DROP FUNCTION IF EXISTS public.assign_bike_to_rental(bigint, integer);
DROP FUNCTION IF EXISTS public.get_anonymous_chats();
DROP FUNCTION IF EXISTS public.get_client_chats();

-- Удалить колонки (ОСТОРОЖНО: удалит данные!)
ALTER TABLE public.clients DROP COLUMN IF EXISTS email;
ALTER TABLE public.clients DROP COLUMN IF EXISTS role;
ALTER TABLE public.clients DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.rentals DROP COLUMN IF EXISTS ended_at;
ALTER TABLE public.rentals DROP COLUMN IF EXISTS contract_signed;
ALTER TABLE public.rentals DROP COLUMN IF EXISTS contract_signature;
ALTER TABLE public.bikes DROP COLUMN IF EXISTS last_service_date;

-- Удалить индексы
DROP INDEX IF EXISTS idx_clients_auth_token;
DROP INDEX IF EXISTS idx_clients_telegram_user_id;
-- ... и так далее
```

## Безопасность

⚠️ **Важно**: 
- Миграция использует `SECURITY DEFINER` для RPC функций, что позволяет им выполняться с правами владельца функции
- Убедитесь, что у вас настроены правильные RLS политики
- Не давайте прямой доступ к базе данных неавторизованным пользователям

## Поддержка

Если возникли проблемы:
1. Проверьте логи в Supabase Dashboard → Database → Logs
2. Убедитесь, что у вас есть права на создание функций и изменение таблиц
3. Проверьте, что PostGIS extension установлен (для location полей)

## Дополнительные настройки

После миграции рекомендуется:

1. **Настроить бэкапы** в Supabase Dashboard → Database → Backups
2. **Включить Point-in-Time Recovery** для возможности восстановления
3. **Настроить мониторинг** производительности запросов
4. **Проверить лимиты** вашего Supabase плана

## Следующие шаги

После успешной миграции:
1. Протестируйте все функции приложения
2. Проверьте работу админ-панели
3. Убедитесь, что платежи проходят корректно
4. Проверьте работу чата поддержки
