# VK ID Integration - Test Plan

## 🎯 Цель тестирования

Убедиться, что VK ID авторизация работает корректно на всех платформах, не ломает существующую Telegram авторизацию, и готова к деплою.

---

## 📋 Тестовые сценарии

### Сценарий 1: Первая регистрация через VK ID (Web)

**Предусловия:**
- Пользователь не зарегистрирован
- Открыт браузер (Chrome/Safari/Firefox)
- VK аккаунт активен

**Шаги:**
1. Откройте `https://prizmatic-2004.vercel.app/registration.html`
2. Нажмите кнопку "Войти с VK ID"
3. Авторизуйтесь в VK (если не авторизованы)
4. Разрешите доступ приложению

**Ожидаемый результат:**
- ✅ Редирект на `index.html`
- ✅ В localStorage:
  ```javascript
  userId: "UUID"
  userName: "Имя Фамилия"
  authProvider: "vk"
  isRegistered: "true"
  ```
- ✅ В БД создана запись:
  ```sql
  SELECT * FROM clients WHERE vk_user_id = <YOUR_VK_ID>;
  -- verification_status = 'pending'
  -- name = 'Имя Фамилия' (из VK)
  ```

---

### Сценарий 2: Повторный вход через VK ID

**Предусловия:**
- Пользователь уже зарегистрирован через VK
- localStorage очищен (симуляция нового устройства)

**Шаги:**
1. Откройте `https://prizmatic-2004.vercel.app/registration.html`
2. Нажмите "Войти с VK ID"
3. Авторизуйтесь

**Ожидаемый результат:**
- ✅ Вход без создания нового аккаунта
- ✅ `isNewUser: false` в ответе API
- ✅ Обновление `extra.last_vk_login` в БД
- ✅ Редирект на главный экран

---

### Сценарий 3: Telegram Mini App авторизация (регрессия)

**Предусловия:**
- Telegram бот `@pr1zmaticbot` активен
- Пользователь зарегистрирован через бота

**Шаги:**
1. Откройте бота в Telegram
2. Отправьте `/start`
3. Нажмите "Открыть приложение"

**Ожидаемый результат:**
- ✅ VK ID кнопка НЕ отображается
- ✅ Telegram авторизация проходит успешно
- ✅ Приложение загружается без ошибок
- ✅ В консоли: `Platform detected: { isTelegramMiniApp: true }`

---

### Сценарий 4: Платформа Web Browser (определение)

**Предусловия:**
- Обычный браузер, не Telegram WebView

**Шаги:**
1. Откройте `https://prizmatic-2004.vercel.app/index.html`
2. Откройте Console (F12)

**Ожидаемый результат:**
- ✅ Редирект на `/registration.html`
- ✅ В консоли: `[Auth Init] Platform detected: { isWebBrowser: true }`
- ✅ Отображается VK ID кнопка

---

### Сценарий 5: Обработка ошибок VK API

**Предусловия:**
- Невалидный access token

**Шаги:**
1. Модифицируйте код `auth-vk.js` для симуляции ошибки:
   ```javascript
   // В методе exchangeCode добавьте:
   throw new Error('Simulated VK error');
   ```
2. Попробуйте войти через VK ID

**Ожидаемый результат:**
- ✅ Показывается ошибка: "Ошибка входа. Попробуйте еще раз."
- ✅ Нет краша приложения
- ✅ Логи в консоли: `[VK Auth] Code exchange error: ...`

---

### Сценарий 6: Проверка RLS политик

**Предусловия:**
- Пользователь авторизован через VK ID

**Шаги:**
1. Выполните запрос от имени пользователя (Supabase client, не admin):
   ```javascript
   const { data, error } = await supabase
     .from('clients')
     .select('*')
     .eq('id', userId)
     .single();
   ```

**Ожидаемый результат:**
- ✅ Данные возвращаются
- ✅ `error = null`
- ✅ Другие пользователи не видны

---

### Сценарий 7: Миграция существующего Telegram пользователя на VK

**Предусловия:**
- Пользователь зарегистрирован через Telegram
- Хочет добавить VK ID

**Шаги:**
1. Очистите localStorage
2. Откройте `/registration.html`
3. Войдите через VK ID (используя тот же номер телефона)

**Ожидаемый результат:**
⚠️ **ВАЖНО:** Сейчас это создаст второго пользователя!

**Решение (TODO для будущего):**
Добавить проверку по номеру телефона/email и линковку аккаунтов.

---

## 🧪 Автоматизированные тесты

### API Unit Tests

Создайте файл `tests/vk-auth.test.js`:

