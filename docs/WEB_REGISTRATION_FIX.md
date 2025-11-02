# 🔧 Исправление регистрации через веб-форму

## 🔍 Проблема

При регистрации **НЕ через Telegram** (обычная веб-форма или добавление админом):
- ❌ `telegram_user_id` не сохранялся (его просто нет)
- ❌ Фото загружались, но админка не могла их найти
- ❌ **Ошибка**: "Telegram ID не найден в данных клиента"

## 📊 Пути регистрации

### 1. **Через Telegram бота** ✅
```
Бот → /api/auth (action: bot-register)
  ↓
Сохраняется: telegram_user_id + фото в папке {telegram_id}/
  ↓
Админка находит фото по telegram_user_id
```

### 2. **Через веб-форму** ❌ → ✅
```
registration.html → /api/auth (FormData)
  ↓
БЫЛО: Ошибка - нет обработчика FormData
  ↓
СТАЛО: Обрабатывается, фото в папке {user_id}/
  ↓
Админка ищет по user_id если нет telegram_id
```

### 3. **Админ добавляет вручную** ✅
```
Админка → Supabase INSERT
  ↓
Без telegram_id, без фото
  ↓
Нормально: "Фото не найдены"
```

## ✅ Что исправлено

### **1. Добавлен обработчик веб-регистрации** (`/api/auth.js`)

```javascript
// Проверяем Content-Type
if (contentType.includes('multipart/form-data')) {
    // Парсим FormData с busboy
    const { fields, files } = await parseMultipartForm(req);
    
    // Создаем/обновляем клиента
    const { data: clientData } = await supabase
        .from('clients')
        .upsert([{
            phone,
            name,
            city,
            verification_status: 'pending',
            extra: { citizenship, country }
        }])
        .select()
        .single();
    
    const userId = clientData.id; // UUID клиента
    
    // Загружаем фото в Storage под user_id/
    for (const [fieldname, fileData] of Object.entries(files)) {
        await supabase.storage
            .from('passports')
            .upload(`${userId}/${fieldname}_${Date.now()}.jpg`, 
                    fileData.buffer);
    }
    
    // Запускаем OCR через Gemini
    recognized_data = await recognizeDocumentsWithGemini(...);
}
```

### **2. Исправлена админка** (`admin.js`)

**БЫЛО:**
```javascript
const telegramId = client?.extra?.telegram_user_id;

if (!telegramId) {
    throw new Error('Telegram ID не найден'); // ❌ Ошибка!
}

const files = await supabase.storage
    .from('passports')
    .list(String(telegramId));
```

**СТАЛО:**
```javascript
// Используем telegram_id если есть, иначе user_id
const telegramId = client?.extra?.telegram_user_id;
const folderId = telegramId || client.id; // ✅ Fallback!

console.log(`Using folder: ${folderId} (telegram: ${!!telegramId})`);

const files = await supabase.storage
    .from('passports')
    .list(String(folderId)); // Ищем по правильной папке
```

## 📁 Структура Storage

```
passports/
├── 123456789/              ← telegram_user_id (бот)
│   ├── passport_main.jpg
│   ├── passport_reg.jpg
│   └── video_selfie.mp4
│
├── uuid-1234-5678.../      ← user_id (веб)
│   ├── passport_main_1634567890.jpg
│   ├── passport_reg_1634567891.jpg
│   └── passport_visa_1634567892.jpg
```

## 🧪 Тестирование

### **Тест 1: Регистрация через веб-форму**
1. Откройте `registration.html`
2. Введите номер телефона
3. Подтвердите звонком
4. Выберите город и гражданство
5. Загрузите фото паспорта
6. Завершите регистрацию

**Ожидается:**
- ✅ Клиент создается с `verification_status: 'pending'`
- ✅ Фото загружаются в `passports/{user_id}/`
- ✅ OCR запускается автоматически
- ✅ Админка видит фото в модальном окне

### **Тест 2: Админ добавляет клиента**
1. Откройте админку → Клиенты
2. Нажмите "Добавить клиента"
3. Заполните форму (без фото)
4. Создайте клиента

**Ожидается:**
- ✅ Клиент создается
- ✅ При открытии: "Фото не найдены" (без ошибки)

### **Тест 3: Регистрация через бота**
1. Откройте бота в Telegram
2. Пройдите регистрацию
3. Загрузите фото

**Ожидается:**
- ✅ Клиент создается с `telegram_user_id`
- ✅ Фото в папке `{telegram_user_id}/`
- ✅ Админка находит фото

## 🔄 Миграция данных

Если у вас есть старые клиенты без фото, ничего делать не нужно.

Новые регистрации через веб будут работать правильно.

## 📝 Логи для отладки

При регистрации через веб:
```
[Web Registration] Created/updated client uuid-1234...
[Web Registration] Uploaded uuid-1234.../passport_main_1634567890.jpg
[Web Registration] Starting OCR for user uuid-1234...
[Web Registration] OCR result: { name: "...", passport_series: "..." }
```

В админке:
```
[Load Photos] Using folder: uuid-1234... (telegram: false, user_id: uuid-1234...)
```

## ⚠️ Важно

1. **Busboy** уже установлен в `/api/package.json`
2. **Gemini API** должен быть настроен (`GOOGLE_API_KEY`)
3. **Storage** `passports` должен быть публичным
4. **RLS** должен разрешать запись в `clients`

---

**Дата исправления:** 21.10.2025  
**Затронутые файлы:**
- `api/auth.js` - добавлен обработчик FormData
- `site/admin.js` - fallback на user_id
