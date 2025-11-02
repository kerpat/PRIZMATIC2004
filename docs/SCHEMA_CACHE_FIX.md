# Решение проблемы "Could not find table in schema cache"

## Проблема
После создания таблиц Supabase не видит их из-за устаревшего schema cache.

Ошибка: `Could not find the table 'public.batteries' in the schema cache`

## Решение

### Способ 1: Через Supabase Dashboard (Самый простой)

1. Откройте ваш проект на [supabase.com](https://supabase.com)
2. Перейдите в **Settings** → **API**
3. Найдите секцию **Configuration**
4. Нажмите кнопку **Reload schema cache** или **Restart API server**
5. Подождите 10-30 секунд

### Способ 2: Через SQL Editor

1. Откройте **SQL Editor** в Supabase Dashboard
2. Выполните команду:
```sql
NOTIFY pgrst, 'reload schema';
```
3. Подождите 10-30 секунд

### Способ 3: Автоматическое обновление (подождать)

Supabase автоматически обновляет schema cache каждые **1-2 минуты**. Просто подождите и обновите страницу.

## Проверка

После обновления кэша выполните проверку:

### 1. Проверьте, что таблица существует:
```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'batteries';
```

### 2. Попробуйте выполнить запрос:
```sql
SELECT * FROM public.batteries LIMIT 1;
```

### 3. Проверьте через Supabase JS:
```javascript
const { data, error } = await supabase
  .from('batteries')
  .select('*')
  .limit(1);

console.log('Data:', data);
console.log('Error:', error);
```

## Если проблема не решается

### 1. Проверьте права доступа:
```sql
-- Дайте права на таблицу
GRANT ALL ON public.batteries TO authenticated;
GRANT ALL ON public.batteries TO anon;
GRANT ALL ON public.batteries TO service_role;
```

### 2. Проверьте, что таблица в правильной схеме:
```sql
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename = 'batteries';
```

### 3. Пересоздайте таблицу с правами:
```sql
-- Удалите таблицу (ОСТОРОЖНО: удалит данные!)
DROP TABLE IF EXISTS public.batteries CASCADE;

-- Создайте заново
CREATE TABLE public.batteries (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    serial_number text NOT NULL UNIQUE,
    capacity_wh integer,
    description text,
    status text NOT NULL DEFAULT 'available'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT batteries_pkey PRIMARY KEY (id)
);

-- Дайте права
GRANT ALL ON public.batteries TO authenticated, anon, service_role;

-- Обновите кэш
NOTIFY pgrst, 'reload schema';
```

### 4. Перезапустите проект (крайняя мера):

В Supabase Dashboard:
1. Перейдите в **Settings** → **General**
2. Найдите секцию **Pause project**
3. Нажмите **Pause project**
4. Подождите 1 минуту
5. Нажмите **Resume project**

⚠️ **Внимание**: Это приведет к временной недоступности базы данных (1-2 минуты).

## Профилактика

Чтобы избежать проблем в будущем:

1. **После каждого изменения схемы** выполняйте:
```sql
NOTIFY pgrst, 'reload schema';
```

2. **Используйте миграции** вместо ручного создания таблиц

3. **Проверяйте права доступа** при создании новых таблиц:
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
```

4. **Используйте Supabase CLI** для локальной разработки:
```bash
supabase db reset
supabase db push
```

## Дополнительная информация

- [Supabase PostgREST Documentation](https://postgrest.org/en/stable/admin.html#schema-reloading)
- [Supabase Schema Cache](https://supabase.com/docs/guides/api/using-custom-schemas)
