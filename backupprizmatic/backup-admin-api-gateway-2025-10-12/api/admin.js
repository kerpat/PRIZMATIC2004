
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');

function createSupabaseAdmin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service credentials are not configured.');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizePhone(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }
    if (digits.length === 10 && digits.startsWith('9')) {
        digits = '7' + digits;
    }
    if (digits.length < 11 || digits.length > 15) {
        return '';
    }
    return `+${digits}`;
}

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (err) {
            console.error('Failed to parse request body:', err);
            return {};
        }
    }
    return body;
}

async function sendTelegramMessage(telegramUserId, text) {
    // Логика отправки перенесена сюда напрямую, чтобы избежать проблем с Vercel Deployment Protection
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен!');
        return;
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        console.log(`Отправка прямого запроса в Telegram для ID: ${telegramUserId}`);
        const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: telegramUserId,
                text: text,
                parse_mode: 'Markdown'
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error(`ОШИБКА ОТ TELEGRAM API! Статус: ${response.status}. Ответ:`, errorBody);
        } else {
            console.log("Уведомление успешно отправлено в Telegram.");
        }

    } catch (err) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА FETCH: Не удалось связаться с API Telegram.', err);
    }
}

async function handleAdjustBalance({ userId, amount, reason }) {
    if (!userId || amount === undefined || amount === null || !reason) {
        return { status: 400, body: { error: 'userId, amount, and reason are required.' } };
    }
    const value = Number(amount);
    if (!Number.isFinite(value)) {
        return { status: 400, body: { error: 'Invalid amount value.' } };
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { error: rpcError } = await supabaseAdmin.rpc('add_to_balance', {
        client_id_to_update: userId,
        amount_to_add: value
    });
    if (rpcError) throw new Error('Failed to update balance: ' + rpcError.message);

    const { error: logAdjustmentError } = await supabaseAdmin.from('payments').insert({
        client_id: userId,
        amount_rub: value,
        status: 'succeeded',
        payment_type: 'adjustment',
        payment_method_title: 'Корректировка баланса',
        yookassa_payment_id: `manual-${Date.now()}`,
        description: reason
    });
    if (logAdjustmentError) {
        console.error('Failed to log manual adjustment:', logAdjustmentError.message || logAdjustmentError);
    }

    return { status: 200, body: { message: 'Balance adjusted successfully.' } };
}

async function handleAssignBike({ rental_id, bike_id }) {
    console.log("--- ЗАПУСК handleAssignBike (НАДЕЖНАЯ ВЕРСИЯ) ---");

    const numericBikeId = parseInt(bike_id, 10);
    const numericRentalId = parseInt(rental_id, 10);

    if (!numericRentalId || !numericBikeId || isNaN(numericRentalId) || isNaN(numericBikeId)) {
        console.error('Получены некорректные ID:', { rental_id, bike_id });
        return { status: 400, body: { error: 'Некорректный ID аренды или велосипеда.' } };
    }

    try {
        const supabaseAdmin = createSupabaseAdmin();
        
        console.log(`[1/3] Вызов RPC assign_bike_to_rental с параметрами: rental_id=${numericRentalId}, bike_id=${numericBikeId}`);
        const { error: rpcError } = await supabaseAdmin.rpc('assign_bike_to_rental', {
            p_rental_id: numericRentalId,
            p_bike_id: numericBikeId
        });

        if (rpcError) {
            console.error('Ошибка выполнения RPC:', rpcError);
            throw new Error('Ошибка в базе данных при назначении велосипеда: ' + rpcError.message);
        }
        console.log('[1/3] База данных успешно обновлена.');

        console.log(`[2/3] Получение UUID клиента для аренды ID: ${numericRentalId}`);
        const { data: rentalData, error: rentalError } = await supabaseAdmin
            .from('rentals')
            .select('user_id')
            .eq('id', numericRentalId)
            .single();

        if (rentalError || !rentalData || !rentalData.user_id) {
            console.error('Не удалось найти аренду или user_id в ней:', rentalError);
            return { status: 200, body: { message: 'Велосипед зарезервирован, но не удалось отправить уведомление (не найден user_id).' } };
        }
        const clientUuid = rentalData.user_id;
        console.log(`[2/3] Найден UUID клиента: ${clientUuid}`);

        console.log(`[3/3] Получение Telegram ID...`);
        const { data: clientData, error: clientError } = await supabaseAdmin
            .from('clients')
            .select('telegram_user_id')
            .eq('id', clientUuid)
            .single();

        const telegramUserId = clientData?.telegram_user_id;

        if (clientError || !telegramUserId) {
            console.error('Не удалось найти клиента или telegram_user_id внутри поля extra:', clientError);
            return { status: 200, body: { message: 'Велосипед зарезервирован, но не удалось отправить уведомление (не найден telegram_id в extra).' } };
        }
        console.log(`[3/3] Найден Telegram ID: ${telegramUserId}. Отправка уведомления...`);

        await sendTelegramMessage(telegramUserId, '✅ Ваша заявка одобрена! Пожалуйста, подпишите договор в приложении, чтобы начать поездку.');

        return { status: 200, body: { message: 'Велосипед успешно зарезервирован, уведомление отправлено.' } };

    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА в handleAssignBike:', error);
        return { status: 500, body: { error: error.message } };
    }
}

async function handleCreateInvoice({ userId, amount, description }) {
    if (!userId || amount === undefined || amount === null || !description) {
        return { status: 400, body: { error: 'userId, amount, and description are required.' } };
    }

    const invoiceAmount = Number(amount);
    if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
        return { status: 400, body: { error: 'Amount must be a positive number.' } };
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id, yookassa_payment_method_id, phone, balance_rub')
        .eq('id', userId)
        .single();

    if (clientError || !client) {
        return { status: 404, body: { error: 'Client not found.' } };
    }

    const currentBalance = client.balance_rub || 0;

    // Case 1: Balance is sufficient
    if (currentBalance >= invoiceAmount) {
        const { error: rpcError } = await supabaseAdmin.rpc('add_to_balance', {
            client_id_to_update: userId,
            amount_to_add: -invoiceAmount
        });
        if (rpcError) throw new Error('Failed to debit from balance: ' + rpcError.message);

        await supabaseAdmin.from('payments').insert({
            client_id: userId,
            amount_rub: -invoiceAmount,
            status: 'succeeded',
            payment_type: 'invoice',
            payment_method_title: `Счет: ${description}`,
            yookassa_payment_id: `manual-invoice-${Date.now()}`
        });

        return { status: 200, body: { message: 'Счет полностью оплачен с внутреннего баланса.' } };
    }

    // Case 2: Balance is insufficient, need to charge card
    if (!client.yookassa_payment_method_id) {
        return { status: 400, body: { error: 'У клиента недостаточно средств на балансе и нет привязанной карты.' } };
    }

    const amountToCharge = invoiceAmount - currentBalance;

    // Step 2a: Debit the entire available balance
    if (currentBalance > 0) {
        const { error: rpcError } = await supabaseAdmin.rpc('add_to_balance', {
            client_id_to_update: userId,
            amount_to_add: -currentBalance
        });
        if (rpcError) console.error('Failed to debit partial balance:', rpcError.message);

        await supabaseAdmin.from('payments').insert({
            client_id: userId,
            amount_rub: -currentBalance,
            status: 'succeeded',
            payment_type: 'invoice',
            payment_method_title: `Счет (часть): ${description}`,
            yookassa_payment_id: `manual-invoice-part-${Date.now()}`
        });
    }

    // Step 2b: Charge the remainder from YooKassa
    const normalizedPhone = normalizePhone(client.phone);
    if (!normalizedPhone) {
        return { status: 400, body: { error: 'Client phone number is missing or invalid for receipts.' } };
    }

    const idempotenceKey = crypto.randomUUID();
    const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
    const yookassaBody = {
        amount: { value: amountToCharge.toFixed(2), currency: 'RUB' },
        capture: true,
        description: `${description} (доплата)`,
        payment_method_id: client.yookassa_payment_method_id,
        metadata: { userId, payment_type: 'invoice' }, // Mark as invoice payment
        receipt: {
            customer: { phone: normalizedPhone },
            items: [{
                description: description.slice(0, 255),
                quantity: '1.00',
                amount: { value: amountToCharge.toFixed(2), currency: 'RUB' },
                vat_code: '1',
                payment_mode: 'full_payment',
                payment_subject: 'service'
            }]
        }
    };

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Idempotence-Key': idempotenceKey
        },
        body: JSON.stringify(yookassaBody)
    });

    const payment = await response.json();

    // Log the YooKassa part of the payment
    await supabaseAdmin.from('payments').insert({
        client_id: userId,
        amount_rub: amountToCharge, // This is a charge, but webhook will handle it
        status: payment.status || 'pending',
        payment_type: 'invoice',
        payment_method_title: payment.payment_method?.title || 'Saved method',
        yookassa_payment_id: payment.id || null
    });

    if (!response.ok) {
        throw new Error(payment.description || 'YooKassa invoice charge failed.');
    }

    return {
        status: 200,
        body: {
            message: 'Часть суммы списана с баланса. Инициировано списание оставшейся части с карты.',
            payment_id: payment.id,
            status: payment.status
        }
    };
}

