const fetch = require('node-fetch');
const crypto = require('crypto');

const { query, transact } = require('./_lib_db');
const { normalizePhone, addToBalance, logPayment } = require('./_lib_finance');
const { listObjects } = require('./_lib_storage_backend');

const IDENTIFIER_REGEX = /^[a-zA-Z0-9_.]+$/;

function getAdminSecret() {
    const secret = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PASSWORD || null;
    if (!secret) {
        throw new Error('ADMIN_SECRET_KEY is not configured. Set ADMIN_SECRET_KEY or ADMIN_PASSWORD env variable.');
    }
    return secret;
}

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function createAdminToken(email) {
    const secret = getAdminSecret();
    const normalizedEmail = normalizeEmail(email) || 'admin';
    const issuedAt = Date.now();
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${normalizedEmail}:${issuedAt}`)
        .digest('hex');

    const payload = {
        email: normalizedEmail,
        iat: issuedAt,
        sig: signature,
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function verifyAdminToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }

    try {
        const decodedJson = Buffer.from(token, 'base64url').toString('utf8');
        const payload = JSON.parse(decodedJson);
        const { email = 'admin', iat, sig } = payload || {};
        if (!iat || !sig) {
            return false;
        }

        const secret = getAdminSecret();
        const expectedSig = crypto
            .createHmac('sha256', secret)
            .update(`${normalizeEmail(email)}:${iat}`)
            .digest('hex');

        const sigBuffer = Buffer.from(sig, 'hex');
        const expectedBuffer = Buffer.from(expectedSig, 'hex');

        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }

        if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
            return false;
        }

        const tokenAgeMs = Date.now() - Number(iat);
        const maxAgeMs = 24 * 60 * 60 * 1000; // 24 часа
        if (tokenAgeMs > maxAgeMs) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('[admin] Failed to verify admin token:', error);
        return false;
    }
}

function requireAdminAuth(req) {
    let authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    if (Array.isArray(authHeader)) {
        authHeader = authHeader[0] || '';
    }
    if (typeof authHeader !== 'string') {
        return { status: 401, body: { error: 'Unauthorized' } };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!verifyAdminToken(token)) {
        return { status: 401, body: { error: 'Unauthorized' } };
    }

    return null;
}

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

async function handleListSupportChats() {
    const anonymousResult = await query(
        `SELECT *
         FROM (
             SELECT
                 anonymous_chat_id,
                 message_text,
                 created_at,
                 ROW_NUMBER() OVER (PARTITION BY anonymous_chat_id ORDER BY created_at DESC) AS rn,
                 SUM(CASE WHEN sender = 'user' AND is_read = false THEN 1 ELSE 0)
                     OVER (PARTITION BY anonymous_chat_id) AS unread_count
             FROM support_messages
             WHERE anonymous_chat_id IS NOT NULL
         ) AS sub
         WHERE rn = 1
         ORDER BY created_at DESC`,
        []
    );

    const clientResult = await query(
        `SELECT *
         FROM (
             SELECT
                 sm.client_id,
                 sm.message_text,
                 sm.created_at,
                 ROW_NUMBER() OVER (PARTITION BY sm.client_id ORDER BY sm.created_at DESC) AS rn,
                 SUM(CASE WHEN sm.sender = 'user' AND sm.is_read = false THEN 1 ELSE 0)
                     OVER (PARTITION BY sm.client_id) AS unread_count
             FROM support_messages sm
             WHERE sm.client_id IS NOT NULL
         ) AS sub
         LEFT JOIN clients c ON c.id = sub.client_id
         WHERE rn = 1
         ORDER BY sub.created_at DESC`,
        []
    );

    return {
        status: 200,
        body: {
            anonymousChats: anonymousResult.rows.map((row) => ({
                anonymous_chat_id: row.anonymous_chat_id,
                last_message_text: row.message_text,
                last_message_at: row.created_at,
                unread_count: Number(row.unread_count || 0),
            })),
            clientChats: clientResult.rows.map((row) => ({
                client_id: row.client_id,
                last_message_text: row.message_text,
                last_message_at: row.created_at,
                unread_count: Number(row.unread_count || 0),
                name: row.name || null,
                phone: row.phone || null,
            })),
        },
    };
}

async function handleGetSupportHistory({ clientId, anonymousChatId }) {
    if (!clientId && !anonymousChatId) {
        return { status: 400, body: { error: 'clientId or anonymousChatId is required.' } };
    }
    const conditions = [];
    const values = [];

    if (clientId) {
        conditions.push(`client_id = $${values.length + 1}`);
        values.push(clientId);
    }

    if (anonymousChatId) {
        conditions.push(`anonymous_chat_id = $${values.length + 1}`);
        values.push(anonymousChatId);
    }

    const result = await query(
        `SELECT id, created_at, sender, message_text, file_url, file_type, is_read,
                client_id, anonymous_chat_id
         FROM support_messages
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at ASC`,
        values
    );

    return { status: 200, body: { messages: result.rows } };
}

async function handleSendSupportMessageAdmin({ clientId, anonymousChatId, messageText, fileUrl, fileType }) {
    if (!clientId && !anonymousChatId) {
        return { status: 400, body: { error: 'clientId or anonymousChatId is required.' } };
    }
    if (!messageText && !fileUrl) {
        return { status: 400, body: { error: 'Message must contain text or file.' } };
    }

    const result = await query(
        `INSERT INTO support_messages
            (client_id, anonymous_chat_id, sender, message_text, file_url, file_type, is_read)
         VALUES ($1, $2, 'admin', $3, $4, $5, true)
         RETURNING id, created_at, sender, message_text, file_url, file_type, is_read,
                   client_id, anonymous_chat_id`,
        [clientId || null, anonymousChatId || null, messageText || '', fileUrl || null, fileType || null]
    );

    return { status: 200, body: { message: result.rows[0] } };
}

async function handleMarkSupportUserRead({ clientId, anonymousChatId }) {
    if (!clientId && !anonymousChatId) {
        return { status: 400, body: { error: 'clientId or anonymousChatId is required.' } };
    }

    const conditions = [`sender = 'user'`, 'is_read = false'];
    const values = [];

    if (clientId) {
        conditions.push(`client_id = $${values.length + 1}`);
        values.push(clientId);
    }

    if (anonymousChatId) {
        conditions.push(`anonymous_chat_id = $${values.length + 1}`);
        values.push(anonymousChatId);
    }

    await query(
        `UPDATE support_messages
         SET is_read = true
         WHERE ${conditions.join(' AND ')}`,
        values
    );

    return { status: 200, body: { success: true } };
}

async function handleListStorageFiles({ bucket, prefix }) {
    if (!bucket) {
        return { status: 400, body: { error: 'bucket is required.' } };
    }

    try {
        const files = await listObjects({ bucket, prefix });
        return { status: 200, body: { files } };
    } catch (error) {
        console.error('[admin] handleListStorageFiles error:', error);
        return { status: 500, body: { error: error.message } };
    }
}

async function handleLogin({ email, password }) {
    try {
        const secret = getAdminSecret();
        const expectedEmail = process.env.ADMIN_EMAIL ? normalizeEmail(process.env.ADMIN_EMAIL) : null;
        const providedEmail = normalizeEmail(email);

        if (expectedEmail && providedEmail !== expectedEmail) {
            return { status: 401, body: { error: 'Invalid credentials.' } };
        }

        if (typeof password !== 'string') {
            return { status: 401, body: { error: 'Invalid credentials.' } };
        }

        const providedBuffer = Buffer.from(password, 'utf8');
        const secretBuffer = Buffer.from(secret, 'utf8');

        if (providedBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(providedBuffer, secretBuffer)) {
            return { status: 401, body: { error: 'Invalid credentials.' } };
        }

        const token = createAdminToken(providedEmail || expectedEmail || 'admin');
        return {
            status: 200,
            body: {
                token,
                expiresIn: 24 * 60 * 60, // seconds
            },
        };
    } catch (error) {
        console.error('[admin] Login handler error:', error);
        return { status: 500, body: { error: 'Admin login is not configured.' } };
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
    });

    return { status: 200, body: { message: 'Balance adjusted successfully.' } };
}

function quoteIdentifier(identifier) {
    if (typeof identifier !== 'string' || !IDENTIFIER_REGEX.test(identifier)) {
        throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier
        .split('.')
        .map((part) => `"${part.replace(/"/g, '""')}"`)
        .join('.');
}

