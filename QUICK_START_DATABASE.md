# 🚀 Быстрый старт: Настройка новой базы данных

## Шаг 1: Создайте структуру БД ⚡

### Вариант A: Через Supabase Dashboard (рекомендуется)

1. Откройте https://gkxbcgugrorsqqxjhbtj.supabase.co
2. Перейдите в **SQL Editor**
3. Нажмите **New Query**
4. Скопируйте весь код из файла `setup_new_database.sql`
5. Вставьте в редактор
6. Нажмите **Run** (или Ctrl+Enter)

### Вариант B: Через командную строку

```bash
psql "postgresql://postgres:kerpat2004!!@db.gkxbcgugrorsqqxjhbtj.supabase.co:5432/postgres" < setup_new_database.sql
```

---

## Шаг 2: Создайте Storage Buckets 📦

**Dashboard → Storage → Create Bucket**

Создайте 3 bucket:

| Bucket Name | Public | File Size Limit |
|------------|--------|-----------------|
| `passports` | ❌ No | 10 MB |
| `support_files` | ❌ No | 10 MB |
| `contracts` | ❌ No | 5 MB |

---

## Шаг 3: Обновите Environment Variables 🔑

### 📌 Vercel

```bash
SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.M8mN42RHgUlvft5rHiyq5kVBSoEgUQ9fJxWh_Uu5Dtw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
```

**Важно**: Нажмите **Redeploy** после обновления!

### 📌 Render.com

Обновите для **обоих** сервисов:
- prizmatic-server
- ocr-worker

```bash
SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
```

### 📌 Telegram Bot

```bash
cd telegram-bot
nano .env
```

Обновите строки:
```bash
SUPABASE_URL=https://gkxbcgugrorsqqxjhbtj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGJjZ3Vncm9yc3FxeGpoYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAyMjMwOCwiZXhwIjoyMDc3NTk4MzA4fQ.lCDQgwhItZ0Jr5NPBhs6z93m1Cva4HXyXc6XsA_YLYE
```

Перезапустите бота:
```bash
sudo systemctl restart prizmatic-bot
```

---

## Шаг 4: Проверка ✅

### Запросы для проверки:

```sql
-- Проверка таблиц
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Проверка функций
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Проверка триггеров
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

### Проверка приложения:

- [ ] Открывается https://prizmatic-2004.vercel.app
- [ ] Работает вход пользователя
- [ ] Отображается карта
- [ ] Можно зарегистрироваться через Telegram
- [ ] Админ-панель доступна

---

## Если что-то пошло не так ⚠️

### Откат к старой базе:

1. **Vercel**: Измените env vars обратно на старые
2. **Render**: Измените env vars обратно на старые
3. **Telegram Bot**: Верните старые значения в `.env`
4. Redeploy все сервисы

### Проверка логов:

```bash
# Vercel
https://vercel.com/your-project/deployments → View Logs

# Render
https://render.com → Your Service → Logs

# Telegram Bot (если systemd)
sudo journalctl -u prizmatic-bot -f
```

---

## 📚 Дополнительные файлы

- `setup_new_database.sql` - SQL скрипт создания БД
- `MIGRATION_INSTRUCTIONS.md` - Полная инструкция по миграции
- `CREDENTIALS_UPDATE_SUMMARY.md` - Сводка по обновлению учетных данных

---

## 🎯 Важные ссылки

- **Новая Supabase**: https://gkxbcgugrorsqqxjhbtj.supabase.co
- **SQL Editor**: https://supabase.com/dashboard/project/gkxbcgugrorsqqxjhbtj/sql
- **Storage**: https://supabase.com/dashboard/project/gkxbcgugrorsqqxjhbtj/storage
- **Database**: https://supabase.com/dashboard/project/gkxbcgugrorsqqxjhbtj/database/tables

---

## ✨ Готово!

После выполнения всех шагов ваше приложение будет работать с новой базой данных.

**Время выполнения**: ~15-30 минут

