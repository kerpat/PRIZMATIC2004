# Design Document

## Overview

Данный дизайн описывает рефакторинг системы платежей для устранения путаницы между "методом оплаты" и "типом платежа". Мы разделим эти концепции на два отдельных поля в базе данных и обновим весь код для корректной работы с ними.

## Architecture

### Концептуальная модель

```
Платеж (Payment)
├── payment_type: string     // ЧТО оплачивается (rental, renewal, top-up, etc.)
├── method: string           // КАК оплачивается (card, sbp, balance)
├── amount_rub: decimal      // Сумма
├── status: string           // Статус платежа
└── description: string      // Описание
```

### Типы платежей (payment_type)

| Значение | Описание | Когда используется |
|----------|----------|-------------------|
| `rental` | Начало аренды | При создании новой аренды |
| `renewal` | Продление аренды | При продлении существующей аренды |
| `top-up` | Пополнение баланса | Когда пользователь пополняет баланс |
| `booking` | Бронирование | При создании брони |
| `refund_to_balance` | Возврат на баланс | При возврате средств |
| `adjustment` | Корректировка баланса | Ручная корректировка админом |
| `balance_debit` | Списание с баланса | Прямое списание с баланса |
| `invoice` | Оплата по счету | Оплата выставленного счета |

### Способы оплаты (поле method)

| Значение | Описание | Источник данных |
|----------|----------|----------------|
| `card` | Банковская карта | ЮKassa payment_method.type = 'bank_card' |
| `sbp` | Система быстрых платежей | ЮKassa payment_method.type = 'sbp' |
| `balance` | Баланс пользователя | Внутренняя система |

## Components and Interfaces

### 1. Database Schema Changes

#### Таблица `payments`

Используем существующее поле `method` для хранения способа оплаты.

```sql
-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_payments_method 
ON payments(method);

CREATE INDEX IF NOT EXISTS idx_payments_type 
ON payments(payment_type);
```

#### Миграция существующих данных

```sql
-- Шаг 1: Устанавливаем method='card' для платежей с типами, содержащими '_card_part'
UPDATE payments 
SET method = 'card'
WHERE payment_type LIKE '%_card_part' 
  AND method IS NULL;

-- Шаг 2: Устанавливаем method='balance' для платежей с типами, содержащими '_balance_part'
UPDATE payments 
SET method = 'balance'
WHERE payment_type LIKE '%_balance_part' 
  AND method IS NULL;

-- Шаг 3: Устанавливаем method='balance' для balance_debit
UPDATE payments 
SET method = 'balance'
WHERE payment_type = 'balance_debit' 
  AND method IS NULL;

-- Шаг 4: Для остальных платежей с yookassa_payment_id устанавливаем 'card'
UPDATE payments 
SET method = 'card'
WHERE yookassa_payment_id IS NOT NULL 
  AND method IS NULL;

-- Шаг 5: Упрощаем старые типы платежей
UPDATE payments 
SET payment_type = 'rental'
WHERE payment_type IN ('initial', 'initial_card_part', 'initial_balance_part');

UPDATE payments 
SET payment_type = 'renewal'
WHERE payment_type IN ('renewal_card_part', 'renewal_balance_part');
```

### 2. API Endpoints Updates

#### 2.1 `api/payments.js` - handleCreatePayment

**Изменения:**
- Определяем `payment_method` на основе выбранного способа оплаты
- Передаем в metadata только `payment_type` (без суффиксов _card_part)
- При создании платежа через ЮKassa указываем способ оплаты

**Логика определения способа оплаты:**
```javascript
// В metadata передаем:
metadata: {
    userId,
    tariffId,
    payment_type: 'rental' | 'renewal' | 'top-up' | 'booking',
    // поле method будет определено в webhook на основе данных от ЮKassa
}
```

#### 2.2 `api/payments.js` - handleChargeFromBalance

**Изменения:**
- При записи платежа устанавливаем `method: 'balance'`
- Используем `payment_type: 'rental'` (без суффикса)

