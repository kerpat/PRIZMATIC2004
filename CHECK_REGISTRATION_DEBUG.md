# 🔍 Как проверить загрузку фото без логов Vercel

## Проблема
Логи на Vercel не отображаются, но нужно понять загрузились ли фото.

## ✅ Решение: Отладочная информация в консоли браузера

Теперь после регистрации в **консоли браузера** выводится полная информация о загрузке:

```
═══════════════════════════════════════
📊 ОТЛАДКА ЗАГРУЗКИ ФОТО:
═══════════════════════════════════════
✓ Файлов получено: 3
✓ Файлов загружено: 3
✓ Пути загруженных файлов:
  → uuid-1234.../passport_main_1698765432.jpg
  → uuid-1234.../passport_reg_1698765433.jpg
  → uuid-1234.../passport_visa_1698765434.jpg
✓ OCR запущен: Да
✓ Распознано полей: 8
═══════════════════════════════════════
```

## 📊 Как проверить

### Вариант 1: Смотреть в реальном времени

1. Откройте **registration.html**
2. **Откройте консоль браузера (F12)** → вкладка **Console**
3. Пройдите регистрацию
4. **НЕ ЗАКРЫВАЙТЕ консоль!** - информация выведется перед редиректом
5. У вас есть **2 секунды** чтобы увидеть логи

### Вариант 2: Посмотреть после редиректа

Информация сохраняется в `localStorage`, поэтому её можно посмотреть **после** редиректа:

1. Откройте любую страницу (например `index.html`)
2. Откройте **консоль браузера (F12)**
3. Введите команду:
```javascript
JSON.parse(localStorage.getItem('lastRegistrationDebug'))
```

4. Вы увидите объект:
```javascript
{
  filesReceived: 3,
  filesUploaded: 3,
  uploadedPaths: [
    "uuid-1234.../passport_main_123.jpg",
    "uuid-1234.../passport_reg_124.jpg"
  ],
  ocrAttempted: true,
  recognizedFields: 8
}
```

## 🔍 Что означают значения

### ✅ Всё работает:
```javascript
{
  filesReceived: 3,      // ← Браузер отправил 3 файла
  filesUploaded: 3,      // ← Все 3 загрузились
  uploadedPaths: [...],  // ← Пути в Storage
  ocrAttempted: true,    // ← OCR запустился
  recognizedFields: 8    // ← Распознано 8 полей
}
```

### ❌ Файлы не загрузились:
```javascript
{
  filesReceived: 3,      // ← Файлы были отправлены
  filesUploaded: 0,      // ← НО загрузилось 0! ПРОБЛЕМА!
  uploadedPaths: [],     // ← Пусто
  ocrAttempted: false,   // ← OCR не запустился
  recognizedFields: 0    // ← Ничего не распознано
}
```

**Причины:**
- ❌ Ошибка прав в Supabase Storage
- ❌ Bucket `passports` не существует
- ❌ Service Role Key неправильный

### ⚠️ Файлы загрузились частично:
```javascript
{
  filesReceived: 3,      // ← Отправлено 3
  filesUploaded: 2,      // ← Загрузилось только 2
  uploadedPaths: [       // ← Какие именно
    "uuid.../passport_main_123.jpg",
    "uuid.../passport_reg_124.jpg"
  ],
  ocrAttempted: true,
  recognizedFields: 5
}
```

**Причина:** Один из файлов слишком большой или битый

## 🛠️ Решение проблем

### Если `filesUploaded: 0`

**Шаг 1:** Проверьте Supabase Storage
1. Откройте **Supabase Dashboard** → **Storage**
2. Убедитесь что bucket **`passports`** существует
3. Проверьте что он **public**

**Шаг 2:** Проверьте права
```sql
-- Выполните в SQL Editor Supabase
SELECT * FROM storage.buckets WHERE name = 'passports';
```

Должно быть: `public: true`

**Шаг 3:** Проверьте `.env` на Vercel
- Зайдите в **Settings** → **Environment Variables**
- Проверьте `SUPABASE_SERVICE_ROLE_KEY`
- Должен начинаться с `eyJ...`

### Если частичная загрузка

**Проверьте размер файлов:**
```javascript
// В консоли браузера перед регистрацией
document.querySelector('input[type="file"]').files[0].size
```

Если больше 5MB → сожмите фото

## 📝 Дополнительные команды для консоли

### Посмотреть все сохраненные данные регистрации:
```javascript
console.table({
  userId: localStorage.getItem('userId'),
  userName: localStorage.getItem('userName'),
  userPhone: localStorage.getItem('userPhone'),
  debug: JSON.parse(localStorage.getItem('lastRegistrationDebug'))
});
```

### Очистить отладочные данные:
```javascript
localStorage.removeItem('lastRegistrationDebug');
```

### Посмотреть сырые данные:
```javascript
console.log(localStorage.getItem('lastRegistrationDebug'));
```

---

**Дата:** 21.10.2025  
**Файлы:** 
- `api/auth.js` - добавлен debug в ответ
- `site/registration.js` - вывод в консоль
