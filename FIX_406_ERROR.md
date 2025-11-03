# 🔧 Исправление ошибки 406 (Not Acceptable)

## Проблема
```
GET https://gkxbcgugrorsqqxjhbtj.supabase.co/rest/v1/clients?... 406 (Not Acceptable)
Error: Cannot coerce the result to a single JSON object
```

## Причина
1. ❌ База данных пустая - нет пользователей
2. ❌ RLS политики блокируют доступ
3. ❌ Пользователь с таким ID не существует

## Быстрое решение ⚡

### Шаг 1: Выполните скрипт исправления

Откройте **SQL Editor** в Supabase:
```
https://supabase.com/dashboard/project/gkxbcgugrorsqqxjhbtj/sql
```

Скопируйте и выполните весь код из файла:
```
fix_database_access.sql
```

Или выполните через командную строку:
```bash
psql "postgresql://postgres:kerpat2004!!@db.gkxbcgugrorsqqxjhbtj.supabase.co:5432/postgres" < fix_database_access.sql
```

### Шаг 2: Проверьте, что данные созданы

Выполните в SQL Editor:

```sql
-- Проверка пользователей
SELECT id, name, phone, city, verification_status 
FROM public.clients;

-- Проверка тарифов
SELECT id, title, slug, price_rub 
FROM public.tariffs;

-- Проверка велосипедов
SELECT id, bike_code, model_name, status, city 
FROM public.bikes;
```

Должны увидеть:
- ✅ 1 тестового пользователя
- ✅ 4 тарифа
- ✅ 3 велосипеда

### Шаг 3: Перезагрузите приложение

1. Откройте приложение: `https://prizmatic-2004.vercel.app`
2. Нажмите Ctrl+Shift+R (жесткая перезагрузка)
3. Проверьте консоль - ошибок быть не должно

---

## Что делает скрипт

1. ✅ Исправляет RLS политики
2. ✅ Создает тестового пользователя
3. ✅ Добавляет тарифы
4. ✅ Создает тестовые велосипеды
5. ✅ Настраивает правильный доступ

---

## Альтернативное решение (если не помогло)

### Вариант A: Временно отключить RLS

```sql
-- Только для тестирования!
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bikes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariffs DISABLE ROW LEVEL SECURITY;
```

⚠️ **Внимание**: Это небезопасно для production! Используйте только для тестирования.

После проверки включите обратно:
```sql
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
-- и т.д. для всех таблиц
```

### Вариант B: Создать нового пользователя через регистрацию

1. Откройте Telegram бота
2. Запустите команду `/start register`
3. Пройдите процесс регистрации
4. После успешной регистрации пользователь появится в базе

---

## Проверка исправления

### 1. Проверьте в консоли браузера

Откройте DevTools (F12) и выполните:

```javascript
// Проверка подключения к Supabase
console.log('Supabase URL:', window.CONFIG?.SUPABASE_URL);

// Попробуйте получить тарифы
const supabase = window.supabase.createClient(
  window.CONFIG.SUPABASE_URL,
  window.CONFIG.SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from('tariffs')
  .select('*')
  .eq('is_active', true);

console.log('Tariffs:', data, 'Error:', error);
```

Должны увидеть список тарифов без ошибок.

### 2. Проверьте RLS политики

```sql
-- Список всех политик
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 3. Проверьте доступ к API

```bash
# Проверка через curl
curl -X GET \
  'https://gkxbcgugrorsqqxjhbtj.supabase.co/rest/v1/tariffs?select=*&is_active=eq.true' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.M8mN42RHgUlvft5rHiyq5kVBSoEgUQ9fJxWh_Uu5Dtw" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.M8mN42RHgUlvft5rHiyq5kVBSoEgUQ9fJxWh_Uu5Dtw"
```

Должен вернуть JSON с тарифами.

---

## Если всё ещё не работает

### Проверьте переменные окружения на Vercel

1. Откройте https://vercel.com/your-project/settings/environment-variables
2. Убедитесь что установлены:
   ```
   SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
   SUPABASE_ANON_KEY=eyJhbG...5Dtw
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...YLYE
   ```
3. Нажмите **Redeploy**

### Проверьте API endpoint

Откройте в браузере:
```
https://prizmatic-2004.vercel.app/api/config
```

Должны увидеть:
```javascript
window.CONFIG = {
  "SUPABASE_URL": "https://gkxbcgugrorsqqxjhbtj.supabase.co",
  "SUPABASE_ANON_KEY": "eyJ...",
  "CONTRACTS_API_URL": "..."
};
```

### Очистите кэш браузера

1. Откройте DevTools (F12)
2. Перейдите в Application → Storage
3. Нажмите "Clear site data"
4. Перезагрузите страницу (Ctrl+Shift+R)

---

## Миграция существующих пользователей

Если у вас есть пользователи в старой базе:

```sql
-- В старой базе: экспортируйте пользователей
COPY (
  SELECT 
    id, name, phone, city, verification_status, 
    balance_rub, role, telegram_user_id, vk_user_id
  FROM public.clients
) TO '/tmp/clients_export.csv' WITH CSV HEADER;

-- В новой базе: импортируйте
COPY public.clients (
  id, name, phone, city, verification_status, 
  balance_rub, role, telegram_user_id, vk_user_id
)
FROM '/tmp/clients_export.csv' WITH CSV HEADER;
```

Или используйте инструкцию из `MIGRATION_INSTRUCTIONS.md`.

---

## Итоговый чеклист ✅

После выполнения скрипта проверьте:

- [ ] Тарифы отображаются в базе (4 шт)
- [ ] Велосипеды созданы (3 шт)
- [ ] Тестовый пользователь существует
- [ ] Приложение загружается без ошибок 406
- [ ] Карта отображает велосипеды
- [ ] Можно зарегистрировать нового пользователя

---

**Время исправления**: ~5 минут  
**Сложность**: ⭐ Простая

Если проблема сохраняется - проверьте логи в Vercel и Supabase SQL Editor.

