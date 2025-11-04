const { query, transact } = require('./_lib_db');
const { addToBalance, logPayment } = require('./_lib_finance');

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (error) {
            console.error('[payment-webhook] Failed to parse body:', error);
            return {};
        }
    }
    return body;
}

function getPaymentMethodFromYookassa(paymentObject) {
    const type = paymentObject.payment_method?.type;
    switch (type) {
        case 'bank_card':
            return 'card';
        case 'sbp':
            return 'sbp';
        case 'yoo_money':
            return 'yoo_money';
        default:
            return 'card';
    }
}

async function paymentExists(paymentId) {
    if (!paymentId) return false;
    const result = await query(
        'SELECT 1 FROM payments WHERE yookassa_payment_id = $1 LIMIT 1',
        [paymentId]
    );
    return result.rowCount > 0;
}

async function savePaymentMethodDetails(userId, payment) {
    if (!userId || !payment?.payment_method?.id) {
        return;
    }

    try {
        const paymentMethod = payment.payment_method;
        const paymentMethodDetails = {
            type: paymentMethod.type,
            id: paymentMethod.id,
            saved: paymentMethod.saved ?? true,
            title: paymentMethod.title || 'Способ оплаты',
        };

        if (paymentMethod.type === 'bank_card' && paymentMethod.card) {
            paymentMethodDetails.card = {
                first6: paymentMethod.card.first6,
                last4: paymentMethod.card.last4,
                expiry_month: paymentMethod.card.expiry_month,
                expiry_year: paymentMethod.card.expiry_year,
                card_type: paymentMethod.card.card_type,
                issuer_country: paymentMethod.card.issuer_country,
                issuer_name: paymentMethod.card.issuer_name,
            };
        }

        const currentExtraResult = await query(
            'SELECT extra FROM clients WHERE id = $1',
            [userId]
        );
        const currentExtra = currentExtraResult.rows[0]?.extra || {};
        const updatedExtra = {
            ...currentExtra,
            payment_method_details: paymentMethodDetails,
        };

        await query(
            'UPDATE clients SET yookassa_payment_method_id = $1, autopay_enabled = true, extra = $2::jsonb WHERE id = $3',
            [paymentMethod.id, JSON.stringify(updatedExtra), userId]
        );
    } catch (error) {
        console.error('[payment-webhook] Failed to save payment method details:', error);
    }
}

