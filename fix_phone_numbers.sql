-- Скрипт для исправления формата телефонных номеров в БД
-- Убирает форматирование и оставляет только цифры в формате 7XXXXXXXXXX

-- Обновление основных телефонов клиентов
UPDATE clients
SET phone = REGEXP_REPLACE(phone, '\D', '', 'g')
WHERE phone IS NOT NULL AND phone ~ '\D';

-- Если номер начинается с 8, заменяем на 7
UPDATE clients
SET phone = '7' || SUBSTRING(phone FROM 2)
WHERE phone LIKE '8%';

-- Если номер не начинается с 7 и длина меньше 11, добавляем 7 в начало
UPDATE clients
SET phone = '7' || phone
WHERE phone IS NOT NULL 
  AND NOT phone LIKE '7%' 
  AND LENGTH(phone) = 10;

-- Проверка результата
SELECT 
    id,
    name,
    phone,
    LENGTH(phone) as phone_length,
    CASE 
        WHEN LENGTH(phone) = 11 AND phone LIKE '7%' THEN 'OK'
        ELSE 'NEEDS_FIX'
    END as status
FROM clients
WHERE phone IS NOT NULL
ORDER BY status DESC, created_at DESC;