async function handleCreateRefund({ payment_id, amount, reason }) {
    if (!payment_id || amount === undefined || amount === null) {
        return { status: 400, body: { error: 'payment_id and amount are required.' } };
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        return { status: 400, body: { error: 'Amount must be a positive number.' } };
    }

    const supabaseAdmin = createSupabaseAdmin();

    const idempotenceKey = crypto.randomUUID();
    const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
    const yookassaBody = {
        payment_id,
        amount: { value: value.toFixed(2), currency: 'RUB' },
        description: reason || 'Manual refund'
    };

    const response = await fetch('https://api.yookassa.ru/v3/refunds', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Idempotence-Key': idempotenceKey
        },
        body: JSON.stringify(yookassaBody)
    });

    const refund = await response.json();
    if (!response.ok) {
        throw new Error(refund.description || 'YooKassa refund request failed.');
    }

    // ЕСЛИ ВОЗВРАТ ПРОШЕЛ УСПЕШНО:
    if (refund.status === 'succeeded') {

        // ШАГ 2: ОБНОВИТЬ СТАТУС ПЛАТЕЖА В СВОЕЙ БАЗЕ ДАННЫХ
        const { error: updateError } = await supabaseAdmin
          .from('payments')
          .update({ status: 'refunded' }) // Меняем статус на "возвращено"
          .eq('yookassa_payment_id', payment_id); // Находим платеж по его ID из ЮKassa

        if (updateError) {
          // Даже если не удалось обновить статус, деньги уже вернулись.
          // Просто логируем ошибку для себя.
          console.error(`Не удалось обновить статус для платежа ${payment_id} на refunded:`, updateError);
        }

        // Возвращаем успешный ответ клиенту
        return {
            status: 200,
            body: {
                message: 'Возврат успешно оформлен и статус обновлен.',
                refund_id: refund.id,
                status: refund.status
            }
        };
    }

    // Если возврат еще не завершен (pending), возвращаем промежуточный статус
    return {
        status: 200,
        body: {
            message: 'Запрос на возврат отправлен, ожидается подтверждение.',
            refund_id: refund.id,
            status: refund.status
        }
    };
}

