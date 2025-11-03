# 🤖 PRIZMATIC Telegram Bot

Telegram-бот для регистрации курьеров в сервисе PRIZMATIC. Собирает документы, проверяет данные и отправляет их в собственное API.

## 📋 Функционал

- ✅ Регистрация пользователей через Telegram
- 📸 Сбор документов (паспорт, патент, водительские права)
- 🔍 OCR распознавание документов через Google Gemini
- 📤 Загрузка файлов в self-hosted хранилище (через /api/storage-upload)
- 🔔 Уведомления админам о новых заявках
- 🌐 HTTP-сервер для уведомлений от админ-панели

## 🚀 Установка

### 1. Установите зависимости

```bash
cd telegram-bot
pip install -r requirements.txt
```

### 2. Настройте переменные окружения

Скопируйте `.env.example` в `.env` и заполните своими данными:

```bash
cp .env.example .env
nano .env
```

Обязательные переменные:
- `TELEGRAM_BOT_TOKEN` - токен вашего бота от @BotFather
- `WEB_APP_URL` - URL веб-приложения (для кнопок и API)
- `BOT_REGISTER_API` - endpoint авторизации/регистрации (`https://your-app/api/auth`)
- `STORAGE_UPLOAD_API` - endpoint загрузки файлов (`https://your-app/api/storage-upload`)
- `GOOGLE_API_KEY` - API ключ Google Gemini для OCR

### 3. Добавьте необходимые файлы

Убедитесь, что в папке есть:
- `soglashenie.docx` - пользовательское соглашение
- `prilozhenie.docx` - приложение к соглашению
- `IMG_7164.MP4` - видео-инструкция для пользователей

### 4. Настройте ID админов

В файле `bot.py` найдите строку:

```python
ADMIN_IDS = [752012766]  # <--- ЗАМЕНИТЕ НА РЕАЛЬНЫЕ ID АДМИНОВ
```

Замените на Telegram ID ваших администраторов.

## 🏃 Запуск

### Локально

```bash
python bot.py
```

### На сервере (с screen)

```bash
screen -S prizmatic-bot
python bot.py
# Нажмите Ctrl+A, затем D для отключения
```

### С помощью systemd (рекомендуется для production)

Создайте файл `/etc/systemd/system/prizmatic-bot.service`:

```ini
[Unit]
Description=PRIZMATIC Telegram Bot
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/telegram-bot
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 bot.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable prizmatic-bot
sudo systemctl start prizmatic-bot
sudo systemctl status prizmatic-bot
```

## 🐳 Docker

### Создайте Dockerfile:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "bot.py"]
```

### Запустите:

```bash
docker build -t prizmatic-bot .
docker run -d --name prizmatic-bot --env-file .env prizmatic-bot
```

## ☁️ Деплой на Render.com

1. Создайте новый **Web Service** на render.com
2. Подключите ваш GitHub репозиторий
3. Настройки:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python bot.py`
   - **Environment**: Python 3
4. Добавьте все переменные из `.env` в Environment Variables
5. Deploy!

## 📡 API Endpoints

Бот запускает HTTP-сервер на порту **8080**:

- `POST /notify` - отправка уведомлений пользователям от админ-панели

Пример запроса:

```bash
curl -X POST http://your-server:8080/notify \
  -H "Authorization: Bearer your_super_secret_admin_key" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123456789, "text": "Ваша заявка одобрена!"}'
```

## 🔧 Структура файлов

```
telegram-bot/
├── bot.py                 # Основной код бота
├── ocr.py                 # Модуль OCR через Gemini
├── requirements.txt       # Python зависимости
├── .env                   # Переменные окружения (не в git)
├── .env.example          # Пример переменных
├── .gitignore            # Игнорируемые файлы
├── README.md             # Эта инструкция
├── soglashenie.docx      # Пользовательское соглашение
├── prilozhenie.docx      # Приложение к соглашению
└── IMG_7164.MP4          # Видео-инструкция
```

## 📝 Логи

Бот пишет логи в консоль. Для сохранения в файл:

```bash
python bot.py >> bot.log 2>&1
```

Или используйте systemd для автоматического управления логами.

## 🐛 Troubleshooting

### Бот не отвечает
- Проверьте правильность `TELEGRAM_BOT_TOKEN`
- Убедитесь, что бот запущен: `ps aux | grep bot.py`

### Ошибки загрузки файлов
- Проверьте URL `STORAGE_UPLOAD_API`
- Убедитесь, что на сервере доступен bucket `passports`

### OCR не работает
- Проверьте `GOOGLE_API_KEY`
- Убедитесь, что у вас есть квота на Gemini API

### Файлы не найдены
- Убедитесь, что `soglashenie.docx`, `prilozhenie.docx` и `IMG_7164.MP4` находятся в папке с ботом

## 📞 Поддержка

При возникновении проблем проверьте логи:

```bash
# Если используете systemd
sudo journalctl -u prizmatic-bot -f

# Если используете screen
screen -r prizmatic-bot
```