function buildWhereClause(filters = [], values = []) {
    if (!Array.isArray(filters) || filters.length === 0) {
        return '';
    }

    const clauses = [];
    filters.forEach((filter) => {
        const { field, operator, value } = filter || {};
        const quotedField = quoteIdentifier(field);

        switch (operator) {
            case 'eq':
                values.push(value);
                clauses.push(`${quotedField} = $${values.length}`);
                break;
            case 'neq':
                values.push(value);
                clauses.push(`${quotedField} <> $${values.length}`);
                break;
            case 'gt':
                values.push(value);
                clauses.push(`${quotedField} > $${values.length}`);
                break;
            case 'gte':
                values.push(value);
                clauses.push(`${quotedField} >= $${values.length}`);
                break;
            case 'lt':
                values.push(value);
                clauses.push(`${quotedField} < $${values.length}`);
                break;
            case 'lte':
                values.push(value);
                clauses.push(`${quotedField} <= $${values.length}`);
                break;
            case 'like':
                values.push(value);
                clauses.push(`${quotedField} LIKE $${values.length}`);
                break;
            case 'ilike':
                values.push(value);
                clauses.push(`${quotedField} ILIKE $${values.length}`);
                break;
            case 'in':
                if (!Array.isArray(value) || value.length === 0) {
                    clauses.push('FALSE');
                } else {
                    const placeholders = value.map((val) => {
                        values.push(val);
                        return `$${values.length}`;
                    });
                    clauses.push(`${quotedField} IN (${placeholders.join(', ')})`);
                }
                break;
            case 'is':
                if (value === null || value === 'null') {
                    clauses.push(`${quotedField} IS NULL`);
                } else {
                    clauses.push(`${quotedField} IS NOT NULL`);
                }
                break;
            default:
                throw new Error(`Unsupported filter operator: ${operator}`);
        }
    });

    return clauses.length > 0 ? clauses.join(' AND ') : '';
}

