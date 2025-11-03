<<<<<<< HEAD

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
=======
const fetch = require('node-fetch');
const crypto = require('crypto');

const { query, transact } = require('./_lib_db');
const { normalizePhone, addToBalance, logPayment } = require('./_lib_finance');
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (err) {
            console.error('[admin] Failed to parse request body:', err);
            return {};
        }
    }
    return body;
}

async function sendTelegramMessage(telegramUserId, text) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error('[admin] TELEGRAM_BOT_TOKEN is not configured.');
        return;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramUserId,
                text,
                parse_mode: 'Markdown',
            }),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error('[admin] Telegram API error:', response.status, errorBody);
        }
    } catch (error) {
        console.error('[admin] Failed to call Telegram API:', error);
    }
}

function jsonStringify(data) {
    if (data == null) {
        return null;
    }
    try {
        return JSON.stringify(data);
    } catch (error) {
        console.error('[admin] Failed to stringify JSON payload:', error);
        return null;
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

<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
    const { error: rpcError } = await supabaseAdmin.rpc('add_to_balance', {
        client_id_to_update: userId,
        amount_to_add: value
=======
    await transact(async (client) => {
        await addToBalance(userId, value, client);
        await logPayment({
            clientId: userId,
            amountRub: value,
            status: 'succeeded',
            paymentType: 'adjustment',
            paymentMethodTitle: 'Корректировка баланса',
            yookassaPaymentId: `manual-${Date.now()}`,
            description: reason,
        }, client);
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
    });

    return { status: 200, body: { message: 'Balance adjusted successfully.' } };
}

async function handleAssignBike({ rental_id, bike_id }) {
    const rentalId = parseInt(rental_id, 10);
    const bikeId = parseInt(bike_id, 10);

    if (!rentalId || !bikeId || Number.isNaN(rentalId) || Number.isNaN(bikeId)) {
        return { status: 400, body: { error: 'Некорректный ID аренды или велосипеда.' } };
    }

    try {
<<<<<<< HEAD
        const supabaseAdmin = createSupabaseAdmin();
        
        console.log(`[1/3] Вызов RPC assign_bike_to_rental с параметрами: rental_id=${numericRentalId}, bike_id=${numericBikeId}`);
        const { error: rpcError } = await supabaseAdmin.rpc('assign_bike_to_rental', {
            p_rental_id: numericRentalId,
            p_bike_id: numericBikeId
        });
=======
        await query('SELECT assign_bike_to_rental($1::bigint, $2::integer)', [rentalId, bikeId]);
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

        const rental = await query('SELECT user_id FROM rentals WHERE id = $1', [rentalId]);
        const clientId = rental.rows[0]?.user_id;
        if (!clientId) {
            return {
                status: 200,
                body: { message: 'Велосипед зарезервирован, но не удалось отправить уведомление (не найден user_id).' },
            };
        }

        const client = await query('SELECT telegram_user_id FROM clients WHERE id = $1', [clientId]);
        const telegramUserId = client.rows[0]?.telegram_user_id;
        if (!telegramUserId) {
            return {
                status: 200,
                body: { message: 'Велосипед зарезервирован, но не найден telegram_id для уведомления.' },
            };
        }

        await sendTelegramMessage(
            telegramUserId,
            '✅ Ваша заявка одобрена! Пожалуйста, подпишите договор в приложении, чтобы начать поездку.'
        );

        return { status: 200, body: { message: 'Велосипед успешно зарезервирован, уведомление отправлено.' } };
    } catch (error) {
        console.error('[admin] handleAssignBike error:', error);
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

<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
    const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id, yookassa_payment_method_id, phone, balance_rub')
        .eq('id', userId)
        .single();

    if (clientError || !client) {
=======
    const clientResult = await query(
        'SELECT id, yookassa_payment_method_id, phone, balance_rub FROM clients WHERE id = $1',
        [userId]
    );
    const client = clientResult.rows[0];
    if (!client) {
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
        return { status: 404, body: { error: 'Client not found.' } };
    }

    const currentBalance = Number(client.balance_rub || 0);

    if (currentBalance >= invoiceAmount) {
        await transact(async (dbClient) => {
        await addToBalance(userId, -invoiceAmount, dbClient);
        await logPayment({
            clientId: userId,
            amountRub: -invoiceAmount,
            status: 'succeeded',
            paymentType: 'invoice',
            paymentMethodTitle: `Счет: ${description}`,
            yookassaPaymentId: `manual-invoice-${Date.now()}`,
        }, dbClient);
        });

        return { status: 200, body: { message: 'Счет полностью оплачен с внутреннего баланса.' } };
    }

    if (!client.yookassa_payment_method_id) {
        return {
            status: 400,
            body: { error: 'У клиента недостаточно средств на балансе и нет привязанной карты.' },
        };
    }

    const amountToCharge = invoiceAmount - currentBalance;

    if (currentBalance > 0) {
        await transact(async (dbClient) => {
            await addToBalance(userId, -currentBalance, dbClient);
            await logPayment({
                clientId: userId,
                amountRub: -currentBalance,
                status: 'succeeded',
                paymentType: 'invoice',
                paymentMethodTitle: `Счет (часть): ${description}`,
                yookassaPaymentId: `manual-invoice-part-${Date.now()}`,
            }, dbClient);
        });
    }

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
        metadata: { userId, payment_type: 'invoice' },
        receipt: {
            customer: { phone: normalizedPhone },
            items: [
                {
                    description: description.slice(0, 255),
                    quantity: '1.00',
                    amount: { value: amountToCharge.toFixed(2), currency: 'RUB' },
                    vat_code: '1',
                    payment_mode: 'full_payment',
                    payment_subject: 'service',
                },
            ],
        },
    };

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
            'Idempotence-Key': idempotenceKey,
        },
        body: JSON.stringify(yookassaBody),
    });

    const payment = await response.json();

    await logPayment({
        clientId: userId,
        amountRub: amountToCharge,
        status: payment.status || 'pending',
        paymentType: 'invoice',
        paymentMethodTitle: payment.payment_method?.title || 'Saved method',
        yookassaPaymentId: payment.id || null,
    });

    if (!response.ok) {
        throw new Error(payment.description || 'YooKassa invoice charge failed.');
    }

    return {
        status: 200,
        body: {
            message: 'Часть суммы списана с баланса. Инициировано списание оставшейся части с карты.',
            payment_id: payment.id,
            status: payment.status,
        },
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

<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();

=======
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
    const idempotenceKey = crypto.randomUUID();
    const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
    const yookassaBody = {
        payment_id,
        amount: { value: value.toFixed(2), currency: 'RUB' },
        description: reason || 'Manual refund',
    };

    const response = await fetch('https://api.yookassa.ru/v3/refunds', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
            'Idempotence-Key': idempotenceKey,
        },
        body: JSON.stringify(yookassaBody),
    });

    const refund = await response.json();
    if (!response.ok) {
        throw new Error(refund.description || 'YooKassa refund request failed.');
    }

    if (refund.status === 'succeeded') {
        await query('UPDATE payments SET status = $1 WHERE yookassa_payment_id = $2', ['refunded', payment_id]);
        return {
            status: 200,
            body: {
                message: 'Возврат успешно оформлен и статус обновлен.',
                refund_id: refund.id,
                status: refund.status,
            },
        };
    }

    return {
        status: 200,
        body: {
            message: 'Запрос на возврат отправлен, ожидается подтверждение.',
            refund_id: refund.id,
            status: refund.status,
        },
    };
}

