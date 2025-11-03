# VK ID Integration - Deployment Guide

## 📋 Изменения в проекте

### Новые файлы

1. **`site/auth-vk.js`** - Модуль VK ID авторизации
2. **`site/auth-init.js`** - Универсальный инициализатор авторизации
3. **`site/registration.html`** - Страница регистрации с VK ID
4. **`migration_vk_auth.sql`** - SQL миграция для базы данных

### Обновленные файлы

1. **`api/_lib_auth.js`** - Добавлен обработчик VK ID (`handleVKLogin`)

---

## 🚀 Шаги деплоя

### 1. Обновление базы данных Supabase

```bash
# Подключитесь к Supabase и выполните миграцию
psql <YOUR_SUPABASE_CONNECTION_STRING> < migration_vk_auth.sql
```

Или через Supabase Dashboard:
1. Откройте SQL Editor
2. Скопируйте содержимое `migration_vk_auth.sql`
3. Выполните запрос

**Что добавится:**
- Колонка `vk_user_id` в таблице `clients`
- Индекс для быстрого поиска VK пользователей
- RLS политики для VK авторизации

### 2. Загрузка файлов на Vercel

Загрузите новые файлы в папку `site/`:
```bash
# Через git
git add site/auth-vk.js
git add site/auth-init.js
git add site/registration.html
git add api/_lib_auth.js
git commit -m "Add VK ID authentication support"
git push
```

Vercel автоматически задеплоит изменения.

### 3. Обновление index.html

Добавьте в `<head>` секцию `index.html` перед закрывающим тегом `</head>`:

```html
<!-- VK ID SDK (только для Android и Web) -->
<script src="https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js" defer></script>

<!-- VK Auth Module -->
<script src="auth-vk.js?v=11.3" defer></script>

<!-- Auth Initializer -->
<script src="auth-init.js?v=11.3" defer></script>
```

**Замените существующий блок `initializeTelegramAuth()` на:**

```html
<script>
    // Вся логика авторизации теперь в auth-init.js
    // Этот скрипт автоматически определит платформу и запустит нужный метод
</script>
```

### 4. Проверка переменных окружения

Убедитесь, что в Vercel настроены все необходимые переменные:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
GOOGLE_API_KEY=your-google-api-key (для OCR)
```

---

## 🧪 Тестирование

### Тест 1: VK ID авторизация (Web Browser)

1. Откройте `https://prizmatic-2004.vercel.app/registration.html` в браузере
2. Убедитесь, что отображается кнопка "Войти с VK ID"
3. Нажмите кнопку и войдите через VK
4. Проверьте:
   - Пользователь создается в таблице `clients`
   - Поле `vk_user_id` заполнено
   - Редирект на `index.html` после успеха
   - Данные сохранены в `localStorage`

**Ожидаемое поведение:**
```javascript
localStorage.getItem('userId') // UUID пользователя
localStorage.getItem('userName') // Имя из VK
localStorage.getItem('authProvider') // 'vk'
localStorage.getItem('isRegistered') // 'true'
```

### Тест 2: Telegram Mini App (старая логика)

1. Откройте бота `@pr1zmaticbot` в Telegram
2. Запустите команду `/start`
3. Откройте Web App
4. Проверьте:
   - Telegram авторизация работает как раньше
   - VK ID кнопка не показывается
   - Данные корректно сохраняются с `telegram_user_id`

### Тест 3: Платформенное определение

Откройте консоль браузера на `index.html`:

```javascript
console.log('Platform detection:', {
    isAndroidApp: typeof AndroidInterface !== 'undefined',
    isTelegramMiniApp: !!window.Telegram?.WebApp?.initData,
    isWebBrowser: !window.Telegram?.WebApp && typeof AndroidInterface === 'undefined'
});
```

**Web Browser:** Должен редиректить на `registration.html`
**Telegram:** Должен показать Telegram авторизацию
**Android (позже):** Должен редиректить на `registration.html`

---

## 📊 Проверка в Supabase

### Запросы для проверки