async function handleLinkAnonymousChat({ anonymousChatId, clientId }) {
    if (!anonymousChatId || !clientId) {
        return { status: 400, body: { error: 'anonymousChatId and clientId are required.' } };
    }
    const supabaseAdmin = createSupabaseAdmin();
    const { error } = await supabaseAdmin
        .from('support_messages')
        .update({ client_id: clientId, anonymous_chat_id: null })
        .eq('anonymous_chat_id', anonymousChatId);

    if (error) throw new Error('Failed to link chat: ' + error.message);
    return { status: 200, body: { message: 'Anonymous chat linked to client.' } };
}

async function handleRejectRental({ rental_id }) {
    if (!rental_id) {
        return { status: 400, body: { error: 'rental_id is required.' } };
    }
    const supabaseAdmin = createSupabaseAdmin();
    const { data: rental, error: fetchError } = await supabaseAdmin
        .from('rentals')
        .select('user_id, total_paid_rub, status')
        .eq('id', rental_id)
        .single();

    if (fetchError) {
        throw new Error('Failed to load rental: ' + fetchError.message);
    }
    if (!rental) {
        return { status: 404, body: { error: 'Rental not found.' } };
    }
    if (rental.status !== 'pending_assignment') {
        return { status: 400, body: { error: `Rental must be in "pending_assignment" status. Current status: ${rental.status}.` } };
    }

    const { user_id, total_paid_rub } = rental;
    const { error: rpcError } = await supabaseAdmin.rpc('add_to_balance', {
        client_id_to_update: user_id,
        amount_to_add: total_paid_rub
    });
    if (rpcError) throw new Error('Failed to return funds to balance: ' + rpcError.message);

    const { error: updateError } = await supabaseAdmin
        .from('rentals')
        .update({ status: 'rejected', bike_id: null })
        .eq('id', rental_id);
    if (updateError) {
        console.error(`CRITICAL: Failed to mark rental ${rental_id} as rejected after refund.`);
        throw new Error('Rental status update failed after refund. Please contact support.');
    }

    const { error: logRejectRefundError } = await supabaseAdmin.from('payments').insert({
        client_id: user_id,
        rental_id,
        amount_rub: total_paid_rub,
        status: 'succeeded',
        payment_type: 'refund_to_balance',
        payment_method_title: 'Возврат на баланс',
        description: 'Возврат за отклоненную аренду'
    });
    if (logRejectRefundError) {
        console.error('Failed to log rejected rental refund:', logRejectRefundError.message || logRejectRefundError);
    }

    return { status: 200, body: { message: 'Rental rejected and funds returned to balance.' } };
}