async function handleLinkAnonymousChat({ anonymousChatId, clientId }) {
    if (!anonymousChatId || !clientId) {
        return { status: 400, body: { error: 'anonymousChatId and clientId are required.' } };
    }
<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
    const { error } = await supabaseAdmin
        .from('support_messages')
        .update({ client_id: clientId, anonymous_chat_id: null })
        .eq('anonymous_chat_id', anonymousChatId);
=======
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

    await query(
        'UPDATE support_messages SET client_id = $1, anonymous_chat_id = NULL WHERE anonymous_chat_id = $2',
        [clientId, anonymousChatId]
    );

    return { status: 200, body: { message: 'Anonymous chat linked to client.' } };
}

async function handleRejectRental({ rental_id }) {
    if (!rental_id) {
        return { status: 400, body: { error: 'rental_id is required.' } };
    }
<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
    const { data: rental, error: fetchError } = await supabaseAdmin
        .from('rentals')
        .select('user_id, total_paid_rub, status')
        .eq('id', rental_id)
        .single();
=======
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

    const rentalResult = await query(
        'SELECT user_id, total_paid_rub, status FROM rentals WHERE id = $1',
        [rental_id]
    );
    const rental = rentalResult.rows[0];

    if (!rental) {
        return { status: 404, body: { error: 'Rental not found.' } };
    }
    if (rental.status !== 'pending_assignment') {
        return {
            status: 400,
            body: { error: `Rental must be in "pending_assignment" status. Current status: ${rental.status}.` },
        };
    }

    await transact(async (dbClient) => {
        await addToBalance(rental.user_id, rental.total_paid_rub, dbClient);
        await dbClient.query(
            'UPDATE rentals SET status = $1, bike_id = NULL WHERE id = $2',
            ['rejected', rental_id]
        );
        await logPayment({
            clientId: rental.user_id,
            rentalId: rental_id,
            amountRub: rental.total_paid_rub,
            status: 'succeeded',
            paymentType: 'refund_to_balance',
            paymentMethodTitle: 'Возврат на баланс',
            description: 'Возврат за отклоненную аренду',
        }, dbClient);
    });

    return { status: 200, body: { message: 'Rental rejected and funds returned to balance.' } };
}