```sql
-- Проверить наличие колонки vk_user_id
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'vk_user_id';

-- Найти пользователей VK
SELECT id, name, vk_user_id, verification_status, created_at
FROM clients
WHERE vk_user_id IS NOT NULL;

-- Посмотреть extra данные VK пользователя
SELECT id, name, extra->>'vk_photo' as vk_photo,
       extra->>'auth_provider' as auth_provider
FROM clients
WHERE vk_user_id IS NOT NULL
LIMIT 5;
```

---

## 🐛 Отладка

### Проблема: VK SDK не загружается

**Симптом:** `VKIDSDK is not defined`

**Решение:**
1. Проверьте, что SDK подключен в `<head>`
2. Откройте Network tab - убедитесь, что `unpkg.com/@vkid/sdk` загрузился
3. Проверьте консоль на ошибки CORS

### Проблема: Backend возвращает 500 при VK login

**Симптом:** `VK authentication failed`

**Решение:**
1. Проверьте логи Vercel Functions
2. Убедитесь, что `axios` установлен: `npm install axios`
3. Проверьте, что VK access token валиден

```bash
# Проверка VK API вручную
curl "https://api.vk.com/method/users.get?user_ids=123456&fields=photo_200&access_token=YOUR_TOKEN&v=5.131"
```

### Проблема: Пользователь не создается в БД

**Симптом:** Авторизация проходит, но нет записи в `clients`

**Решение:**
1. Проверьте RLS политики в Supabase
2. Убедитесь, что `SUPABASE_SERVICE_ROLE_KEY` корректен
3. Проверьте constraint `check_auth_provider` - возможно, он блокирует вставку

```sql
-- Временно отключить constraint для теста
ALTER TABLE clients DROP CONSTRAINT IF EXISTS check_auth_provider;
```

---

## 📈 Мониторинг

### Метрики для отслеживания

```sql
-- Соотношение Telegram vs VK пользователей
SELECT
  COUNT(*) FILTER (WHERE telegram_user_id IS NOT NULL) as telegram_users,
  COUNT(*) FILTER (WHERE vk_user_id IS NOT NULL) as vk_users,
  COUNT(*) as total_users
FROM clients;

-- Активность по провайдерам
SELECT
  CASE
    WHEN telegram_user_id IS NOT NULL THEN 'telegram'
    WHEN vk_user_id IS NOT NULL THEN 'vk'
    ELSE 'unknown'
  END as auth_provider,
  COUNT(*) as users,
  COUNT(*) FILTER (WHERE verification_status = 'approved') as verified
FROM clients
GROUP BY auth_provider;
```

---

## ✅ Чеклист перед продакшеном

- [ ] SQL миграция выполнена в Supabase
- [ ] Все новые файлы загружены на Vercel
- [ ] `index.html` обновлен с новыми скриптами
- [ ] VK App ID `54250661` корректен
- [ ] Redirect URL `https://prizmatic-2004.vercel.app/` настроен в VK
- [ ] Протестирована авторизация через VK ID
- [ ] Протестирована Telegram авторизация (регрессия)
- [ ] Проверена работа в разных браузерах (Chrome, Safari, Firefox)
- [ ] Логи Vercel Functions не показывают ошибок
- [ ] RLS политики позволяют VK пользователям читать свои данные

---

## 🔄 Откат изменений

Если что-то пошло не так:

```sql
-- Откатить миграцию БД
ALTER TABLE clients DROP COLUMN vk_user_id;
DROP INDEX IF EXISTS idx_clients_vk_user_id;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS check_auth_provider;
```

```bash
# Откатить код
git revert HEAD
git push
```

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи в Vercel Dashboard → Functions → Logs
2. Проверьте SQL запросы в Supabase Dashboard → SQL Editor
3. Откройте консоль браузера (F12) и проверьте ошибки JS

**Логи для отправки:**
- Network tab (запросы к `/api/auth`)
- Console tab (ошибки JavaScript)
- Vercel Function logs (последние 50 строк)
