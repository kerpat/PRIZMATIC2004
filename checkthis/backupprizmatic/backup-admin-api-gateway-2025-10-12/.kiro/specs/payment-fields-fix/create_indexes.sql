-- Индексы для таблицы payments
-- Эти индексы ускорят фильтрацию платежей по полям method и payment_type

-- Индекс для поля method (тип оплаты: card, cash, balance и т.д.)
CREATE INDEX IF NOT EXISTS idx_payments_method 
ON public.payments(method);

-- Индекс для поля payment_type (тип платежа: rental, deposit, refund и т.д.)
CREATE INDEX IF NOT EXISTS idx_payments_payment_type 
ON public.payments(payment_type);

-- Составной индекс для одновременной фильтрации по обоим полям
-- Полезен когда фильтруете сразу по method И payment_type
CREATE INDEX IF NOT EXISTS idx_payments_method_payment_type 
ON public.payments(method, payment_type);

-- Индекс для поля status (если будете фильтровать по статусу)
CREATE INDEX IF NOT EXISTS idx_payments_status 
ON public.payments(status);

-- Индекс для created_at (для сортировки по дате)
CREATE INDEX IF NOT EXISTS idx_payments_created_at 
ON public.payments(created_at DESC);
