# Сводка всех серверных URL в проекте

## 🌐 Основные серверы:

### 1. **Vercel (Основное приложение)**
- **URL**: `https://prizmatic-2004.vercel.app` (или `https://go-go-b-ike.vercel.app`)
- **Используется в**:
  - `bot.py` - для регистрации пользователей
  - `api/payments.js` - для redirect после оплаты
  - Документация
- **Что делает**: Основное веб-приложение, API endpoints, фронтенд

### 2. **Render.com - Contracts API (prizmatic-server)**
- **URL**: `https://gogovorprizmatic.onrender.com`
- **Переменная**: `CONTRACTS_API_URL`
- **Используется в**:
  - `site/config.js`
  - `api/config.js`
  - `site/admin.js` - генерация PDF договоров
- **Что делает**: 
  - Генерация PDF договоров
  - Генерация актов приема-передачи
  - Отправка Telegram уведомлений

### 3. **Render.com - Bot Notify**
- **URL**: `https://gogovorprizmatic.onrender.com/notify`
- **Переменная**: `BOT_NOTIFY_URL`
- **Используется в**:
  - `site/config.js`
  - `api/config.js`
- **Что делает**: Endpoint для отправки уведомлений через Telegram бота

### 4. **Ngrok - OCR Worker**
- **URL**: `https://832a1274ed7e.ngrok-free.app`
- **Переменная**: `OCR_WORKER_URL`
- **Используется в**:
  - `site/config.js`
  - `api/config.js`
- **Что делает**: OCR обработка документов через Gemini API
- **⚠️ Важно**: Ngrok URL временный! Меняется при каждом перезапуске

### 5. **API Gateway (старый?)**
- **URL**: `https://prizmagemini.onrender.com`
- **Переменная**: `API_GATEWAY_URL`
- **Используется в**: `.env`
- **Статус**: ❓ Возможно не используется

---

## 📋 Где используются URL:

### Frontend (site/config.js):
```javascript
BOT_NOTIFY_URL: 'https://gogovorprizmatic.onrender.com/notify'
OCR_WORKER_URL: 'https://832a1274ed7e.ngrok-free.app'
CONTRACTS_API_URL: 'https://gogovorprizmatic.onrender.com'
```

### Backend (api/config.js):
```javascript
BOT_NOTIFY_URL: process.env.BOT_NOTIFY_URL || 'https://gogovorprizmatic.onrender.com/notify'
OCR_WORKER_URL: process.env.OCR_WORKER_URL || 'https://832a1274ed7e.ngrok-free.app'
CONTRACTS_API_URL: process.env.CONTRACTS_API_URL || 'https://gogovorprizmatic.onrender.com'
```

### Telegram Bot (bot.py):
```python
WEBAPP_REGISTER_API = 'https://prizmatic-2004.vercel.app/api/telegram-register'
BOT_REGISTER_API = 'https://prizmatic-2004.vercel.app/api/auth'
WEB_APP_URL = 'https://prizmatic-2004.vercel.app/'
```

### Payments (api/payments.js):
```javascript
return_url: 'https://prizmatic-2004.vercel.app/profile.html?card_saved=true'
successRedirectUrl: 'https://prizmatic-2004.vercel.app/?rental_success=true'
// и другие redirect URLs
```

---

## 🔧 Что нужно обновить:

### 1. **Vercel URL** (если изменился домен):
Заменить `https://prizmatic-2004.vercel.app` на актуальный в:
- ✅ `bot.py` (3 места)
- ✅ `api/payments.js` (4 места)
- ✅ Документация

### 2. **OCR Worker URL** (Ngrok меняется часто):
Обновить `https://832a1274ed7e.ngrok-free.app` в:
- ✅ `site/config.js`
- ✅ `.env.example`
- ✅ Переменные окружения Vercel

### 3. **Contracts API URL** (если изменился):
Проверить `https://gogovorprizmatic.onrender.com` актуален ли

---

## 🎯 Рекомендации:

### 1. Использовать переменные окружения везде:

**bot.py** - добавить env vars:
```python
WEBAPP_REGISTER_API = os.getenv('WEBAPP_URL', 'https://prizmatic-2004.vercel.app') + '/api/telegram-register'
BOT_REGISTER_API = os.getenv('WEBAPP_URL', 'https://prizmatic-2004.vercel.app') + '/api/auth'
WEB_APP_URL = os.getenv('WEBAPP_URL', 'https://prizmatic-2004.vercel.app/')
```

**api/payments.js** - использовать env var:
```javascript
const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'https://prizmatic-2004.vercel.app';
```

### 2. Заменить Ngrok на постоянный URL:

Варианты:
- Задеплоить OCR worker на Render.com (постоянный URL)
- Использовать Ngrok с платным планом (фиксированный домен)
- Использовать другой туннелинг сервис (localtunnel, serveo)

### 3. Создать единый конфиг:

```javascript
// config/servers.js
module.exports = {
  MAIN_APP: process.env.VERCEL_URL || 'https://prizmatic-2004.vercel.app',
  CONTRACTS_API: process.env.CONTRACTS_API_URL || 'https://gogovorprizmatic.onrender.com',
  OCR_WORKER: process.env.OCR_WORKER_URL || 'https://832a1274ed7e.ngrok-free.app',
  BOT_NOTIFY: process.env.BOT_NOTIFY_URL || 'https://gogovorprizmatic.onrender.com/notify'
};
```

---

## 📝 Чеклист обновления URL:

- [ ] Проверить актуальный Vercel URL
- [ ] Обновить bot.py с новым URL
- [ ] Обновить api/payments.js redirect URLs
- [ ] Обновить OCR_WORKER_URL (если ngrok перезапустился)
- [ ] Проверить CONTRACTS_API_URL работает
- [ ] Обновить переменные окружения на Vercel
- [ ] Обновить .env файлы локально
- [ ] Обновить документацию

---

## 🔍 Как найти актуальные URL:

### Vercel:
1. Зайти на vercel.com
2. Открыть проект
3. Скопировать URL из Deployments → Production

### Render.com:
1. Зайти на render.com
2. Открыть сервис (prizmatic-server)
3. Скопировать URL из Dashboard

### Ngrok:
1. Запустить ngrok: `ngrok http 3000`
2. Скопировать HTTPS URL из терминала
3. Обновить везде, где используется OCR_WORKER_URL

---

## ⚠️ Важно:

1. **Ngrok URL временный** - меняется при каждом перезапуске
2. **Vercel URL** может измениться при переименовании проекта
3. **Render URL** постоянный, но может измениться при пересоздании сервиса
4. Всегда используйте **HTTPS**, не HTTP