async function handleResetAuthToken({ userId }) {
    if (!userId) {
        return { status: 400, body: { error: 'userId is required.' } };
    }
    const supabaseAdmin = createSupabaseAdmin();
    const newAuthToken = crypto.randomUUID();
    const { data, error } = await supabaseAdmin
        .from('clients')
        .update({ auth_token: newAuthToken })
        .eq('id', userId)
        .select('id, auth_token')
        .single();

    if (error) throw new Error('Failed to generate new token: ' + error.message);

    return { status: 200, body: { message: 'Client token reset successfully.', newToken: data.auth_token } };
}

async function handleGetAllRentals() {
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('rentals')
        .select('id, user_id, bike_id, starts_at, current_period_ends_at, total_paid_rub, status, clients (name, phone)')
        .order('starts_at', { ascending: false });

    if (error) {
        throw new Error('Failed to fetch rentals: ' + error.message);
    }
    return { status: 200, body: { rentals: data } };
}

async function handleFinalizeReturn({ rental_id, new_bike_status, service_reason, return_act_url, defects }) {
    if (!rental_id || !new_bike_status) {
        return { status: 400, body: { error: 'rental_id and new_bike_status are required.' } };
    }

    const supabaseAdmin = createSupabaseAdmin();

    // 1. Get rental to find the bike_id and current extra_data
    const { data: rental, error: rentalError } = await supabaseAdmin
        .from('rentals')
        .select('bike_id, user_id, extra_data')
        .eq('id', rental_id)
        .single();

    if (rentalError || !rental) {
        throw new Error('Rental not found for finalization.');
    }

    // 2. Update bike status
    const bikeUpdateData = { status: new_bike_status };
    // Assuming a 'service_reason' column exists on the 'bikes' table
    if (new_bike_status === 'in_service' && service_reason) {
        bikeUpdateData.service_reason = service_reason;
    }
    const { error: bikeError } = await supabaseAdmin
        .from('bikes')
        .update(bikeUpdateData)
        .eq('id', rental.bike_id);

    if (bikeError) {
        console.error(`Failed to update bike status for bike ${rental.bike_id}:`, bikeError.message);
    }

    // 3. Merge new data into extra_data and update rental status
    const newExtraData = {
        ...rental.extra_data,
        return_act_url: return_act_url,
        defects: defects || []
    };

    const { error: finalError } = await supabaseAdmin
        .from('rentals')
        .update({ status: 'awaiting_return_signature', extra_data: newExtraData })
        .eq('id', rental_id);

    if (finalError) {
        throw new Error('Failed to finalize rental status: ' + finalError.message);
    }

    // 4. Send notification to user
    try {
        const { data: clientData, error: clientError } = await supabaseAdmin
            .from('clients')
            .select('telegram_user_id')
            .eq('id', rental.user_id)
            .single();

        if (clientError) throw clientError;

        const telegramUserId = clientData?.telegram_user_id;
        if (telegramUserId) {
            await sendTelegramMessage(telegramUserId, `✅ Ваша аренда #${rental_id} завершена. Перейдите в личный кабинет → Уведомления и подпишите акт сдачи велосипеда.`);
        } else {
            console.warn(`Уведомление не отправлено: не найден telegram_user_id для клиента ${rental.user_id}`);
        }
    } catch (notifyError) {
        console.error('Failed to send finalization notification:', notifyError.message);
    }

    return { status: 200, body: { message: 'Rental successfully completed.' } };
}

