# Конфигурация проекта

## Переменные окружения

Все захардкоженные значения были перенесены в централизованный файл конфигурации `site/config.js`.

### Структура конфигурации

Файл `site/config.js` содержит объект `CONFIG` со всеми необходимыми переменными:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://avamqfmuhiwtlumjkzmv.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
    GOOGLE_API_KEY: 'your-google-api-key',
    GEMINI_API_KEY: 'your-gemini-api-key',
    TELEGRAM_BOT_TOKEN: 'your-telegram-bot-token',
    YOOKASSA_SHOP_ID: 'your-shop-id',
    YOOKASSA_SECRET_KEY: 'your-secret-key',
    BOT_NOTIFY_URL: 'https://your-bot-url.com/notify',
    OCR_WORKER_URL: 'https://your-ocr-worker.com',
    ADMIN_SECRET_KEY: 'your-admin-secret',
    INTERNAL_SECRET: 'your-internal-secret',
    CONTRACTS_API_URL: 'https://your-contracts-api.com'
};
```

### Использование в коде

Все файлы теперь используют переменные из `CONFIG`:

```javascript
// Вместо:
const SUPABASE_URL = 'https://hardcoded-url.supabase.co';

// Используется:
const SUPABASE_URL = CONFIG.SUPABASE_URL;
```

### Обновленные файлы

Следующие файлы были обновлены для использования централизованной конфигурации:

- `site/profile.html`
- `site/index.html`
- `site/map.html`
- `site/stats.html`
- `site/recover.html`
- `site/api.js`
- `site/stats.js`
- `site/admin.js`
- `site/admin_support.js`

### Подключение config.js

Файл `config.js` должен быть подключен перед другими скриптами:

```html
<script src="config.js"></script>
<script>
    // Теперь можно использовать CONFIG
    const supabase = window.supabase.createClient(
        CONFIG.SUPABASE_URL, 
        CONFIG.SUPABASE_ANON_KEY
    );
</script>
```

### Безопасность

⚠️ **Важно**: Файл `site/config.js` содержит чувствительные данные и не должен коммититься в публичный репозиторий.

Рекомендуется:
1. Добавить `site/config.js` в `.gitignore`
2. Использовать `site/config.example.js` как шаблон
3. Для production использовать переменные окружения на сервере

### Пример .gitignore

```
site/config.js
.env
```

### Для разработки

1. Скопируйте `site/config.example.js` в `site/config.js`
2. Заполните актуальными значениями из `.env.example`
3. Никогда не коммитьте `site/config.js` с реальными ключами