async function processRentalPayment(payment, metadata) {
    const { userId, tariffId, debit_from_balance, days } = metadata;
    if (!userId || !tariffId) {
        throw new Error('Missing userId or tariffId in rental payment metadata.');
    }

    const yookassaPaymentId = payment.id;
    if (await paymentExists(yookassaPaymentId)) {
        console.log(`[payment-webhook] Rental payment ${yookassaPaymentId} already processed.`);
        return;
    }

    const amountToDebit = Number.parseFloat(debit_from_balance) || 0;
    const cardPaymentAmount = Number.parseFloat(payment.amount?.value || '0');
    const paymentMethod = getPaymentMethodFromYookassa(payment);

    let rentalDays = days ? Number.parseInt(days, 10) : null;
    if (!rentalDays || !Number.isFinite(rentalDays)) {
        const tariffResult = await query(
            'SELECT duration_days FROM tariffs WHERE id = $1',
            [tariffId]
        );
        rentalDays = tariffResult.rows[0]?.duration_days || 7;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + rentalDays);
    const totalPaid = cardPaymentAmount + amountToDebit;

    await transact(async (dbClient) => {
        if (amountToDebit > 0) {
            await addToBalance(userId, -amountToDebit, dbClient);
        }

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
            VALUES ($1, NULL, $2, $3, $4, $5, $6)
            RETURNING id`,
            [
                userId,
                tariffId,
                startDate.toISOString(),
                endDate.toISOString(),
                'awaiting_battery_assignment',
                totalPaid,
            ]
        );

        const rentalId = rentalInsert.rows[0].id;

        await logPayment({
            clientId: userId,
            rentalId,
            amountRub: cardPaymentAmount,
            status: 'succeeded',
            paymentType: 'rental',
            method: paymentMethod,
            yookassaPaymentId,
        }, dbClient);

        if (amountToDebit > 0) {
            await logPayment({
                clientId: userId,
                rentalId,
                amountRub: amountToDebit,
                status: 'succeeded',
                paymentType: 'rental',
                method: 'balance',
                description: 'Частичная оплата с баланса',
            }, dbClient);
        }
    });
}

async function processBookingPayment(payment, metadata) {
    const { userId } = metadata;
    if (!userId) {
        throw new Error('Missing userId in booking payment metadata.');
    }

    const yookassaPaymentId = payment.id;
    if (await paymentExists(yookassaPaymentId)) {
        console.log(`[payment-webhook] Booking payment ${yookassaPaymentId} already processed.`);
        return;
    }

    const cardPaymentAmount = Number.parseFloat(payment.amount?.value || '0');
    const paymentMethod = getPaymentMethodFromYookassa(payment);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await transact(async (dbClient) => {
        const bookingInsert = await dbClient.query(
            `INSERT INTO bookings (user_id, expires_at, status, cost_rub)
             VALUES ($1, $2, 'active', $3)
             RETURNING id`,
            [userId, expiresAt, cardPaymentAmount]
        );

        const bookingId = bookingInsert.rows[0].id;

        await addToBalance(userId, cardPaymentAmount, dbClient);

        await logPayment({
            clientId: userId,
            bookingId,
            amountRub: cardPaymentAmount,
            status: 'succeeded',
            paymentType: 'booking',
            method: paymentMethod,
            yookassaPaymentId,
        }, dbClient);
    });
}

async function processRenewalPayment(payment, metadata) {
    const { userId, rentalId, debit_from_balance, days } = metadata;
    if (!userId || !rentalId) {
        throw new Error('Missing userId or rentalId in renewal payment metadata.');
    }

    const amountToDebit = Number.parseFloat(debit_from_balance) || 0;
    const cardPaymentAmount = Number.parseFloat(payment.amount?.value || '0');
    const paymentMethod = getPaymentMethodFromYookassa(payment);

    await transact(async (dbClient) => {
        if (amountToDebit > 0) {
            await addToBalance(userId, -amountToDebit, dbClient);
        }

        const rentalResult = await dbClient.query(
            'SELECT current_period_ends_at, total_paid_rub FROM rentals WHERE id = $1 FOR UPDATE',
            [rentalId]
        );
        const rental = rentalResult.rows[0];
        if (!rental) {
            throw new Error(`Rental #${rentalId} not found for renewal.`);
        }

        const daysToAdd = days ? Number.parseInt(days, 10) : 7;
        const newEndDate = new Date(rental.current_period_ends_at || new Date());
        newEndDate.setDate(newEndDate.getDate() + daysToAdd);
        const totalPaid = Number(rental.total_paid_rub || 0) + cardPaymentAmount + amountToDebit;

        await dbClient.query(
            'UPDATE rentals SET current_period_ends_at = $1, total_paid_rub = $2 WHERE id = $3',
            [newEndDate.toISOString(), totalPaid, rentalId]
        );

        await logPayment({
            clientId: userId,
            rentalId,
            amountRub: cardPaymentAmount,
            status: 'succeeded',
            paymentType: 'renewal',
            method: paymentMethod,
            yookassaPaymentId: payment.id,
        }, dbClient);

        if (amountToDebit > 0) {
            await logPayment({
                clientId: userId,
                rentalId,
                amountRub: amountToDebit,
                status: 'succeeded',
                paymentType: 'renewal',
                method: 'balance',
                description: 'Частичная оплата продления с баланса',
            }, dbClient);
        }
    });
}

async function processTopUpPayment(payment, metadata) {
    const { userId } = metadata;
    if (!userId) {
        console.warn('[payment-webhook] Top-up payment without userId; skipping.');
        return;
    }

    const cardPaymentAmount = Number.parseFloat(payment.amount?.value || '0');
    const paymentMethod = getPaymentMethodFromYookassa(payment);
    const yookassaPaymentId = payment.id;

    if (await paymentExists(yookassaPaymentId)) {
        console.log(`[payment-webhook] Top-up payment ${yookassaPaymentId} already processed.`);
        return;
    }

    await transact(async (dbClient) => {
        await addToBalance(userId, cardPaymentAmount, dbClient);
        await logPayment({
            clientId: userId,
            amountRub: cardPaymentAmount,
            status: 'succeeded',
            paymentType: 'top-up',
            method: paymentMethod,
            yookassaPaymentId,
        }, dbClient);
    });
}

async function processSucceededPayment(notification) {
    if (!notification?.object) {
        throw new Error('Invalid notification payload.');
    }

    const payment = notification.object;
    const metadata = payment.metadata || {};
    const paymentType = metadata.payment_type;
    const userId = metadata.userId;

    await savePaymentMethodDetails(userId, payment);

    if (paymentType === 'save_card') {
        return;
    }

    if (paymentType === 'rental' && metadata.tariffId) {
        await processRentalPayment(payment, metadata);
        return;
    }

    if (paymentType === 'booking') {
        await processBookingPayment(payment, metadata);
        return;
    }

    if (paymentType === 'renewal') {
        await processRenewalPayment(payment, metadata);
        return;
    }

    await processTopUpPayment(payment, metadata);
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
            res.status(200).json({ message: 'Ignored non-successful payment event.' });
            return;
        }

        await processSucceededPayment(notification);
        res.status(200).json({ message: 'Webhook processed successfully.' });
    } catch (error) {
        console.error('[payment-webhook] Handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