```javascript
await supabaseAdmin.from('payments').insert({
    client_id: userId,
    rental_id: newRental.id,
    amount_rub: rentalCost,
    status: 'succeeded',
    payment_type: 'rental',        // ЧТО
    method: 'balance',             // КАК
    description: `Аренда велосипеда #${bikeId}`
});
```

#### 2.3 `api/payment-webhook.js` - processSucceededPayment

**Изменения:**
- Извлекаем способ оплаты из данных ЮKassa и записываем в поле `method`
- Используем упрощенные типы платежей
- При частичной оплате создаем две записи с разными значениями поля method

**Логика определения способа оплаты:**
```javascript
function getPaymentMethodFromYookassa(paymentObject) {
    const methodType = paymentObject.payment_method?.type;
    
    switch(methodType) {
        case 'bank_card':
            return 'card';
        case 'sbp':
            return 'sbp';
        case 'yoo_money':
            return 'yoo_money';
        default:
            return 'card'; // По умолчанию
    }
}
```

**Пример записи для аренды с частичной оплатой:**
```javascript
// Запись для оплаты картой
await supabaseAdmin.from('payments').insert({
    client_id: userId,
    rental_id: newRental.id,
    amount_rub: cardPaymentAmount,
    status: 'succeeded',
    payment_type: 'rental',
    method: getPaymentMethodFromYookassa(payment),
    yookassa_payment_id: yookassaPaymentId
});

// Запись для списания с баланса (если было)
if (amountToDebit > 0) {
    await supabaseAdmin.from('payments').insert({
        client_id: userId,
        rental_id: newRental.id,
        amount_rub: amountToDebit,
        status: 'succeeded',
        payment_type: 'rental',
        method: 'balance',
        description: 'Частичная оплата с баланса'
    });
}
```

### 3. Frontend Updates

#### 3.1 `site/admin.js` - Таблица платежей

**Изменения в структуре таблицы:**

```html
<table id="payments-table">
    <thead>
        <tr>
            <th>ID</th>
            <th>Клиент</th>
            <th>Тип платежа</th>      <!-- payment_type -->
            <th>Способ оплаты</th>     <!-- payment_method -->
            <th>Сумма</th>
            <th>Статус</th>
            <th>Дата</th>
        </tr>
    </thead>
</table>
```

**Маппинг для отображения:**

```javascript
const paymentTypeLabels = {
    'rental': 'Аренда',
    'renewal': 'Продление',
    'top-up': 'Пополнение баланса',
    'booking': 'Бронирование',
    'refund_to_balance': 'Возврат на баланс',
    'adjustment': 'Корректировка',
    'balance_debit': 'Списание с баланса',
    'invoice': 'Оплата по счету'
};

