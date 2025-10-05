# Настройка переменных окружения на Vercel

## Важно!
Файл `site/config.js` находится в `.gitignore` и не деплоится на Vercel. Вместо этого конфигурация загружается из API endpoint `/api/config`, который использует переменные окружения Vercel.

## Как настроить переменные окружения на Vercel:

### Через веб-интерфейс:

1. Откройте ваш проект на [vercel.com](https://vercel.com)
2. Перейдите в **Settings** → **Environment Variables**
3. Добавьте следующие переменные:

```
SUPABASE_URL=https://avamqfmuhiwtlumjkzmv.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YW1xZm11aGl3dGx1bWprem12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjMyODcsImV4cCI6MjA3MjIzOTI4N30.EwEPM0pObAd3v_NXI89DLcgKVYrUiOn7iHuCXXaqU4I
GOOGLE_API_KEY=AIzaSyAUay_xvRT_gcMYs3-7i8Pcli680Or5Zwk
GEMINI_API_KEY=AIzaSyAUay_xvRT_gcMYs3-7i8Pcli680Or5Zwk
TELEGRAM_BOT_TOKEN=8114516631:AAFt6cOFSdhQH1ERv0Q04fXXpBLX3GhEmJo
YOOKASSA_SHOP_ID=1107459
YOOKASSA_SECRET_KEY=live_oTnWf7sfV0ePngXm7eGdeoXewCYCbW2RXfn0PacBlrE
BOT_NOTIFY_URL=https://gemini-npxg.onrender.com/notify
OCR_WORKER_URL=https://832a1274ed7e.ngrok-free.app
ADMIN_SECRET_KEY=your_super_secret_admin_key
INTERNAL_SECRET=MySuperSecretKeyForBikeAppOCR123!
CONTRACTS_API_URL=https://gemini-npxg.onrender.com
```

4. Выберите окружения: **Production**, **Preview**, **Development** (или только Production)
5. Нажмите **Save**
6. Сделайте **Redeploy** проекта

### Через Vercel CLI:

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add GOOGLE_API_KEY
# ... и так далее для всех переменных
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

## Проверка:

После деплоя откройте в браузере:
```
https://ваш-домен.vercel.app/api/config
```

Вы должны увидеть JavaScript код с вашей конфигурацией.
