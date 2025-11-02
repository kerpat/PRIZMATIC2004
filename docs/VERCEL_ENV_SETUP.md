# Настройка переменных окружения на Vercel

## Важно!
Файл `site/config.js` находится в `.gitignore` и не деплоится на Vercel. Вместо этого конфигурация загружается из API endpoint `/api/config`, который использует переменные окружения Vercel.

## Как настроить переменные окружения на Vercel:

### Через веб-интерфейс:

1. Откройте ваш проект на [vercel.com](https://vercel.com)
2. Перейдите в **Settings** → **Environment Variables**
3. Добавьте следующие переменные:

```
# === WEBAPP URL ===
WEBAPP_URL=https://your-app.vercel.app

# === SUPABASE ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# === GOOGLE / GEMINI AI ===
GOOGLE_API_KEY=your-google-api-key
GEMINI_API_KEY=your-gemini-api-key

# === TELEGRAM (optional) ===
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# === MAPS ===
YANDEX_MAPS_API_KEY=your-yandex-maps-api-key

# === SMS / PHONE ===
SMS_RU_API_ID=your-sms-ru-api-id

# === VK AUTH (optional) ===
VK_APP_ID=your-vk-app-id

# === YOOKASSA PAYMENTS ===
YOOKASSA_SHOP_ID=your-yookassa-shop-id
YOOKASSA_SECRET_KEY=your-yookassa-secret-key

# === EXTERNAL SERVICES ===
BOT_NOTIFY_URL=https://your-bot-server.onrender.com/notify
OCR_WORKER_URL=https://your-ocr-worker.onrender.com
CONTRACTS_API_URL=https://your-contracts-api.onrender.com

# === SECURITY ===
ADMIN_SECRET_KEY=your-admin-secret-key
INTERNAL_SECRET=your-internal-secret-key
```

4. Выберите окружения: **Production**, **Preview**, **Development** (или только Production)
5. Нажмите **Save**
6. Сделайте **Redeploy** проекта

### Через Vercel CLI:

```bash
vercel env add WEBAPP_URL
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GOOGLE_API_KEY
vercel env add GEMINI_API_KEY
vercel env add YOOKASSA_SHOP_ID
vercel env add YOOKASSA_SECRET_KEY
vercel env add YANDEX_MAPS_API_KEY
vercel env add ADMIN_SECRET_KEY
vercel env add INTERNAL_SECRET
vercel env add BOT_NOTIFY_URL
vercel env add OCR_WORKER_URL
vercel env add CONTRACTS_API_URL
# ... и другие опциональные переменные
```

## Как это работает:

1. Все HTML файлы загружают конфигурацию через `<script src="/api/config"></script>`
2. API endpoint `/api/config` читает переменные окружения и возвращает JavaScript код
3. Код устанавливает `window.CONFIG` с актуальными значениями
4. Все скрипты используют `window.CONFIG` для доступа к настройкам

## Локальная разработка:

Для локальной разработки используйте файл `site/config.js`:
1. Скопируйте `site/config.example.js` в `site/config.js`
2. Заполните актуальными значениями
3. Файл будет работать локально, но не попадет в git

## Fallback значения:

Если переменные окружения не установлены на Vercel, API endpoint использует дефолтные значения из кода. Это обеспечивает работоспособность даже без настройки env vars.

## Описание переменных:

### Обязательные переменные:

- **WEBAPP_URL** - URL вашего приложения на Vercel (используется для redirect URLs в платежах)
- **SUPABASE_URL** - URL вашего Supabase проекта
- **SUPABASE_ANON_KEY** - Public anon key для клиентского доступа
- **SUPABASE_SERVICE_ROLE_KEY** - Service role key для серверного доступа (имеет полные права)
- **YOOKASSA_SHOP_ID** - ID магазина в ЮKassa
- **YOOKASSA_SECRET_KEY** - Секретный ключ ЮKassa

### Опциональные переменные:

- **GOOGLE_API_KEY** / **GEMINI_API_KEY** - Для OCR обработки документов
- **YANDEX_MAPS_API_KEY** - Для отображения карт
- **TELEGRAM_BOT_TOKEN** - Если используете Telegram бота
- **VK_APP_ID** - Если используете VK авторизацию
- **SMS_RU_API_ID** - Для SMS верификации телефонов
- **BOT_NOTIFY_URL** - URL сервиса уведомлений
- **OCR_WORKER_URL** - URL OCR worker сервиса
- **CONTRACTS_API_URL** - URL сервиса генерации договоров
- **ADMIN_SECRET_KEY** - Секретный ключ для админ панели
- **INTERNAL_SECRET** - Секрет для внутренних API вызовов

## Проверка:

После деплоя откройте в браузере:
```
https://ваш-домен.vercel.app/api/config
```

Вы должны увидеть JavaScript код с вашей конфигурацией.

## Чеклист для нового проекта:

1. ✅ Скопировать код проекта
2. ✅ Создать новый Supabase проект и получить credentials
3. ✅ Создать новый проект на Vercel
4. ✅ Добавить все ENV переменные в Vercel Dashboard (используйте `env.example` как шаблон)
5. ✅ Обновить WEBAPP_URL на URL вашего нового Vercel проекта
6. ✅ Для Android: обновить `capacitor.config.json` с новым WEBAPP_URL
7. ✅ Деплой на Vercel
8. ✅ Проверить `/api/config` endpoint
