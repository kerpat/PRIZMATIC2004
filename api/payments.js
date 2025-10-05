const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');

function normalizePhone(phone) {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
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

async function handleChargeFromBalance({ userId, tariffId, bikeCode, amount, days }) {
    if (!userId || !tariffId) {
        return { status: 400, body: { error: 'userId and tariffId are required' } };
    }

    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const [tariffResult, clientResult] = await Promise.all([
        supabaseAdmin.from('tariffs').select('price_rub, duration_days').eq('id', tariffId).single(),
        supabaseAdmin.from('clients').select('balance_rub').eq('id', userId).single()
    ]);

    if (tariffResult.error || !tariffResult.data) throw new Error('Tariff not found.');
    if (clientResult.error || !clientResult.data) throw new Error('Client not found.');

    const rentalCost = amount || tariffResult.data.price_rub;
    const duration = days || tariffResult.data.duration_days;
    const userBalance = clientResult.data.balance_rub;

    if (userBalance < rentalCost) {
        return { status: 400, body: { error: 'Client has insufficient balance.' } };
    }

    // --- НАЧАЛО НОВОЙ ЛОГИКИ ---

    let bikeId;
    if (bikeCode) {
        // Если указан конкретный велосипед, проверяем его доступность
        console.log(`[БАЛАНС] Проверка велосипеда #${bikeCode} для тарифа ${tariffId}...`);
        const { data: bike, error: bikeError } = await supabaseAdmin
            .from('bikes')
            .select('id, status, tariff_id')
            .eq('bike_code', bikeCode)
            .single();

        if (bikeError || !bike) {
            return { status: 400, body: { error: 'Велосипед не найден.' } };
        }

        if (bike.status !== 'available') {
            return { status: 400, body: { error: 'Велосипед недоступен для аренды.' } };
        }

        if (bike.tariff_id !== tariffId) {
            return { status: 400, body: { error: 'Велосипед не соответствует выбранному тарифу.' } };
        }

        bikeId = bike.id;
        console.log(`[БАЛАНС] Выбран конкретный велосипед #${bikeId}`);
    } else {
        // Найти случайный свободный велосипед (копируем из webhook'а)
        console.log(`[БАЛАНС] Поиск свободного велосипеда для тарифа ${tariffId}...`);
        const { data: availableBikes, error: bikesError } = await supabaseAdmin
            .from('bikes')
            .select('id')
            .eq('status', 'available')
            .eq('tariff_id', tariffId);

        if (bikesError) throw new Error(`Ошибка при поиске велосипедов: ${bikesError.message}`);

        if (!availableBikes || availableBikes.length === 0) {
            console.error(`[БАЛАНС] Нет свободных велосипедов для тарифа ${tariffId}!`);
            // ВАЖНО: Вместо возврата денег через ЮKassa, просто возвращаем ошибку клиенту.
            // Деньги мы еще не списали!
            return { status: 400, body: { error: 'К сожалению, все велосипеды по вашему тарифу сейчас заняты.' } };
        }

        const randomBike = availableBikes[Math.floor(Math.random() * availableBikes.length)];
        bikeId = randomBike.id;
        console.log(`[БАЛАНС] Найден и выбран велосипед #${bikeId}`);
    }

    // Теперь, когда мы знаем, что велосипед есть, можно безопасно списать деньги.
    // Оборачиваем все в транзакцию (в Supabase это лучше делать через RPC-функцию).
    // Для простоты, пока без транзакции:

    // 2. Списываем деньги с баланса
    const newBalance = userBalance - rentalCost;
    const { error: balanceError } = await supabaseAdmin.from('clients').update({ balance_rub: newBalance }).eq('id', userId);
    if (balanceError) throw new Error('Не удалось обновить баланс клиента: ' + balanceError.message);

    // 3. Обновить статус велосипеда на 'rented'
    const { error: bikeUpdateError } = await supabaseAdmin.from('bikes').update({ status: 'rented' }).eq('id', bikeId);
    if (bikeUpdateError) {
        // Откатываем списание баланса, если не удалось забронировать велосипед
        await supabaseAdmin.from('clients').update({ balance_rub: userBalance }).eq('id', userId);
        throw new Error(`Не удалось обновить статус велосипеда #${bikeId}: ${bikeUpdateError.message}`);
    }

    // 4. Создать запись об аренде со статусом 'awaiting_battery_assignment'
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + duration);

    const { data: newRental, error: rentalError } = await supabaseAdmin
        .from('rentals')
        .insert({
            user_id: userId,
            bike_id: bikeId, // <-- Теперь привязываем ID велосипеда
            tariff_id: tariffId,
            starts_at: startDate.toISOString(),
            current_period_ends_at: endDate.toISOString(),
            status: 'awaiting_battery_assignment', // Статус ожидания выбора АКБ
            total_paid_rub: rentalCost
        })
        .select('id')
        .single();

    if (rentalError) {
        // Откатываем и списание, и статус велосипеда
        await supabaseAdmin.from('clients').update({ balance_rub: userBalance }).eq('id', userId);
        await supabaseAdmin.from('bikes').update({ status: 'available' }).eq('id', bikeId);
        throw new Error(`Не удалось создать аренду: ${rentalError.message}`);
    }

    // 5. Записать транзакцию в историю платежей
    await supabaseAdmin.from('payments').insert({
        client_id: userId,
        rental_id: newRental.id,
        amount_rub: rentalCost, // Положительное число для лога
        status: 'succeeded',
        payment_type: 'rental',
        method: 'balance',
        description: `Аренда велосипеда #${bikeId}`
    });

    // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

    return { status: 200, body: { success: true, message: 'Аренда успешно оформлена с баланса.' } };
}