async function handleChargeForDamages({ userId, rentalId, amount, description, defects }) {
    if (!userId || !rentalId || !amount || !description) {
        return { status: 400, body: { error: 'userId, rentalId, amount, and description are required.' } };
    }

    const supabaseAdmin = createSupabaseAdmin();
    const chargeAmount = parseFloat(amount);
    if (isNaN(chargeAmount) || chargeAmount <= 0) {
        return { status: 400, body: { error: 'Invalid amount specified.' } };
    }

    // First, save defects and amount to extra_data
    const { data: currentRental, error: fetchError } = await supabaseAdmin.from('rentals').select('extra_data').eq('id', rentalId).single();
    if (fetchError) throw new Error('Could not fetch current rental to merge extra_data');
    const newExtraData = { ...currentRental.extra_data, defects: defects || [], damage_amount: chargeAmount };
    const { error: updateExtraError } = await supabaseAdmin.from('rentals').update({ extra_data: newExtraData }).eq('id', rentalId);
    if (updateExtraError) throw new Error('Failed to save defects and amount: ' + updateExtraError.message);

    // Get client data (balance and saved payment method)
    const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('balance_rub, yookassa_payment_method_id')
        .eq('id', userId)
        .single();

    if (clientError || !client) {
        throw new Error('Client not found.');
    }

    // Try to charge from internal balance first
    if (client.balance_rub >= chargeAmount) {
        const { error: rpcError } = await supabaseAdmin.rpc('add_to_balance', {
            client_id_to_update: userId,
            amount_to_add: -chargeAmount
        });

        if (rpcError) {
            throw new Error(`Failed to deduct from balance: ${rpcError.message}`);
        }

        await supabaseAdmin.from('payments').insert({
            client_id: userId, rental_id: rentalId, amount_rub: chargeAmount, status: 'succeeded',
            payment_type: 'balance', description: description, payment_method_title: 'Списано с баланса за ущерб'
        });

        return { status: 200, body: { message: `Сумма ${chargeAmount} ₽ успешно списана с баланса клиента.` } };
    }

    // If balance is insufficient, try to charge saved card via YooKassa
    const paymentMethodId = client.yookassa_payment_method_id;
    if (!paymentMethodId) {
        return { status: 400, body: { error: 'У клиента нет привязанной карты и недостаточно средств на балансе.' } };
    }

    const idempotenceKey = `damage-charge-${rentalId}-${Date.now()}`;
    const yooKassaResponse = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Idempotence-Key': idempotenceKey,
            'Authorization': 'Basic ' + Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64')
        },
        body: JSON.stringify({
            amount: { value: chargeAmount.toFixed(2), currency: 'RUB' },
            payment_method_id: paymentMethodId,
            capture: true,
            description: `${description} (аренда #${rentalId})`
        })
    });

    const paymentResult = await yooKassaResponse.json();

    if (!yooKassaResponse.ok || paymentResult.status !== 'succeeded') {
        await supabaseAdmin.from('payments').insert({
            client_id: userId, rental_id: rentalId, yookassa_payment_id: paymentResult.id || null, amount_rub: chargeAmount,
            status: 'failed', payment_type: 'card', description: description, payment_method_title: 'Автосписание за ущерб'
        });
        throw new Error(`Автосписание с карты не удалось. Статус платежа: ${paymentResult.status}.`);
    }

    await supabaseAdmin.from('payments').insert({
        client_id: userId, rental_id: rentalId, yookassa_payment_id: paymentResult.id, amount_rub: chargeAmount,
        status: 'succeeded', payment_type: 'card', description: description, payment_method_title: 'Автосписание за ущерб'
    });

    return { status: 200, body: { message: `Сумма ${chargeAmount} ₽ успешно списана с привязанной карты клиента.` } };
}