async function handleResetAuthToken({ userId }) {
    if (!userId) {
        return { status: 400, body: { error: 'userId is required.' } };
    }
<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
=======
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
    const newAuthToken = crypto.randomUUID();
    const result = await query(
        'UPDATE clients SET auth_token = $1 WHERE id = $2 RETURNING id, auth_token',
        [newAuthToken, userId]
    );

    if (!result.rows[0]) {
        throw new Error('Client not found.');
    }

    return { status: 200, body: { message: 'Client token reset successfully.', newToken: result.rows[0].auth_token } };
}

async function handleGetAllRentals() {
<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('rentals')
        .select('id, user_id, bike_id, starts_at, current_period_ends_at, total_paid_rub, status, clients (name, phone)')
        .order('starts_at', { ascending: false });
=======
    const result = await query(
        `SELECT
            r.id,
            r.user_id,
            r.bike_id,
            r.starts_at,
            r.current_period_ends_at,
            r.total_paid_rub,
            r.status,
            jsonb_build_object('name', c.name, 'phone', c.phone) AS clients
         FROM rentals r
         LEFT JOIN clients c ON c.id = r.user_id
         ORDER BY r.starts_at DESC NULLS LAST`
    );
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

    return { status: 200, body: { rentals: result.rows } };
}

async function handleFinalizeReturn({ rental_id, new_bike_status, service_reason, return_act_url, defects }) {
    if (!rental_id || !new_bike_status) {
        return { status: 400, body: { error: 'rental_id and new_bike_status are required.' } };
    }

<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
=======
    const rentalResult = await query(
        'SELECT bike_id, user_id, extra_data FROM rentals WHERE id = $1',
        [rental_id]
    );
    const rental = rentalResult.rows[0];
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

    if (!rental) {
        throw new Error('Rental not found for finalization.');
    }

    const updatedExtraData = {
        ...(rental.extra_data || {}),
        return_act_url: return_act_url || null,
        defects: defects || [],
    };

    await transact(async (dbClient) => {
        await dbClient.query(
            'UPDATE bikes SET status = $1, service_reason = $2 WHERE id = $3',
            [
                new_bike_status,
                new_bike_status === 'in_service' ? service_reason || null : null,
                rental.bike_id,
            ]
        );

        await dbClient.query(
            'UPDATE rentals SET status = $1, extra_data = $2::jsonb WHERE id = $3',
            ['awaiting_return_signature', jsonStringify(updatedExtraData), rental_id]
        );
    });

    try {
        const clientResult = await query(
            'SELECT telegram_user_id FROM clients WHERE id = $1',
            [rental.user_id]
        );
        const telegramUserId = clientResult.rows[0]?.telegram_user_id;
        if (telegramUserId) {
            await sendTelegramMessage(
                telegramUserId,
                `✅ Ваша аренда #${rental_id} завершена. Перейдите в личный кабинет → Уведомления и подпишите акт сдачи велосипеда.`
            );
        }
    } catch (notifyError) {
        console.error('[admin] Failed to send finalization notification:', notifyError);
    }

    return { status: 200, body: { message: 'Rental successfully completed.' } };
}