async function handleSaveCard({ userId }) {
    if (!userId) throw new Error('Client ID (userId) is required.');

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: clientData, error: clientError } = await supabase.from('clients').select('phone').eq('id', userId).single();
    if (clientError || !clientData) throw new Error(`Client with id ${userId} not found in Supabase.`);

    const normalizedPhone = normalizePhone(clientData.phone);
    if (!normalizedPhone) throw new Error(`Client ${userId} has no phone number for YooKassa receipts.`);

    const amount = 1.00; // Small amount for card verification
    const description = 'Привязка карты для GoGoBike';
    const idempotenceKey = crypto.randomUUID();

    const paymentData = {
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        capture: true,
        description,
        metadata: { userId, payment_type: 'save_card' }, // Special metadata
        save_payment_method: true,
        confirmation: { type: 'redirect', return_url: 'https://go-go-b-ike.vercel.app/profile.html?card_saved=true' }, // Redirect back to profile
        receipt: {
            customer: { phone: normalizedPhone },
            items: [{
                description,
                quantity: '1.00',
                amount: { value: amount.toFixed(2), currency: 'RUB' },
                vat_code: '1',
                payment_mode: 'full_payment',
                payment_subject: 'service'
            }]
        }
    };

    const authString = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Idempotence-Key': idempotenceKey,
            'Authorization': `Basic ${authString}`
        },
        body: JSON.stringify(paymentData)
    });

    const paymentResult = await response.json();
    if (!response.ok) {
        console.error('YooKassa API Error:', paymentResult);
        throw new Error(`YooKassa error: ${paymentResult.description || 'Unknown error'}`);
    }

    // We don't need to do anything else here, the webhook will handle saving the card.
    // We just return the confirmation URL.
    return { status: 200, body: { confirmation_url: paymentResult.confirmation?.confirmation_url } };
}