function appendOrderLimit(sqlParts, order, limit, offset, values) {
    if (order?.field) {
        const direction = order.direction === 'desc' ? 'DESC' : 'ASC';
        sqlParts.push(`ORDER BY ${quoteIdentifier(order.field)} ${direction}`);
    }
    const offsetValue = Number(offset);
    if (Number.isFinite(offsetValue) && offsetValue >= 0) {
        values.push(offsetValue);
        sqlParts.push(`OFFSET $${values.length}`);
    }
    const limitValue = Number(limit);
    if (Number.isFinite(limitValue) && limitValue >= 0) {
        values.push(limitValue);
        sqlParts.push(`LIMIT $${values.length}`);
    }
}

async function selectRentalsWithRelations({ filters = [], order = null, limit = null, offset = null }) {
    const values = [];
    const whereClause = buildWhereClause(filters, values);

    const sqlParts = [
        `SELECT 
            r.id,
            r.user_id,
            r.bike_id,
            r.tariff_id,
            r.starts_at,
            r.current_period_ends_at,
            r.total_paid_rub,
            r.status,
            r.extra_data,
            r.created_at,
            jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'phone', c.phone
            ) AS clients,
            jsonb_build_object(
                'id', t.id,
                'title', t.title,
                'price_rub', t.price_rub,
                'duration_days', t.duration_days
            ) AS tariffs,
            jsonb_build_object(
                'id', b.id,
                'model_name', b.model_name,
                'bike_code', b.bike_code
            ) AS bikes,
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'batteries', jsonb_build_object(
                                'id', bt.id,
                                'serial_number', bt.serial_number
                            )
                        )
                    )
                    FROM rental_batteries rb
                    LEFT JOIN batteries bt ON bt.id = rb.battery_id
                    WHERE rb.rental_id = r.id
                ),
                '[]'::jsonb
            ) AS rental_batteries
        FROM rentals r
        LEFT JOIN clients c ON c.id = r.user_id
        LEFT JOIN tariffs t ON t.id = r.tariff_id
        LEFT JOIN bikes b ON b.id = r.bike_id`
    ];

    if (whereClause) {
        sqlParts.push(`WHERE ${whereClause}`);
    }

    appendOrderLimit(sqlParts, order, limit, offset, values);

    const result = await query(sqlParts.join('\n'), values);
    return result.rows ?? [];
}

async function selectBookingsWithClient({ filters = [], order = null, limit = null, offset = null }) {
    const values = [];
    const whereClause = buildWhereClause(filters, values);

    const sqlParts = [
        `SELECT 
            b.*,
            jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'phone', c.phone
            ) AS clients
        FROM bookings b
        LEFT JOIN clients c ON c.id = b.user_id`
    ];

    if (whereClause) {
        sqlParts.push(`WHERE ${whereClause}`);
    }

    appendOrderLimit(sqlParts, order, limit, offset, values);

    const result = await query(sqlParts.join('\n'), values);
    return result.rows ?? [];
}