async function handleChargeForDamages({ userId, rentalId, amount, description, defects }) {
    if (!userId || !rentalId || !amount || !description) {
        return { status: 400, body: { error: 'userId, rentalId, amount, and description are required.' } };
    }

<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
    const chargeAmount = parseFloat(amount);
    if (isNaN(chargeAmount) || chargeAmount <= 0) {
=======
    const chargeAmount = Number(amount);
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
        return { status: 400, body: { error: 'Invalid amount specified.' } };
    }

    await query(
        'UPDATE rentals SET extra_data = COALESCE(extra_data, \'{}\'::jsonb) || $1::jsonb WHERE id = $2',
        [
            jsonStringify({
                defects: defects || [],
                damage_amount: chargeAmount,
            }),
            rentalId,
        ]
    );

    const clientResult = await query(
        'SELECT balance_rub, yookassa_payment_method_id FROM clients WHERE id = $1',
        [userId]
    );
    const client = clientResult.rows[0];
    if (!client) {
        throw new Error('Client not found.');
    }

    if (Number(client.balance_rub || 0) >= chargeAmount) {
        await transact(async (dbClient) => {
            await addToBalance(userId, -chargeAmount, dbClient);
            await logPayment({
                clientId: userId,
                rentalId,
                amountRub: chargeAmount,
                status: 'succeeded',
                paymentType: 'balance',
                description,
                paymentMethodTitle: 'Списано с баланса за ущерб',
            }, dbClient);
        });

        return { status: 200, body: { message: `Сумма ${chargeAmount} ₽ успешно списана с баланса клиента.` } };
    }

    const paymentMethodId = client.yookassa_payment_method_id;
    if (!paymentMethodId) {
        return {
            status: 400,
            body: { error: 'У клиента нет привязанной карты и недостаточно средств на балансе.' },
        };
    }

    const idempotenceKey = `damage-charge-${rentalId}-${Date.now()}`;
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Idempotence-Key': idempotenceKey,
            Authorization: `Basic ${Buffer.from(
                `${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`
            ).toString('base64')}`,
        },
        body: JSON.stringify({
            amount: { value: chargeAmount.toFixed(2), currency: 'RUB' },
            payment_method_id: paymentMethodId,
            capture: true,
            description: `${description} (аренда #${rentalId})`,
        }),
    });

    const paymentResult = await response.json();

    if (!response.ok || paymentResult.status !== 'succeeded') {
        await logPayment({
            clientId: userId,
            rentalId,
            amountRub: chargeAmount,
            status: 'failed',
            paymentType: 'card',
            description,
            paymentMethodTitle: 'Автосписание за ущерб',
            yookassaPaymentId: paymentResult.id || null,
    });
        throw new Error(
            `Автосписание с карты не удалось. Статус платежа: ${paymentResult.status || 'unknown'}.`
        );
    }

    await logPayment({
        clientId: userId,
        rentalId,
        amountRub: chargeAmount,
        status: 'succeeded',
        paymentType: 'card',
        description,
        paymentMethodTitle: 'Автосписание за ущерб',
        yookassaPaymentId: paymentResult.id,
    });

    return { status: 200, body: { message: `Сумма ${chargeAmount} ₽ успешно списана с привязанной карты клиента.` } };
}

async function handleNotifyBatteryAssignment({ rentalId }) {
    if (!rentalId) {
        return { status: 400, body: { error: 'rentalId обязателен.' } };
    }

<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
=======
    const rentalResult = await query(
        `SELECT r.user_id, c.telegram_user_id
         FROM rentals r
         LEFT JOIN clients c ON c.id = r.user_id
         WHERE r.id = $1`,
        [rentalId]
    );
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

    const rental = rentalResult.rows[0];
    if (!rental) {
        return { status: 404, body: { error: 'Аренда не найдена.' } };
    }

    const telegramUserId = rental.telegram_user_id;
    if (!telegramUserId) {
        return {
            status: 200,
            body: { message: 'Уведомление не отправлено (нет Telegram ID).' },
        };
    }

    await sendTelegramMessage(
        telegramUserId,
        '✅ Ваше оборудование готово! Пожалуйста, подпишите договор, чтобы начать аренду.'
    );

    return { status: 200, body: { message: 'Уведомление успешно отправлено.' } };
}