const paymentMethodLabels = {
    'card': 'Карта',
    'sbp': 'СБП',
    'balance': 'Баланс',
    'yoo_money': 'ЮMoney'
};
```

**Функция рендеринга строки:**

```javascript
function renderPaymentRow(payment) {
    const typeLabel = paymentTypeLabels[payment.payment_type] || payment.payment_type;
    const methodLabel = paymentMethodLabels[payment.method] || payment.method || 'Не указан';
    
    return `
        <tr>
            <td>${payment.id}</td>
            <td>${payment.client_id}</td>
            <td>${typeLabel}</td>
            <td><span class="payment-method-badge ${payment.method}">${methodLabel}</span></td>
            <td>${payment.amount_rub} ₽</td>
            <td>${createStatusBadge(payment.status, 'payment')}</td>
            <td>${new Date(payment.created_at).toLocaleString('ru-RU')}</td>
        </tr>
    `;
}
```

#### 3.2 `site/stats.js` - История операций пользователя

**Изменения:**
- Отображаем тип операции (payment_type) как основной заголовок
- Показываем способ оплаты (поле method) в подзаголовке или описании

```javascript
function renderHistoryItem(item) {
    const typeLabel = paymentTypeLabels[item.payment_type] || 'Операция';
    const methodLabel = paymentMethodLabels[item.method] || '';
    const subtitle = methodLabel ? `${methodLabel} • ${formatTime(item.created_at)}` : formatTime(item.created_at);
    
    return `
        <div class="history-item">
            <div class="history-item-left">
                <div class="history-icon-wrapper ${item.payment_type}">
                    ${getIconForPaymentType(item.payment_type)}
                </div>
                <div class="history-details">
                    <span class="history-title">${typeLabel}</span>
                    <span class="history-subtitle">${subtitle}</span>
                </div>
            </div>
            <div class="history-cost ${item.amount_rub > 0 ? 'positive' : 'negative'}">
                ${item.amount_rub > 0 ? '+' : ''}${item.amount_rub} ₽
            </div>
        </div>
    `;
}
```

## Data Models

### Payment Model (обновленная)

```typescript
interface Payment {
    id: number;
    client_id: number;
    rental_id?: number;
    booking_id?: number;
    amount_rub: number;
    status: 'succeeded' | 'pending' | 'canceled' | 'failed' | 'refunded';
    payment_type: 'rental' | 'renewal' | 'top-up' | 'booking' | 'refund_to_balance' | 'adjustment' | 'balance_debit' | 'invoice';
    method: 'card' | 'sbp' | 'balance' | 'yoo_money';
    yookassa_payment_id?: string;
    description?: string;
    created_at: string;
}
```

## Error Handling

### Обработка отсутствующего способа оплаты

Если при чтении старых данных поле `method` отсутствует:

```javascript
function getPaymentMethod(payment) {
    if (payment.method) {
        return payment.method;
    }
    
    // Fallback для старых данных
    if (payment.payment_type?.includes('_balance_part') || payment.payment_type === 'balance_debit') {
        return 'balance';
    }
    
    if (payment.yookassa_payment_id) {
        return 'card';
    }
    
    return 'unknown';
}
```

### Валидация при создании платежа

```javascript
function validatePaymentData(paymentType, method) {
    const validTypes = ['rental', 'renewal', 'top-up', 'booking', 'refund_to_balance', 'adjustment', 'balance_debit', 'invoice'];
    const validMethods = ['card', 'sbp', 'balance', 'yoo_money'];
    
    if (!validTypes.includes(paymentType)) {
        throw new Error(`Invalid payment_type: ${paymentType}`);
    }
    
    if (!validMethods.includes(method)) {
        throw new Error(`Invalid method: ${method}`);
    }
}
```

## Testing Strategy

### Unit Tests

1. **Тест маппинга способа оплаты из ЮKassa**
   - Проверка корректного определения типа оплаты из данных ЮKassa
   - Проверка fallback значений

2. **Тест миграции данных**
   - Проверка корректного преобразования старых типов
   - Проверка установки поля method для существующих записей

3. **Тест валидации**
   - Проверка отклонения невалидных значений
   - Проверка принятия валидных значений

### Integration Tests

1. **Тест создания платежа через карту**
   - Создание платежа через API
   - Проверка webhook обработки
   - Проверка корректности записи в БД

2. **Тест создания платежа через баланс**
   - Списание с баланса
   - Проверка корректности записи payment_method='balance'

3. **Тест частичной оплаты**
   - Создание платежа с частичной оплатой балансом
   - Проверка создания двух записей с разными значениями поля method

### Manual Testing Checklist

- [ ] Создание аренды через карту
- [ ] Создание аренды через баланс
- [ ] Создание аренды с частичной оплатой
- [ ] Продление аренды через карту
- [ ] Продление аренды через баланс
- [ ] Пополнение баланса
- [ ] Создание бронирования
- [ ] Отображение платежей в админ-панели
- [ ] Отображение истории операций пользователя
- [ ] Фильтрация платежей по типу
- [ ] Фильтрация платежей по способу оплаты

## Migration Plan

### Этап 1: Подготовка базы данных
1. Создать индексы для полей `method` и `payment_type`
2. Выполнить миграцию существующих данных

### Этап 2: Обновление backend
1. Обновить `api/payments.js`
2. Обновить `api/payment-webhook.js`
3. Добавить функции валидации

### Этап 3: Обновление frontend
1. Обновить `site/admin.js` (таблица платежей)
2. Обновить `site/stats.js` (история операций)
3. Добавить CSS стили для бейджей способов оплаты

### Этап 4: Тестирование
1. Провести unit тесты
2. Провести integration тесты
3. Провести manual testing

### Этап 5: Деплой
1. Применить миграцию БД на production
2. Задеплоить обновленный код
3. Мониторинг логов и ошибок