/**
 * Отправляет уведомление о назначении АКБ
 */
async function handleNotifyBatteryAssignment({ rentalId }) {
    if (!rentalId) {
        return { status: 400, body: { error: 'rentalId обязателен.' } };
    }

    const supabaseAdmin = createSupabaseAdmin();

    try {
        const { data: rental, error } = await supabaseAdmin
            .from('rentals')
            .select('user_id, clients(telegram_user_id)')
            .eq('id', rentalId)
            .single();

        if (error || !rental) {
            console.error('Не удалось найти аренду:', error);
            return { status: 404, body: { error: 'Аренда не найдена.' } };
        }

        const telegramUserId = rental?.clients?.telegram_user_id;

        if (!telegramUserId) {
            console.warn(`Telegram ID не найден для аренды ${rentalId}`);
            return { status: 200, body: { message: 'Уведомление не отправлено (нет Telegram ID).' } };
        }

        const messageText = '✅ Ваше оборудование готово! Пожалуйста, подпишите договор, чтобы начать аренду.';

        // Отправляем уведомление напрямую через функцию, которая УЖЕ ЕСТЬ в admin.js
        await sendTelegramMessage(telegramUserId, messageText);

        console.log(`✅ Уведомление об АКБ отправлено для аренды ${rentalId}`);
        return { status: 200, body: { message: 'Уведомление успешно отправлено.' } };

    } catch (err) {
        console.error('Ошибка отправки уведомления об АКБ:', err);
        return { status: 500, body: { error: err.message } };
    }
}
async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const body = parseRequestBody(req.body);
        const { action } = body;

        let result;
        switch (action) {
            case 'adjust-balance':
                result = await handleAdjustBalance(body);
                break;
            case 'assign-bike':
                result = await handleAssignBike(body);
                break;
            case 'create-invoice':
                result = await handleCreateInvoice(body);
                break;
            case 'create-refund':
                result = await handleCreateRefund(body);
                break;
            case 'link-anonymous-chat':
                result = await handleLinkAnonymousChat(body);
                break;
            case 'reject-rental':
                result = await handleRejectRental(body);
                break;
            case 'reset-auth-token':
                result = await handleResetAuthToken(body);
                break;
            case 'get-all-rentals':
                result = await handleGetAllRentals();
                break;
            case 'finalize-return':
                result = await handleFinalizeReturn(body);
                break;
            case 'charge-for-damages':
                result = await handleChargeForDamages(body);
                break;
            case 'notify-battery-assignment':
                result = await handleNotifyBatteryAssignment(body);
                break;
            default:
                result = { status: 400, body: { error: 'Invalid action' } };
        }

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Admin handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
