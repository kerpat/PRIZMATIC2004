# 🚀 Решение проблемы лимита Vercel

## ❌ Проблема
```
Error: No more than 12 Serverless Functions can be added to a Deployment
on the Hobby plan.
```

У вас было **13 serverless функций**, а лимит Hobby плана — **12**.

## ✅ Решение

Создал **единый роутер** `api/router.js`, который обрабатывает ВСЕ endpoints.

### Как работает:

**Было** (13 функций):
```
/api/auth.js
/api/user.js
/api/admin.js
/api/payments.js
/api/payment-webhook.js
/api/getTariffByBike.js
/api/gemini-ocr.js
/api/storage.js
/api/notify.js
/api/data.js
/api/config.js
/api/generate-contract.js
/api/upload-support-attachment.js
```

**Стало** (1 функция):
```
/api/router.js  ← обрабатывает ВСЕ запросы
```

### Магия Vercel Rewrites

В `vercel.json` настроены перенаправления:

```json
{
  "rewrites": [
    { "source": "/api/auth", "destination": "/api/router?endpoint=auth" },
    { "source": "/api/user", "destination": "/api/router?endpoint=user" },
    ...
  ]
}
```

**Для пользователей ничего не изменилось!**
Они всё так же вызывают `/api/auth`, но внутри Vercel перенаправляет на роутер.

---

## 📦 Что изменено

### 1. **Создан `api/router.js`**
Единая точка входа для всех API запросов.

### 2. **Обновлён `vercel.json`**
- Убраны настройки для 13 функций
- Добавлена **ОДНА** функция: `api/router.js`
- Добавлены rewrites для обратной совместимости

### 3. **Старые файлы НЕ УДАЛЕНЫ**
Все файлы (`auth.js`, `user.js` и т.д.) остались на месте.
Роутер просто импортирует их:

```javascript
const authHandler = require('./auth');
const userHandler = require('./user');
...

switch (endpoint) {
  case 'auth':
    return authHandler(req, res);
  case 'user':
    return userHandler(req, res);
  ...
}
```

---

## 🚀 Деплой

Теперь можешь задеплоить:

```bash
git add .
git commit -m "Fix: Объединил API в один роутер для Vercel Hobby"
git push
```

Или через Vercel CLI:
```bash
vercel --prod
```

---

## ✅ Ожидаемый результат

После деплоя:
- ✅ Будет **1 serverless функция** вместо 13
- ✅ Все endpoints работают как раньше
- ✅ Нет ошибок лимита
- ✅ Бонус: холодный старт быстрее (одна функция вместо нескольких)

---

## 🎯 Бонусы оптимизации

### 1. Экономия памяти
**Было**: 13 функций × 1024 MB = 13 GB потенциальной памяти
**Стало**: 1 функция × 1024 MB = 1 GB

### 2. Быстрый холодный старт
Одна функция = один Lambda контейнер = быстрее инициализация

### 3. Проще деплоить
Меньше функций = быстрее компиляция и деплой

---

## 🔥 Альтернативные решения

Если захочешь вернуться к раздельным функциям:

### Вариант 1: Upgrade на Pro ($20/мес)
- Лимит: **100 функций**
- Приоритетная поддержка
- Больше bandwidth

### Вариант 2: Удалить ненужные endpoints
Если какие-то API не используются:
1. Убери их из `router.js`
2. Удали файлы
3. Уменьшишь количество endpoints

### Вариант 3: Миграция на Яндекс Облако
- Нет лимита на функции
- Дешевле для российского трафика
- Быстрее для пользователей из России

---

## 📝 Чеклист

- [x] Создан `api/router.js`
- [x] Обновлён `vercel.json`
- [x] Добавлены rewrites для всех endpoints
- [ ] Протестировать локально: `vercel dev`
- [ ] Задеплоить: `vercel --prod`
- [ ] Проверить работу всех endpoints

---

## 🐛 Если что-то не работает

### Проблема 1: "Module not found"
**Решение**: Проверь что все импорты в `router.js` указывают на существующие файлы:
```javascript
const authHandler = require('./auth');  // ← файл api/auth.js должен существовать
```

### Проблема 2: "Endpoint not found"
**Решение**: Добавь endpoint в `router.js`:
```javascript
case 'my-new-endpoint':
  return myNewHandler(req, res);
```

И в `vercel.json`:
```json
{
  "source": "/api/my-new-endpoint",
  "destination": "/api/router?endpoint=my-new-endpoint"
}
```

### Проблема 3: Разные ответы локально и на продакшене
**Решение**: Проверь переменные окружения в Vercel Dashboard

---

## 💡 Совет

После успешного деплоя, можешь удалить `api/index.js` и `api/data.js` (новые файлы которые я создал), т.к. их логика пока не используется. Оставь только `api/router.js` и старые файлы.

---

**Создано**: 2025-01-XX
**Версия**: 1.0
**Статус**: ✅ Готово к деплою