async function handleNotifyOverdue({ rentalId, messageText }) {
    if (!rentalId || !messageText) {
        return { status: 400, body: { error: 'rentalId и messageText обязательны.' } };
    }

<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();

    try {
        // Получаем данные аренды с extra_data
        const { data: rental, error } = await supabaseAdmin
            .from('rentals')
            .select('id, user_id, extra_data, clients(telegram_user_id)')
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

        // Проверяем лимит уведомлений за последние 24 часа
        const extraData = rental.extra_data || {};
        const overdueNotifications = extraData.overdue_notifications || [];
        
        // Фильтруем уведомления за последние 24 часа
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentNotifications = overdueNotifications.filter(notif => {
            const sentAt = new Date(notif.sent_at);
            return sentAt > last24Hours;
        });

        // Проверяем лимит (не более 5 за сутки)
        if (recentNotifications.length >= 5) {
            console.log(`Лимит уведомлений достигнут для аренды ${rentalId}`);
            return { status: 200, body: { message: 'Лимит уведомлений достигнут (5 за сутки).' } };
        }

        // Отправляем уведомление
        await sendTelegramMessage(telegramUserId, messageText);

        // Добавляем запись о новом уведомлении
        const newNotification = {
            sent_at: now.toISOString(),
            text: messageText
        };
        
        const updatedNotifications = [...recentNotifications, newNotification];
        const updatedExtraData = {
            ...extraData,
            overdue_notifications: updatedNotifications
        };

        // Обновляем extra_data в базе
        await supabaseAdmin
            .from('rentals')
            .update({ extra_data: updatedExtraData })
            .eq('id', rentalId);

        console.log(`✅ Уведомление о просрочке отправлено для аренды ${rentalId} (${recentNotifications.length + 1}/5)`);
        return { status: 200, body: { message: 'Уведомление успешно отправлено.', count: recentNotifications.length + 1 } };

    } catch (err) {
        console.error('Ошибка отправки уведомления о просрочке:', err);
        return { status: 500, body: { error: err.message } };
=======
    const rentalResult = await query(
        `SELECT r.extra_data, c.telegram_user_id
         FROM rentals r
         LEFT JOIN clients c ON c.id = r.user_id
         WHERE r.id = $1`,
        [rentalId]
    );
    const rental = rentalResult.rows[0];
    if (!rental) {
        return { status: 404, body: { error: 'Аренда не найдена.' } };
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
    }

    const telegramUserId = rental.telegram_user_id;
    if (!telegramUserId) {
        return {
            status: 200,
            body: { message: 'Уведомление не отправлено (нет Telegram ID).' },
        };
    }

    const extraData = rental.extra_data || {};
    const overdueNotifications = Array.isArray(extraData.overdue_notifications)
        ? extraData.overdue_notifications
        : [];

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentNotifications = overdueNotifications.filter((notification) => {
        const sentAt = new Date(notification.sent_at);
        return sentAt > last24Hours;
    });

    if (recentNotifications.length >= 5) {
        return {
            status: 200,
            body: { message: 'Лимит уведомлений достигнут (5 за сутки).' },
        };
    }

    await sendTelegramMessage(telegramUserId, messageText);

    const updatedNotifications = [
        ...recentNotifications,
        {
            sent_at: now.toISOString(),
            text: messageText,
        },
    ];

    const updatedExtraData = {
        ...extraData,
        overdue_notifications: updatedNotifications,
    };

    await query(
        'UPDATE rentals SET extra_data = $1::jsonb WHERE id = $2',
        [jsonStringify(updatedExtraData), rentalId]
    );

    return {
        status: 200,
        body: {
            message: 'Уведомление успешно отправлено.',
            count: updatedNotifications.length,
        },
    };
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
            case 'notify-overdue':
                result = await handleNotifyOverdue(body);
                break;
            default:
                result = { status: 400, body: { error: 'Invalid action' } };
        }

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('[admin] Handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