async function handleCreatePayment(body) {
    const { userId, tariffId, amount: amountFromClient, type, rentalId, return_url, bikeCode, days } = body;
    if (!userId) throw new Error('Client ID (userId) is required.');

    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: clientData, error: clientError } = await supabaseAdmin.from('clients').select('phone, balance_rub, yookassa_payment_method_id').eq('id', userId).single();
    if (clientError || !clientData) throw new Error(`Client not found.`);

    let amount;
    let description;
    let amountToDebitFromBalance = 0;
    let successRedirectUrl;
    let paymentType; // Simplified payment type without suffixes

    const userBalance = clientData.balance_rub || 0;

    // Determine payment type and calculate amounts
    if (type === 'renewal') {
        paymentType = 'renewal';
        successRedirectUrl = 'https://go-go-b-ike.vercel.app/?renewal_success=true';
        description = `Продление аренды`;
        const renewalCost = Number.parseFloat(amountFromClient);

        if (userBalance >= renewalCost) {
            throw new Error('Balance is sufficient. Use charge-from-balance endpoint.');
        } else if (userBalance > 0) {
            amount = renewalCost - userBalance;
            amountToDebitFromBalance = userBalance;
        } else {
            amount = renewalCost;
        }
    } else if (type === 'booking') {
        paymentType = 'booking';
        successRedirectUrl = 'https://go-go-b-ike.vercel.app/?booking_success=true';
        description = `Бронирование велосипеда`;
        amount = Number.parseFloat(amountFromClient);
    } else if (tariffId && amountFromClient) {
        paymentType = 'rental';
        successRedirectUrl = 'https://go-go-b-ike.vercel.app/?rental_success=true';
        const tariffCost = Number.parseFloat(amountFromClient);
        description = `Аренда велосипеда`;

        if (userBalance >= tariffCost) {
            throw new Error('Balance is sufficient. Use charge-from-balance endpoint.');
        } else if (userBalance > 0) {
            amount = tariffCost - userBalance;
            amountToDebitFromBalance = userBalance;
        } else {
            amount = tariffCost;
        }
    } else if (amountFromClient) {
        paymentType = 'top-up';
        successRedirectUrl = 'https://go-go-b-ike.vercel.app/?topup_success=true';
        description = 'Пополнение баланса GoGoBike';
        amount = Number.parseFloat(amountFromClient);
    } else {
        throw new Error('Invalid request: amount or tariffId is missing.');
    }

    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid final amount for payment.');

    const normalizedPhone = normalizePhone(clientData.phone);
    if (!normalizedPhone) throw new Error(`Client ${userId} has no phone number for receipts.`);

    const idempotenceKey = crypto.randomUUID();
    
    // Simplified metadata: use payment_type without suffixes
    // The 'method' field will be determined in the webhook based on YooKassa payment data
    const paymentData = {
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        capture: true,
        description,
        metadata: {
            userId,
            tariffId,
            bikeCode,
            payment_type: paymentType, // Simplified: 'rental', 'renewal', 'top-up', 'booking'
            rentalId,
            days,
            debit_from_balance: amountToDebitFromBalance
        },
        save_payment_method: true,
        receipt: {
            customer: { phone: normalizedPhone },
            items: [{ description, quantity: '1.00', amount: { value: amount.toFixed(2), currency: 'RUB' }, vat_code: '1', payment_mode: 'full_payment', payment_subject: 'service' }]
        },
    };

    if (clientData.yookassa_payment_method_id) {
        paymentData.payment_method_id = clientData.yookassa_payment_method_id;
    } else {
        paymentData.confirmation = { type: 'redirect', return_url: return_url || successRedirectUrl };
    }

    const authString = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotence-Key': idempotenceKey, 'Authorization': `Basic ${authString}` },
        body: JSON.stringify(paymentData)
    });

    const paymentResult = await response.json();
    if (!response.ok) {
        console.error('YooKassa API Error:', paymentResult);
        throw new Error(paymentResult.description || 'Unknown YooKassa error');
    }

    if (paymentResult.confirmation) {
        return { status: 200, body: { confirmation_url: paymentResult.confirmation.confirmation_url } };
    } else {
        return { status: 200, body: { status: paymentResult.status } };
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
            case 'charge-from-balance':
                result = await handleChargeFromBalance(body);
                break;
            case 'create-payment':
                result = await handleCreatePayment(body);
                break;
            case 'save-card':
                result = await handleSaveCard(body);
                break;
            default:
                result = { status: 400, body: { error: 'Invalid action' } };
        }

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Payments Handler Error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
