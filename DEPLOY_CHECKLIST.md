# 🚀 ДЕПЛОЙ - ФИНАЛЬНЫЙ ЧЕКЛИСТ

## ✅ Что сделано:

1. ✅ Создана папка `/lib` с API обработчиками
2. ✅ Создан `/api/router.js` - единая точка входа
3. ✅ Создан `.vercelignore` - игнорирует старые файлы
4. ✅ Обновлён `vercel.json` - rewrites для всех endpoints
5. ✅ Исправлен endpoint detection в router.js
6. ✅ Добавлен Content-Type для /api/config

## 🚀 ДЕПЛОЙ СЕЙЧАС:

```bash
git add .
git commit -m "Fix: API router + vercel function limit"
git push
```

## 🐛 Ожидаемые проблемы и решения:

### 1. "Cannot read properties of undefined (reading 'SUPABASE_URL')"
**Причина**: `/api/config` возвращает ошибку
**Решение**: Уже исправлено в router.js (добавлен Content-Type и fallback)

### 2. "Module not found: '../lib/XXX'"
**Причина**: Файл не скопирован в /lib
**Решение**: Проверь что все файлы есть:
```bash
ls lib/
# Должны быть: auth.js, user.js, admin.js, payments.js, payment-webhook.js,
#               getTariffByBike.js, gemini-ocr.js, storage.js, notify.js, data.js
```

### 3. "Endpoint 'XXX' not found"
**Причина**: Не добавлен в switch в router.js
**Решение**: Добавь в router.js:
```javascript
case 'XXX':
  return xxxHandler(req, res);
```

## 📊 Проверка после деплоя:

1. **Проверь количество функций в Vercel Dashboard**
   - Должно быть: **1 функция** (api/router.js)
   - Не должно быть: 13 функций

2. **Проверь логи Vercel**
   ```
   [Router] GET endpoint="config" url="/api/config"
   [Router] POST endpoint="user" url="/api/user"
   [Router] POST endpoint="auth" url="/api/auth"
   ```

3. **Проверь работу в браузере**
   - Открой DevTools → Console
   - Должно быть: `window.CONFIG = { SUPABASE_URL: "...", ... }`
   - НЕ должно быть: `Cannot read properties of undefined`

## 🎯 Если всё работает:

1. Можешь удалить старые файлы из `/api`:
   ```bash
   rm api/auth.js api/user.js api/admin.js ...
   # Оставь только api/router.js
   ```

2. Удали временные файлы:
   ```bash
   rm api/index.js
   rm api/handlers/
   ```

---

## 💡 ВАЖНО: Переменные окружения

Убедись что в Vercel Dashboard → Settings → Environment Variables есть:
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `TELEGRAM_BOT_TOKEN`
- ✅ `GOOGLE_API_KEY`
- ✅ Все остальные...

Если чего-то нет - router.js вернёт пустую строку вместо значения.

---

**Готово к деплою**: ✅ ДА
**Ожидаемый результат**: Деплой пройдёт успешно