async function selectPaymentsWithClient({ filters = [], order = null, limit = null, offset = null }) {
    const values = [];
    const whereClause = buildWhereClause(filters, values);

    const sqlParts = [
        `SELECT 
            p.*,
            jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'phone', c.phone
            ) AS clients
        FROM payments p
        LEFT JOIN clients c ON c.id = p.client_id`
    ];

    if (whereClause) {
        sqlParts.push(`WHERE ${whereClause}`);
    }

    appendOrderLimit(sqlParts, order, limit, offset, values);

    const result = await query(sqlParts.join('\n'), values);
    return result.rows ?? [];
}

async function handleAssignBike({ rental_id, bike_id }) {
    const rentalId = parseInt(rental_id, 10);
    const bikeId = parseInt(bike_id, 10);

    if (!rentalId || !bikeId || Number.isNaN(rentalId) || Number.isNaN(bikeId)) {
        return { status: 400, body: { error: 'Некорректный ID аренды или велосипеда.' } };
    }

    try {
        await query('SELECT assign_bike_to_rental($1::bigint, $2::integer)', [rentalId, bikeId]);

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

    const clientResult = await query(
        'SELECT id, yookassa_payment_method_id, phone, balance_rub FROM clients WHERE id = $1',
        [userId]
    );
    const client = clientResult.rows[0];
    if (!client) {
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

    return { status: 200, body: { rentals: result.rows } };
}

async function handleFinalizeReturn({ rental_id, new_bike_status, service_reason, return_act_url, defects }) {
    if (!rental_id || !new_bike_status) {
        return { status: 400, body: { error: 'rental_id and new_bike_status are required.' } };
    }

    const rentalResult = await query(
        'SELECT bike_id, user_id, extra_data FROM rentals WHERE id = $1',
        [rental_id]
    );
    const rental = rentalResult.rows[0];

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

    const chargeAmount = Number(amount);
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
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

    const rentalResult = await query(
        `SELECT r.user_id, c.telegram_user_id
         FROM rentals r
         LEFT JOIN clients c ON c.id = r.user_id
         WHERE r.id = $1`,
        [rentalId]
    );

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

        if (action === 'login') {
            const loginResult = await handleLogin(body);
            return res.status(loginResult.status).json(loginResult.body);
        }

        const authError = requireAdminAuth(req);
        if (authError) {
            return res.status(authError.status).json(authError.body);
        }

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
            case 'list-storage-files':
                result = await handleListStorageFiles(body);
                break;
            case 'list-support-chats':
                result = await handleListSupportChats();
                break;
            case 'get-support-history':
                result = await handleGetSupportHistory(body);
                break;
            case 'send-support-message-admin':
                result = await handleSendSupportMessageAdmin(body);
                break;
            case 'mark-support-user-read':
                result = await handleMarkSupportUserRead(body);
                break;
            case 'select-rentals-with-relations': {
                const rows = await selectRentalsWithRelations({
                    filters: Array.isArray(body.filters) ? body.filters : [],
                    order: body.order || null,
                    limit: body.limit != null ? Number(body.limit) : null,
                    offset: body.offset != null ? Number(body.offset) : null,
                });

                if (body.single) {
                    const row = rows[0] || null;
                    if (!row && !body.maybeSingle) {
                        result = { status: 404, body: { error: 'Record not found' } };
                    } else {
                        result = { status: 200, body: { data: row } };
                    }
                } else {
                    result = { status: 200, body: { data: rows } };
                }
                break;
            }
            case 'select-bookings-with-client': {
                const rows = await selectBookingsWithClient({
                    filters: Array.isArray(body.filters) ? body.filters : [],
                    order: body.order || null,
                    limit: body.limit != null ? Number(body.limit) : null,
                    offset: body.offset != null ? Number(body.offset) : null,
                });
                result = { status: 200, body: { data: rows } };
                break;
            }
            case 'select-payments-with-client': {
                const rows = await selectPaymentsWithClient({
                    filters: Array.isArray(body.filters) ? body.filters : [],
                    order: body.order || null,
                    limit: body.limit != null ? Number(body.limit) : null,
                    offset: body.offset != null ? Number(body.offset) : null,
                });
                result = { status: 200, body: { data: rows } };
                break;
            }
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
