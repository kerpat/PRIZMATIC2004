# 🔍 Отладка проблемы "Фото не найдены" при веб-регистрации

## Проблема
При регистрации через веб-форму (не через Telegram):
- ✅ OCR данные распознаются
- ❌ Фото показывают "Фото не найдены"

## 🔧 Что исправлено

### 1. Убран эмодзи с кнопки
```html
<!-- БЫЛО -->
<button>➕ Добавить клиента</button>

<!-- СТАЛО -->
<button>Добавить клиента</button>
```

### 2. Добавлена фильтрация системных файлов
```javascript
// Фильтруем .emptyFolderPlaceholder и другие служебные файлы
const realFiles = files.filter(f => 
    f.name && 
    !f.name.startsWith('.') && 
    f.name !== '.emptyFolderPlaceholder'
);
```

### 3. Добавлено подробное логирование
```javascript
console.log('[Web Registration] Attempting to upload N files');
console.log('[Web Registration] Uploading fieldname: X bytes');
console.log('[Web Registration] ✓ Uploaded path');
console.log('[Load Photos] Found N files: [names]');
```

## 📊 Как проверить

### Шаг 1: Откройте консоль сервера
Запустите Vercel/локальный сервер с логами

### Шаг 2: Зарегистрируйтесь через веб
1. Откройте `registration.html`
2. Введите телефон
3. Подтвердите звонком
4. Загрузите фото паспорта
5. Завершите регистрацию

### Шаг 3: Проверьте логи сервера

**Ожидаемые логи:**
```
[Web Registration] Created/updated client uuid-1234...
[Web Registration] Attempting to upload 3 files for user uuid-1234...
[Web Registration] Uploading passport_main: 245678 bytes
[Web Registration] ✓ Uploaded uuid-1234.../passport_main_1698765432.jpg
[Web Registration] Uploading passport_reg: 189234 bytes
[Web Registration] ✓ Uploaded uuid-1234.../passport_reg_1698765433.jpg
[Web Registration] Successfully uploaded 2/3 files
[Web Registration] Starting OCR for user uuid-1234...
```

**Если файлы НЕ загружаются:**
```
[Web Registration] Failed to upload passport_main: Storage error message
```

### Шаг 4: Откройте админку

1. Перейдите в **Клиенты**
2. Найдите клиента
3. Нажмите **Инфо/Фото**
4. Откройте консоль браузера (F12)

**Ожидаемые логи в браузере:**
```
[Load Photos] Using folder: uuid-1234... (telegram: false, user_id: uuid-1234...)
[Load Photos] Found 2 files: ["passport_main_1698765432.jpg", "passport_reg_1698765433.jpg"]
```

**Если файлы не найдены:**
```
[Load Photos] Found 0 files: []
```

## 🐛 Возможные причины

### 1. Файлы не загружаются на сервер
**Причина:** Ошибка парсинга FormData или недостаточно прав у Service Role Key

**Решение:**
- Проверьте `SUPABASE_SERVICE_ROLE_KEY` в `.env`
- Убедитесь, что `busboy` установлен: `npm install busboy`

### 2. Файлы загружаются, но в неправильную папку
**Причина:** Проблема с `userId`

**Проверка в Supabase:**
1. Откройте **Storage** → **passports**
2. Найдите папку с UUID клиента
3. Проверьте наличие файлов

### 3. Storage bucket не публичный
**Причина:** Файлы есть, но недоступны

**Решение:**
```sql
-- Сделайте bucket публичным
UPDATE storage.buckets 
SET public = true 
WHERE name = 'passports';
```

### 4. RLS блокирует доступ
**Причина:** Row Level Security не разрешает чтение

**Решение:**
```sql
-- Разрешите публичный доступ к Storage
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'passports');
```

## ✅ Контрольный список

- [ ] Логи сервера показывают успешную загрузку файлов
- [ ] В Supabase Storage есть папка с UUID клиента
- [ ] В папке есть файлы `passport_main_*.jpg`
- [ ] Bucket `passports` публичный
- [ ] Логи браузера показывают найденные файлы
- [ ] Фото отображаются в админке

## 🔄 Если проблема остается

### Проверка 1: Прямой URL
Откройте в браузере:
```
https://YOUR_PROJECT.supabase.co/storage/v1/object/public/passports/UUID/passport_main_123.jpg
```

Если открывается → проблема в админке  
Если 404 → файл не загружен

### Проверка 2: SQL запрос
```sql
-- Проверьте файлы в Storage
SELECT name, created_at, metadata 
FROM storage.objects 
WHERE bucket_id = 'passports' 
  AND name LIKE 'UUID%'
ORDER BY created_at DESC;
```

### Проверка 3: Перезагрузите клиента
```sql
-- Удалите и создайте заново
DELETE FROM clients WHERE id = 'UUID';
```

Затем зарегистрируйтесь снова.

---

**Дата создания:** 21.10.2025  
**Файлы с изменениями:**
- `site/admin.html` - убран эмодзи
- `site/admin.js` - фильтрация и логи
- `api/auth.js` - подробное логирование загрузки
