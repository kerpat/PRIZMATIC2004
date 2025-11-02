# 🚀 Быстрый старт: Копирование проекта

Это краткая инструкция для копирования проекта и запуска на новом Vercel.

## 📋 Шаги:

### 1. Создать Supabase проект

1. Зайти на [supabase.com](https://supabase.com)
2. Создать новый проект
3. Скопировать:
   - Project URL → `SUPABASE_URL`
   - Project API keys → `anon` key → `SUPABASE_ANON_KEY`
   - Project API keys → `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Создать Vercel проект

1. Зайти на [vercel.com](https://vercel.com)
2. Подключить GitHub репозиторий
3. **НЕ ДЕПЛОИТЬ ЕЩЕ!** Сначала добавить переменные окружения

### 3. Добавить переменные окружения в Vercel

Зайти в **Settings → Environment Variables** и добавить:

#### Минимальный набор (обязательные):

```
WEBAPP_URL=https://your-new-app.vercel.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
YOOKASSA_SHOP_ID=your-shop-id
YOOKASSA_SECRET_KEY=your-secret-key
ADMIN_SECRET_KEY=your-random-secret-123
INTERNAL_SECRET=your-random-internal-secret-456
```

#### Дополнительные (если используете):

```
GOOGLE_API_KEY=your-google-key
GEMINI_API_KEY=your-gemini-key
YANDEX_MAPS_API_KEY=your-yandex-key
CONTRACTS_API_URL=https://your-contracts-service.onrender.com
BOT_NOTIFY_URL=https://your-bot-service.onrender.com/notify
OCR_WORKER_URL=https://your-ocr-service.onrender.com
```

**Где взять значения?** Смотрите файл `env.example`

### 4. Деплой

1. Нажать **Deploy** или **Redeploy**
2. Дождаться успешного деплоя
3. Скопировать URL проекта (например: `https://your-app-xyz.vercel.app`)

### 5. Обновить WEBAPP_URL

1. Вернуться в **Settings → Environment Variables**
2. Найти `WEBAPP_URL`
3. Изменить на реальный URL вашего проекта
4. **Save**
5. **Redeploy** проекта

### 6. Для Android приложения (если используете)

Обновить `capacitor.config.json`:

```json
{
  "server": {
    "url": "https://your-new-app.vercel.app"
  }
}
```

### 7. Проверка

Открыть в браузере:
```
https://your-new-app.vercel.app/api/config
```

Вы должны увидеть:
```javascript
window.CONFIG = {
  WEBAPP_URL: "https://your-new-app.vercel.app",
  SUPABASE_URL: "https://your-project.supabase.co",
  // ... остальные переменные
}
```

## ✅ Готово!

Проект полностью настроен и готов к использованию.

## 📝 Важно:

- ❌ **НЕ коммитьте** `.env` или `site/config.js` в git
- ✅ Все секреты только через Vercel Environment Variables
- ✅ Для каждого нового проекта создавайте новые секреты (`ADMIN_SECRET_KEY`, `INTERNAL_SECRET`)
- ✅ Используйте `env.example` как шаблон для всех переменных

## 🆘 Проблемы?

Если что-то не работает:

1. Проверьте логи в Vercel Dashboard → Deployments → Logs
2. Убедитесь что все обязательные ENV переменные установлены
3. Проверьте `/api/config` endpoint - видны ли там ваши настройки
4. Смотрите подробную документацию в `VERCEL_ENV_SETUP.md`

