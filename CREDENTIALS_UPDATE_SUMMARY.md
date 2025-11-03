# Обновление учетных данных Supabase

## Дата обновления: 2 ноября 2025

## Старые учетные данные (заменены):
- **URL**: `https://avamqfmuhiwtlumjkzmv.supabase.co`
- **Anon Key**: `eyJhbG...qU4I` (старый ключ)

## Новые учетные данные:
- **URL**: `https://gkxbcgugrorsqqxjhbtj.supabase.co`
- **Project URL**: `https://gkxbcgugrorsqqxjhbtj.supabase.co`
- **Anon Public Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.M8mN42RHgUlvft5rHiyq5kVBSoEgUQ9fJxWh_Uu5Dtw`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE`
- **PostgreSQL Connection**: `postgresql://postgres:kerpat2004!!@db.gkxbcgugrorsqqxjhbtj.supabase.co:5432/postgres`

## Обновленные файлы:

### 1. API файлы:
- ✅ `api/config.js` - обновлены fallback значения
- ✅ `api/router.js` - обновлены fallback значения в config endpoint

### 2. Frontend файлы:
- ✅ `site/config.example.js` - обновлены примеры конфигурации
- ✅ `site/map.html` - обновлены хардкоженные константы

### 3. Документация:
- ✅ `VERCEL_ENV_SETUP.md` - обновлены инструкции для Vercel
- ✅ `CONFIGURATION.md` - обновлены примеры конфигурации
- ✅ `SERVER_FILES_AUDIT.md` - обновлены примеры переменных окружения

## Файлы, использующие переменные окружения (не требуют изменений):
- ✅ `lib/data.js` - использует `process.env.SUPABASE_URL`
- ✅ `lib/payments.js` - использует переменные окружения
- ✅ `api/_lib_data.js` - использует `process.env.SUPABASE_URL`
- ✅ `api/_lib_payments.js` - использует переменные окружения
- ✅ `bot.py` - использует `os.getenv('SUPABASE_URL')`
- ✅ `ocr-worker/server.js` - использует `process.env.SUPABASE_URL`

## Следующие шаги:

### 1. Обновить переменные окружения на Vercel:
```bash
# Войдите в настройки проекта на vercel.com
# Settings → Environment Variables
# Обновите следующие переменные:

SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.M8mN42RHgUlvft5rHiyq5kVBSoEgUQ9fJxWh_Uu5Dtw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
```

### 2. Обновить переменные окружения на Render.com:
Для `prizmatic-server` и `ocr-worker`:
```bash
SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
```

### 3. Обновить .env файл для Telegram Bot:
```bash
cd telegram-bot
# Отредактируйте .env файл:
SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
# Перезапустите бота
```

### 4. Создать локальный config.js для разработки:
```bash
cd site
cp config.example.js config.js
# Файл config.js уже содержит новые учетные данные
```

### 5. Redeploy всех сервисов:
- ✅ Vercel - сделайте redeploy после обновления env vars
- ✅ Render.com (prizmatic-server) - перезапустите после обновления env vars
- ✅ Render.com (ocr-worker) - перезапустите после обновления env vars
- ✅ Telegram Bot - перезапустите локально или на сервере

## Проверка:
После обновления проверьте:
1. Открытие веб-приложения и вход пользователя
2. Работу карты (site/map.html)
3. Регистрацию через Telegram Bot
4. OCR обработку документов
5. Админ-панель

## Примечания:
- ⚠️ Backup папка (`backupprizmatic/`) НЕ была обновлена (это старая резервная копия)
- ⚠️ Убедитесь, что старая база данных мигрирована в новую Supabase инстанцию
- ⚠️ Проверьте, что все таблицы и Storage buckets существуют в новом проекте

