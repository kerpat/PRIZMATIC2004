# OCR Worker for Bike App Registration

Этот сервис отвечает за фоновую обработку документов при регистрации пользователей в приложении Bike App.

## Архитектура

OCR Worker работает как отдельный микросервис, который:
- Получает запросы от основного API (Vercel)
- Скачивает файлы из Telegram
- Обрабатывает документы через Google Gemini
- Сохраняет результаты в Supabase
- Обновляет статусы верификации

## Развертывание на Render

### 1. Подготовка проекта

```bash
cd ocr-worker
npm install
cp .env.example .env
# Заполните .env файл реальными значениями
```

### 2. Создание Web Service на Render

1. Перейдите на [render.com](https://render.com)
2. Создайте новый **Web Service**
3. Подключите ваш GitHub репозиторий
4. Настройте параметры:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Production

### 3. Переменные окружения

Добавьте следующие переменные в настройках Render:

```
SUPABASE_URL=https://briulxpnjxlsgfgkqvfh.supabase.co
SUPABASE_ANON_KEY=ваш_ключ
TELEGRAM_BOT_TOKEN=ваш_токен_бота
GEMINI_API_KEY=ваш_gemini_ключ
INTERNAL_SECRET=секретный_ключ_для_защиты
```

## API

### POST /process-document

Обрабатывает документы пользователя.

**Заголовки:**
```
Content-Type: application/json
X-Internal-Secret: ваш_секретный_ключ
```

**Тело запроса:**
```json
{
  "userId": "uuid-пользователя",
  "fileIds": [
    {
      "field": "ru_passport_main",
      "file_id": "telegram_file_id",
      "file_unique_id": "unique_id"
    }
  ]
}
```

**Ответ при успехе:**
```json
{
  "success": true,
  "message": "OCR processing completed",
  "userId": "uuid",
  "documentType": "паспорт_рф"
}
```

### GET /health

Проверка работоспособности сервиса.

## Безопасность

- Все запросы защищены секретным ключом `X-Internal-Secret`
- Сервис принимает только внутренние запросы от основного API
- Внешний доступ заблокирован

## Мониторинг

Сервис логирует все операции в консоль. На Render логи доступны в dashboard.

## Статусы обработки

- `pending_ocr` - ожидает обработки
- `processing_ocr` - обрабатывается
- `ocr_complete` - успешно обработан
- `ocr_failed` - ошибка обработки

## Локальная разработка

```bash
npm run dev  # с nodemon для авто-перезапуска
npm start    # production режим