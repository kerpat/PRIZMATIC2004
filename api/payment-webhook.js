
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function createSupabaseAdmin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service credentials are not configured.');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (err) {
            console.error('Failed to parse webhook body:', err);
            return {};
        }
    }
    return body;
}

function getPaymentMethodFromYookassa(paymentObject) {
    const methodType = paymentObject.payment_method?.type;
    
    console.log('[МЕТОД ОПЛАТЫ] payment_method:', JSON.stringify(paymentObject.payment_method));
    
    switch(methodType) {
        case 'bank_card':
            return 'card';
        case 'sbp':
            return 'sbp';
        case 'yoo_money':
            return 'yoo_money';
        default:
            console.warn('[МЕТОД ОПЛАТЫ] Неизвестный тип, используем card по умолчанию');
            return 'card'; // По умолчанию
    }
}

async function processSucceededPayment(notification) {
    console.log('--- НАЧАЛО ОБРАБОТКИ УСПЕШНОГО ПЛАТЕЖА (v_final) ---');
    const payment = notification.object;
    const metadata = payment.metadata || {};

    const { userId, tariffId, payment_type, debit_from_balance, days } = metadata;
    const cardPaymentAmount = Number.parseFloat(payment.amount?.value ?? '0');
    const yookassaPaymentId = payment.id;
    const supabaseAdmin = createSupabaseAdmin();

    // Сохраняем метод оплаты, если он есть и userId указан
    if (payment.payment_method?.id && userId) {
        console.log(`[СОХРАНЕНИЕ МЕТОДА] для userId: ${userId}, method_id: ${payment.payment_method.id}`);
        
        // Формируем детали метода оплаты для поля extra
        const paymentMethodDetails = {
            type: payment.payment_method.type,
            id: payment.payment_method.id,
            saved: payment.payment_method.saved || true,
            title: payment.payment_method.title || 'Способ оплаты'
        };

        // Добавляем детали карты, если это банковская карта
        if (payment.payment_method.type === 'bank_card' && payment.payment_method.card) {
            paymentMethodDetails.card = {
                first6: payment.payment_method.card.first6,
                last4: payment.payment_method.card.last4,
                expiry_month: payment.payment_method.card.expiry_month,
                expiry_year: payment.payment_method.card.expiry_year,
                card_type: payment.payment_method.card.card_type,
                issuer_country: payment.payment_method.card.issuer_country,
                issuer_name: payment.payment_method.card.issuer_name
            };
        }

        // Получаем текущий extra, чтобы не перезаписать другие данные
        const { data: currentClient } = await supabaseAdmin
            .from('clients')
            .select('extra')
            .eq('id', userId)
            .single();

        const currentExtra = currentClient?.extra || {};
        const updatedExtra = {
            ...currentExtra,
            payment_method_details: paymentMethodDetails
        };

        // Обновляем клиента
        await supabaseAdmin.from('clients').update({ 
            yookassa_payment_method_id: payment.payment_method.id, 
            autopay_enabled: true,
            extra: updatedExtra
        }).eq('id', userId);
        
        console.log(`[СОХРАНЕНИЕ МЕТОДА] Детали сохранены в extra:`, paymentMethodDetails);
    }

    if (payment_type === 'save_card') {
        console.log('[ЗАВЕРШЕНИЕ] Платеж для привязки карты.');
        return;
    }

    if (tariffId) {
        console.log(`[АРЕНДА] Обработка для userId: ${userId}`);
        const amountToDebit = Number.parseFloat(debit_from_balance) || 0;
        if (amountToDebit > 0) {
            console.log(`[АРЕНДА] Списываем с баланса ${amountToDebit} ₽`);
            const { error } = await supabaseAdmin.rpc('add_to_balance', { client_id_to_update: userId, amount_to_add: -amountToDebit });
            if (error) { /* ... логика возврата ... */ throw new Error('Failed to debit from balance.'); }
        }

        // Логика создания аренды
        const { data: availableBikes, error: bikesError } = await supabaseAdmin.from('bikes').select('id').eq('status', 'available').eq('tariff_id', tariffId);
        if (bikesError || !availableBikes || availableBikes.length === 0) { throw new Error(`Нет свободных велосипедов для тарифа ${tariffId}.`); }
        const bikeId = availableBikes[0].id;
        await supabaseAdmin.from('bikes').update({ status: 'rented' }).eq('id', bikeId);
        
        // Определяем длительность аренды: используем days из metadata или берем из тарифа
        let rentalDays = days ? Number.parseInt(days) : null;
        if (!rentalDays) {
            const { data: tariffData } = await supabaseAdmin.from('tariffs').select('duration_days').eq('id', tariffId).single();
            rentalDays = tariffData?.duration_days || 7;
        }
        
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + rentalDays);
        const totalPaid = cardPaymentAmount + amountToDebit;
        
        console.log(`[АРЕНДА] Создаем аренду на ${rentalDays} дней`);
        const { data: newRental } = await supabaseAdmin.from('rentals').insert({ user_id: userId, bike_id: bikeId, tariff_id: tariffId, starts_at: startDate.toISOString(), current_period_ends_at: endDate.toISOString(), status: 'awaiting_battery_assignment', total_paid_rub: totalPaid }).select('id').single();

        // Определяем способ оплаты из данных ЮKassa
        const paymentMethod = getPaymentMethodFromYookassa(payment);
        
        // Запись платежа с карты/СБП
        await supabaseAdmin.from('payments').insert({ 
            client_id: userId, 
            rental_id: newRental.id, 
            amount_rub: cardPaymentAmount, 
            status: 'succeeded', 
            payment_type: 'rental',
            method: paymentMethod,
            yookassa_payment_id: yookassaPaymentId 
        });
        
        // Запись платежа с баланса (если было списание)
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

        console.log(`[АРЕНДА] Успешно создана аренда #${newRental.id}`);
        return;
    }

    if (payment_type === 'booking') {
        console.log(`[БРОНЬ] Обработка для userId: ${userId}`);
        const expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const { data: newBooking } = await supabaseAdmin.from('bookings').insert({ user_id: userId, expires_at: expires_at, status: 'active', cost_rub: cardPaymentAmount }).select('id').single();

        console.log(`[БРОНЬ -> БАЛАНС] Пополняем баланс на ${cardPaymentAmount} ₽`);
        await supabaseAdmin.rpc('add_to_balance', { client_id_to_update: userId, amount_to_add: cardPaymentAmount });

        // Определяем способ оплаты из данных ЮKassa
        const paymentMethod = getPaymentMethodFromYookassa(payment);
        
        await supabaseAdmin.from('payments').insert({ 
            client_id: userId, 
            booking_id: newBooking.id, 
            amount_rub: cardPaymentAmount, 
            status: 'succeeded', 
            payment_type: 'booking',
            method: paymentMethod,
            yookassa_payment_id: yookassaPaymentId 
        });
        console.log(`[БРОНЬ] Успешно создана бронь #${newBooking.id}`);
        return;
    }

    if (payment_type === 'renewal') {
        console.log(`[ПРОДЛЕНИЕ] Обработка для userId: ${userId}`);
        const { rentalId, days } = metadata;
        
        if (!rentalId) {
            throw new Error('rentalId отсутствует в metadata для продления');
        }

        const amountToDebit = Number.parseFloat(debit_from_balance) || 0;
        if (amountToDebit > 0) {
            console.log(`[ПРОДЛЕНИЕ] Списываем с баланса ${amountToDebit} ₽`);
            const { error } = await supabaseAdmin.rpc('add_to_balance', { 
                client_id_to_update: userId, 
                amount_to_add: -amountToDebit 
            });
            if (error) {
                throw new Error('Failed to debit from balance for renewal.');
            }
        }

        // Получаем текущую аренду
        const { data: rental, error: rentalError } = await supabaseAdmin
            .from('rentals')
            .select('current_period_ends_at, total_paid_rub')
            .eq('id', rentalId)
            .single();

        if (rentalError || !rental) {
            throw new Error(`Аренда #${rentalId} не найдена`);
        }

        // Продлеваем на указанное количество дней
        const daysToAdd = Number.parseInt(days) || 7;
        const newEndDate = new Date(rental.current_period_ends_at);
        newEndDate.setDate(newEndDate.getDate() + daysToAdd);

        const totalPaid = (rental.total_paid_rub || 0) + cardPaymentAmount + amountToDebit;
        
        console.log(`[ПРОДЛЕНИЕ] Продлеваем аренду #${rentalId} на ${daysToAdd} дней`);

        // Обновляем аренду
        await supabaseAdmin
            .from('rentals')
            .update({ 
                current_period_ends_at: newEndDate.toISOString(),
                total_paid_rub: totalPaid
            })
            .eq('id', rentalId);

        // Определяем способ оплаты из данных ЮKassa
        const paymentMethod = getPaymentMethodFromYookassa(payment);
        
        // Запись платежа с карты/СБП
        await supabaseAdmin.from('payments').insert({ 
            client_id: userId, 
            rental_id: rentalId, 
            amount_rub: cardPaymentAmount, 
            status: 'succeeded', 
            payment_type: 'renewal',
            method: paymentMethod,
            yookassa_payment_id: yookassaPaymentId 
        });
        
        // Запись платежа с баланса (если было списание)
        if (amountToDebit > 0) {
            await supabaseAdmin.from('payments').insert({ 
                client_id: userId, 
                rental_id: rentalId, 
                amount_rub: amountToDebit, 
                status: 'succeeded', 
                payment_type: 'renewal',
                method: 'balance',
                description: 'Частичная оплата продления с баланса' 
            });
        }

        console.log(`[ПРОДЛЕНИЕ] Аренда #${rentalId} успешно продлена до ${newEndDate.toISOString()}`);
        return;
    }

    // --- ОБЫЧНОЕ ПОПОЛНЕНИЕ БАЛАНСА (из твоего рабочего файла) ---
    console.log(`[ПОПОЛНЕНИЕ] Обработка для userId: ${userId} на сумму ${cardPaymentAmount} ₽`);
    if (!userId) {
        console.warn('Webhook: userId не найден, пополнение пропускается.');
        return;
    }

    const { error: balanceError } = await supabaseAdmin.rpc('add_to_balance', {
        client_id_to_update: userId,
        amount_to_add: cardPaymentAmount
    });

    if (balanceError) {
        console.error(`[КРИТИКАЛ] НЕ УДАЛОСЬ ПОПОЛНИТЬ БАЛАНС для ${userId}:`, balanceError.message);
        throw new Error(`Failed to credit balance for client ${userId}`);
    }

    // Определяем способ оплаты из данных ЮKassa
    const paymentMethod = getPaymentMethodFromYookassa(payment);

    await supabaseAdmin.from('payments').insert({
        client_id: userId,
        amount_rub: cardPaymentAmount,
        status: 'succeeded',
        payment_type: 'top-up',
        method: paymentMethod,
        yookassa_payment_id: yookassaPaymentId
    });

    console.log(`[ПОПОЛНЕНИЕ] Баланс для userId ${userId} успешно пополнен.`);
}
async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const notification = parseRequestBody(req.body);

        if (notification.event !== 'payment.succeeded' || notification.object?.status !== 'succeeded') {
            res.status(200).send('OK. Event ignored.');
            return;
        }

        await processSucceededPayment(notification);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
