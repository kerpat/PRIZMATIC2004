const fetch = require('node-fetch');
const crypto = require('crypto');

const { query, transact } = require('./_lib_db');
const { normalizePhone, addToBalance, logPayment } = require('./_lib_finance');

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (error) {
            console.error('[payments] Failed to parse body:', error);
            return {};
        }
    }
    return body;
}

function getPaymentMethodFromYookassa(paymentObject) {
    const type = paymentObject?.payment_method?.type;
    switch (type) {
        case 'bank_card':
            return 'card';
        case 'sbp':
            return 'sbp';
        case 'yoo_money':
            return 'yoo_money';
        default:
            return type || 'card';
    }
}

async function processInstantTopUp({ userId, amount, payment }) {
    if (!userId) {
        throw new Error('userId is required to process top-up.');
    }

    const normalizedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error('Invalid top-up amount.');
    }

    const paymentId = payment?.id || null;
    if (paymentId) {
        const existing = await query(
            'SELECT 1 FROM payments WHERE yookassa_payment_id = $1 LIMIT 1',
            [paymentId]
        );
        if (existing.rowCount > 0) {
            return false;
        }
    }

    await transact(async (dbClient) => {
        await addToBalance(userId, normalizedAmount, dbClient);
        await logPayment({
            clientId: userId,
            amountRub: normalizedAmount,
            status: 'succeeded',
            paymentType: 'top-up',
            paymentMethodTitle: payment?.payment_method?.title || null,
            yookassaPaymentId: paymentId,
            method: getPaymentMethodFromYookassa(payment),
            createdAt: payment?.created_at ? new Date(payment.created_at) : new Date(),
        }, dbClient);
    });

    return true;
}

async function handleChargeFromBalance({ userId, tariffId, bikeCode, amount, days }) {
    if (!userId || !tariffId) {
        return { status: 400, body: { error: 'userId and tariffId are required' } };
    }

    const tariffResult = await query(
        'SELECT price_rub, duration_days FROM tariffs WHERE id = $1',
        [tariffId]
    );
    const tariff = tariffResult.rows[0];
    if (!tariff) {
        throw new Error('Tariff not found.');
    }

    const clientResult = await query(
        'SELECT balance_rub, city FROM clients WHERE id = $1',
        [userId]
    );
    const client = clientResult.rows[0];
    if (!client) {
        throw new Error('Client not found.');
    }

    const rentalCost = amount != null ? Number(amount) : Number(tariff.price_rub);
    const duration = days || tariff.duration_days;
    const userBalance = Number(client.balance_rub || 0);

    if (!Number.isFinite(rentalCost) || rentalCost <= 0) {
        throw new Error('Invalid rental cost.');
    }

    if (userBalance < rentalCost) {
        return { status: 400, body: { error: 'Client has insufficient balance.' } };
    }

    let bikeId = null;
    if (bikeCode) {
        const bikeResult = await query(
            'SELECT id, status, tariff_id FROM bikes WHERE bike_code = $1',
            [bikeCode]
        );
        const bike = bikeResult.rows[0];

        if (!bike) {
            return { status: 400, body: { error: 'Велосипед не найден.' } };
        }
        if (bike.status !== 'available') {
            return { status: 400, body: { error: 'Велосипед недоступен для аренды.' } };
        }
        if (bike.tariff_id !== Number(tariffId)) {
            return { status: 400, body: { error: 'Велосипед не соответствует выбранному тарифу.' } };
        }

        bikeId = bike.id;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + Number(duration || 0));

    let rentalId;
    await transact(async (dbClient) => {
        await addToBalance(userId, -rentalCost, dbClient);

        const rentalInsert = await dbClient.query(
            `INSERT INTO rentals (
                user_id,
                bike_id,
                tariff_id,
                starts_at,
                current_period_ends_at,
                status,
                total_paid_rub
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING id`,
            [
                userId,
                bikeId,
                tariffId,
                startDate.toISOString(),
                endDate.toISOString(),
                'awaiting_battery_assignment',
                rentalCost,
            ]
        );

        rentalId = rentalInsert.rows[0].id;

        await logPayment({
            clientId: userId,
            rentalId,
            amountRub: rentalCost,
            status: 'succeeded',
            paymentType: 'rental',
            method: 'balance',
            description: bikeId ? `Аренда велосипеда #${bikeId}` : 'Аренда велосипеда',
        }, dbClient);
    });

    return { status: 200, body: { success: true, message: 'Аренда успешно оформлена с баланса.', rentalId } };
}

