# 🚀 Локальный запуск OCR Worker

## 📋 Предварительные требования

1. **Node.js** версии 18+ ([скачать](https://nodejs.org/))
2. **npm** (идет в комплекте с Node.js)
3. **Аккаунт на Render** для тестирования ([render.com](https://render.com))

## ⚙️ Настройка

### 1. Клонируйте и перейдите в папку
```bash
cd ocr-worker
```

### 2. Установите зависимости
```bash
npm install
```

### 3. Настройте переменные окружения

Скопируйте шаблон и заполните реальными значениями:
```bash
cp .env.example .env
```

Заполните `.env` файл:

```env
# PostgreSQL (VPS)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=prizmatic
DB_USER=prizmatic_user
DB_PASSWORD=ваш_пароль
DB_SSL=true

# Telegram Bot
TELEGRAM_BOT_TOKEN=ваш_токен_бота

# Google Gemini
GEMINI_API_KEY=ваш_gemini_api_key

# Секрет для защиты API
INTERNAL_SECRET=придумайте_сложный_секрет
```

### 4. Запуск сервера

#### Вариант 1: Простой запуск
```bash
npm start
```

#### Вариант 2: С проверками (рекомендуется)
```bash
chmod +x start-local.sh
./start-local.sh
```

Если все настроено правильно, увидите:
```
🚀 Запуск OCR Worker локально...
✅ Node.js найден: v18.17.0
✅ npm найден: 9.6.7
🔧 Проверка переменных окружения...
✅ DB_HOST
✅ DB_PORT
✅ DB_NAME
✅ DB_USER
✅ DB_PASSWORD
✅ TELEGRAM_BOT_TOKEN
✅ GEMINI_API_KEY
✅ INTERNAL_SECRET

🎯 Запуск сервера...
OCR Worker running on port 3000
Environment check:
- DB_HOST: ✓
- DB_PORT: ✓
- DB_NAME: ✓
- DB_USER: ✓
- DB_PASSWORD: ✓
- TELEGRAM_BOT_TOKEN: ✓
- GEMINI_API_KEY: ✓
- INTERNAL_SECRET: ✓
```

## 🌐 Тестирование с Vercel

Vercel не может напрямую подключиться к вашему `localhost`. Используйте **ngrok**:

### 1. Установите ngrok
```bash
# Скачайте с https://ngrok.com/download
# Распакуйте и добавьте в PATH
```

### 2. Запустите ngrok
```bash
ngrok http 3000
```

Получите URL типа: `https://abcd-1234.ngrok.io`

### 3. Обновите Vercel переменные

В настройках вашего проекта на Vercel добавьте:
```
OCR_WORKER_URL=https://abcd-1234.ngrok.io
INTERNAL_SECRET=тот_же_секрет_что_в_.env
```

### 4. Тестируйте!

Теперь когда пользователь отправит форму регистрации:
1. Vercel быстро сохранит данные
2. Асинхронно вызовет ваш локальный воркер через ngrok
3. Вы увидите логи в терминале
4. OCR обработается на вашем компьютере

## 🔍 Отладка

### Логи сервера
Все действия логируются в консоль. Следите за сообщениями типа:
- `Starting OCR processing for user xxx`
- `OCR completed successfully for user xxx`
- `OCR processing failed: [ошибка]`

### Проверка здоровья
```
GET http://localhost:3000/health
```

### Тестирование API
```bash
curl -X POST http://localhost:3000/process-document \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: ваш_секрет" \
  -d '{
    "userId": "test-user-id",
    "fileIds": [{
      "field": "passport_main",
      "file_id": "test_file_id",
      "file_unique_id": "test_unique_id"
    }]
  }'
```

## 🚀 Продакшн развертывание

Когда протестируете локально:

1. **Загрузите код на GitHub**
2. **Создайте Web Service на Render**
3. **Настройте переменные окружения на Render**
4. **Обновите Vercel переменную `OCR_WORKER_URL`**

## 🐛 Возможные проблемы

### ❌ "DB_HOST: ✗" (или другие DB_* поля)
- Проверьте корректность доступа к PostgreSQL (адрес, порт, пользователь, пароль)
- Если база требует SSL, убедитесь, что `DB_SSL=true`

### ❌ "OCR Worker running on port 3000" но не отвечает
- Проверьте firewall
- Попробуйте другой порт в `.env`: `PORT=8080`

### ❌ ngrok не работает
- Убедитесь что ngrok запущен: `ngrok http 3000`
- Используйте HTTPS URL от ngrok

### ❌ Vercel не может достучаться
- Проверьте что воркер запущен
- Проверьте INTERNAL_SECRET
- Проверьте логи Vercel Functions

## 📞 Поддержка

Если что-то не работает:
1. Проверьте логи в терминале
2. Убедитесь что все переменные окружения заполнены
3. Проверьте ключи API на валидность
4. Попробуйте перезапустить сервисы

**Удачи с тестированием! 🎯**