```javascript
const handler = require('../api/_lib_auth');

describe('VK Authentication', () => {
    test('Should create new user on first VK login', async () => {
        const mockReq = {
            method: 'POST',
            body: {
                action: 'vk-login',
                authData: {
                    access_token: 'mock_token',
                    user_id: '123456'
                }
            }
        };

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        };

        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                isNewUser: true
            })
        );
    });

    test('Should return existing user on repeat login', async () => {
        // ... similar test for existing user
    });

    test('Should handle VK API errors gracefully', async () => {
        // ... test error handling
    });
});
```

### E2E Tests (Playwright)

```javascript
// tests/e2e/vk-auth.spec.js
const { test, expect } = require('@playwright/test');

test('VK ID login flow', async ({ page }) => {
    // Navigate to registration
    await page.goto('https://prizmatic-2004.vercel.app/registration.html');

    // Check VK button is visible
    const vkButton = page.locator('#vk-auth-container');
    await expect(vkButton).toBeVisible();

    // Click VK login (this will open VK popup)
    // Note: Need to handle OAuth popup
    // For real testing, use VK test accounts
});
```

---

## 🔍 Чек-лист ручного тестирования

### Функциональность

- [ ] VK ID кнопка отображается на `/registration.html`
- [ ] Кнопка корректно стилизована (340x48, border-radius 21px)
- [ ] Клик по кнопке открывает VK OAuth
- [ ] После авторизации редирект на `/index.html`
- [ ] Данные пользователя сохраняются в localStorage
- [ ] Данные пользователя сохраняются в Supabase
- [ ] Повторный вход работает (не создает дубликаты)

### Telegram (Регрессия)

- [ ] Telegram WebApp авторизация не сломалась
- [ ] VK кнопка НЕ показывается в Telegram
- [ ] Telegram пользователи могут входить как раньше
- [ ] Бот регистрация работает

### UI/UX

- [ ] Loading screen показывается во время auth
- [ ] Ошибки отображаются красиво (не alert())
- [ ] Анимации работают плавно
- [ ] Адаптивность на мобильных (< 400px ширина)

### Безопасность

- [ ] Access tokens не логируются в консоль
- [ ] HTTPS используется везде
- [ ] RLS политики защищают данные других пользователей
- [ ] VK App Secret не в коде (используется серверная валидация)

### Performance

- [ ] VK SDK загружается асинхронно
- [ ] Нет блокировки основного потока
- [ ] Time to Interactive < 3 секунд
- [ ] Lighthouse score > 90

---

## 📊 Метрики успеха

После деплоя отслеживайте:

1. **Конверсия регистрации:**
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users,
     COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days' AND verification_status = 'approved') as verified
   FROM clients
   WHERE vk_user_id IS NOT NULL;
   ```

2. **Ошибки авторизации:**
   - Vercel Functions → Error Rate
   - Должен быть < 1%

3. **Время авторизации:**
   - Average: < 2 секунд
   - P95: < 5 секунд

---

## 🐛 Известные проблемы

### 1. Дублирование пользователей

**Описание:** Если пользователь зарегистрирован через Telegram, а потом входит через VK, создается второй аккаунт.

**Обходное решение:** Пока нет. TODO для v2.

**Долгосрочное решение:**
- Добавить проверку по email/phone
- Реализовать account linking

### 2. VK SDK не загружается в некоторых странах

**Описание:** unpkg.com может быть заблокирован.

**Решение:**
- Скачать SDK и хостить локально на Vercel
- Fallback на альтернативный CDN

### 3. iOS Safari блокирует popup

**Описание:** OAuth popup блокируется Safari.

**Решение:**
- Использовать redirect flow вместо popup
- Уже реализовано в `responseMode: Callback`

---

## ✅ Критерии приемки

VK ID интеграция считается успешной, если:

1. ✅ Все 7 тестовых сценариев пройдены
2. ✅ Telegram авторизация не сломалась
3. ✅ Error rate < 1% за первую неделю
4. ✅ Lighthouse performance > 90
5. ✅ Нет критических багов в production
6. ✅ Минимум 10 успешных VK регистраций

---

## 📞 Контакты для баг-репортов

Если нашли баг:
1. Откройте issue на GitHub (если используете)
2. Укажите:
   - Браузер и версию
   - Шаги воспроизведения
   - Скриншот/видео
   - Логи консоли (F12)
   - Network запросы (особенно `/api/auth`)

---

## 🔄 Следующие шаги после тестирования

1. ✅ Исправить найденные баги
2. ✅ Обновить документацию
3. ✅ Деплой на production
4. ✅ Мониторинг метрик 7 дней
5. ✅ Собрать фидбек от первых пользователей