async function handleSaveCard({ userId }) {
    if (!userId) throw new Error('Client ID (userId) is required.');

    const clientResult = await query(
        'SELECT phone FROM clients WHERE id = $1',
        [userId]
    );
    const client = clientResult.rows[0];
    if (!client) {
        throw new Error(`Client with id ${userId} not found.`);
    }

    const normalizedPhone = normalizePhone(client.phone);
    if (!normalizedPhone) {
        throw new Error(`Client ${userId} has no phone number for YooKassa receipts.`);
    }

    const amountToCharge = 1.0;
    const description = 'Привязка карты для PRIZMATIC';
    const idempotenceKey = crypto.randomUUID();
    const authString = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');

    const paymentData = {
        amount: { value: amountToCharge.toFixed(2), currency: 'RUB' },
        capture: true,
        description,
        metadata: { userId, payment_type: 'save_card' },
        save_payment_method: true,
        confirmation: {
            type: 'redirect',
            return_url: 'https://prizmatic-2004.vercel.app/profile.html?card_saved=true',
        },
        receipt: {
            customer: { phone: normalizedPhone },
            items: [
                {
                    description,
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
            'Idempotence-Key': idempotenceKey,
            Authorization: `Basic ${authString}`,
        },
        body: JSON.stringify(paymentData),
    });

    const paymentResult = await response.json();
    if (!response.ok) {
        console.error('[payments] YooKassa error:', paymentResult);
        throw new Error(`YooKassa error: ${paymentResult.description || 'Unknown error'}`);
    }

    return {
        status: 200,
        body: { confirmation_url: paymentResult.confirmation?.confirmation_url },
    };
}

async function handleCreatePayment(body) {
    const {
        userId,
        tariffId,
        amount: amountFromClient,
        type,
        rentalId,
        return_url,
        bikeCode,
        days,
    } = body;

    if (!userId) {
        throw new Error('Client ID (userId) is required.');
    }

    const clientResult = await query(
        'SELECT phone, balance_rub, yookassa_payment_method_id FROM clients WHERE id = $1',
        [userId]
    );
    const client = clientResult.rows[0];
    if (!client) {
        throw new Error('Client not found.');
    }

    let amount;
    let description;
    let amountToDebitFromBalance = 0;
    let successRedirectUrl;
    let paymentType;

    const userBalance = Number(client.balance_rub || 0);

    if (type === 'renewal') {
        paymentType = 'renewal';
        successRedirectUrl = 'https://prizmatic-2004.vercel.app/?renewal_success=true';
        description = 'Продление аренды';
        const renewalCost = Number(amountFromClient);

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
        successRedirectUrl = 'https://prizmatic-2004.vercel.app/?booking_success=true';
        description = 'Бронирование велосипеда';
        amount = Number(amountFromClient);
    } else if (tariffId && amountFromClient) {
        paymentType = 'rental';
        successRedirectUrl = 'https://prizmatic-2004.vercel.app/?rental_success=true';
        description = 'Аренда велосипеда';
        const tariffCost = Number(amountFromClient);

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
        successRedirectUrl = 'https://prizmatic-2004.vercel.app/?topup_success=true';
        description = 'Пополнение баланса PRIZMATIC';
        amount = Number(amountFromClient);
    } else {
        throw new Error('Invalid request: amount or tariffId is missing.');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Invalid final amount for payment.');
    }

    const normalizedPhone = normalizePhone(client.phone);
    if (!normalizedPhone) {
        throw new Error(`Client ${userId} has no phone number for receipts.`);
    }

    const idempotenceKey = crypto.randomUUID();
    const authString = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');

    const paymentData = {
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        capture: true,
        description,
        metadata: {
            userId,
            tariffId,
            bikeCode,
            payment_type: paymentType,
            rentalId,
            days,
            debit_from_balance: amountToDebitFromBalance,
        },
        save_payment_method: true,
        receipt: {
            customer: { phone: normalizedPhone },
            items: [
                {
                    description,
                    quantity: '1.00',
                    amount: { value: amount.toFixed(2), currency: 'RUB' },
                    vat_code: '1',
                    payment_mode: 'full_payment',
                    payment_subject: 'service',
                },
            ],
        },
    };

    if (client.yookassa_payment_method_id) {
        paymentData.payment_method_id = client.yookassa_payment_method_id;
    } else {
        paymentData.confirmation = {
            type: 'redirect',
            return_url: return_url || successRedirectUrl,
        };
    }

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Idempotence-Key': idempotenceKey,
            Authorization: `Basic ${authString}`,
        },
        body: JSON.stringify(paymentData),
    });

    const paymentResult = await response.json();
    if (!response.ok) {
        console.error('[payments] YooKassa API error:', paymentResult);
        throw new Error(paymentResult.description || 'Unknown YooKassa error');
    }

    if (paymentResult.status === 'succeeded' && paymentType === 'top-up') {
        await processInstantTopUp({ userId, amount, payment: paymentResult });
        return { status: 200, body: { status: paymentResult.status } };
    }

    if (paymentResult.confirmation?.confirmation_url) {
        return { status: 200, body: { confirmation_url: paymentResult.confirmation.confirmation_url } };
    }

    return { status: 200, body: { status: paymentResult.status } };
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
            case 'save-card':
                result = await handleSaveCard(body);
                break;
            case 'create-payment':
                result = await handleCreatePayment(body);
                break;
            default:
                result = { status: 400, body: { error: 'Invalid action' } };
        }

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('[payments] Handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
