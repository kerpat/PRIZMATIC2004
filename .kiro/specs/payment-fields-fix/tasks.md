# Implementation Plan

- [x] 1. Создать индексы для базы данных






  - Создать индексы для быстрого поиска по полям method и payment_type
  - _Requirements: 1.1, 1.2_

- [x] 2. Обновить API создания платежей (api/payments.js)






  - [x] 2.1 Обновить функцию handleChargeFromBalance


    - Изменить запись платежа: использовать payment_type='rental' и method='balance'
    - Убрать использование устаревших типов с суффиксами
    - _Requirements: 2.3, 2.4_
  
  - [x] 2.2 Обновить функцию handleCreatePayment


    - Упростить metadata: использовать payment_type без суффиксов ('rental', 'renewal', 'top-up', 'booking')
    - Убрать логику с _card_part и _balance_part из metadata
    - Добавить комментарии о том, что поле method будет определено в webhook
    - _Requirements: 2.1, 2.2_

- [x] 3. Обновить webhook обработки платежей (api/payment-webhook.js)






  - [x] 3.1 Добавить функцию getPaymentMethodFromYookassa


    - Создать функцию для определения значения поля method из данных ЮKassa
    - Обработать типы: bank_card → 'card', sbp → 'sbp', yoo_money → 'yoo_money'
    - Установить 'card' как значение по умолчанию
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 3.2 Обновить обработку аренды (tariffId)


    - Использовать упрощенный payment_type='rental'
    - Определять значение поля method через getPaymentMethodFromYookassa
    - При записи платежа с карты указывать method из функции
    - При записи платежа с баланса указывать method='balance'
    - _Requirements: 3.1, 3.4, 3.5_
  

  - [x] 3.3 Обновить обработку бронирования


    - Использовать payment_type='booking'
    - Определять значение поля method через getPaymentMethodFromYookassa
    - _Requirements: 3.1, 3.2_

  
  - [x] 3.4 Обновить обработку пополнения баланса

    - Использовать payment_type='top-up'
    - Определять значение поля method через getPaymentMethodFromYookassa
    - _Requirements: 3.1, 3.2_

- [x] 4. Обновить админ-панель (site/admin.js)




  - [x] 4.1 Обновить маппинг названий


    - Создать объект paymentMethodLabels для способов оплаты
    - Обновить paymentTypeLabels, убрав устаревшие типы с суффиксами
    - Добавить маппинг для упрощенных типов: 'rental', 'renewal'
    - _Requirements: 4.4_
  
  - [x] 4.2 Обновить таблицу платежей


    - Изменить структуру таблицы: добавить колонку "Способ оплаты"
    - Обновить функцию рендеринга строк для отображения payment_type и method отдельно
    - Добавить CSS класс payment-method-badge для визуального отличия
    - _Requirements: 4.1, 4.2_
  
  - [x] 4.3 Обновить модальное окно деталей платежа


    - Добавить отображение поля "Способ оплаты" (из поля method) в модальном окне
    - Использовать русские названия из paymentMethodLabels
    - _Requirements: 4.3_

- [x] 5. Обновить статистику пользователя (site/stats.js)




  - [x] 5.1 Обновить маппинг названий


    - Обновить paymentTypeLabels, убрав устаревшие типы
    - Добавить paymentMethodLabels для отображения способов оплаты
    - _Requirements: 5.1, 5.2_
  
  - [x] 5.2 Обновить функцию renderHistory


    - Изменить отображение: показывать payment_type как основной заголовок
    - Добавить значение поля method в подзаголовок или описание
    - Убедиться что иконки соответствуют payment_type, а не method
    - _Requirements: 5.1, 5.2, 5.3_


- [x] 6. Добавить CSS стили для бейджей способов оплаты



  - Создать стили для .payment-method-badge
  - Добавить цветовую кодировку для разных способов оплаты (card, sbp, balance)
  - Обеспечить консистентность со стилями status-badge
  - _Requirements: 4.2_
