const { query } = require('./_lib_db');

let paymentsColumnsCache = null;
let paymentsColumnsPromise = null;

function normalizePhone(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('8')) {
        digits = `7${digits.slice(1)}`;
    }
    if (digits.length === 10 && digits.startsWith('9')) {
        digits = `7${digits}`;
    }
    if (digits.length < 11 || digits.length > 15) {
        return '';
    }
    return `+${digits}`;
}

function getExecutor(dbClient) {
    if (dbClient && typeof dbClient.query === 'function') {
        return dbClient;
    }
    return { query };
}

async function getPaymentsColumns(executor) {
    if (paymentsColumnsCache) {
        return paymentsColumnsCache;
    }
    if (paymentsColumnsPromise) {
        return paymentsColumnsPromise;
    }

    paymentsColumnsPromise = executor
        .query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'payments'`
        )
        .then((result) => {
            paymentsColumnsCache = result.rows.reduce((acc, row) => {
                acc[row.column_name] = true;
                return acc;
            }, {});
            return paymentsColumnsCache;
        })
        .catch((error) => {
            console.error('[finance] Failed to fetch payments columns metadata:', error);
            paymentsColumnsCache = {};
            return paymentsColumnsCache;
        })
        .finally(() => {
            paymentsColumnsPromise = null;
        });

    return paymentsColumnsPromise;
}

async function addToBalance(clientId, amount, dbClient) {
    const executor = getExecutor(dbClient);
    await executor.query('SELECT add_to_balance($1::uuid, $2::numeric)', [clientId, amount]);
}

function toMoscowDate(value = new Date()) {
    const source = value instanceof Date ? value : new Date(value);
    if (!(source instanceof Date) || Number.isNaN(source.getTime())) {
        return new Date();
    }

    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const formatted = formatter.format(source);
    return new Date(`${formatted}+03:00`);
}

function getMoscowIsoString(value) {
    return toMoscowDate(value).toISOString();
}

async function logPayment({
    clientId,
    rentalId = null,
    amountRub,
    status,
    paymentType,
    paymentMethodTitle = null,
    yookassaPaymentId = null,
    description = null,
    method = null,
    bookingId = null,
    createdAt = new Date(),
}, dbClient) {
    const executor = getExecutor(dbClient);
    const columnsMetadata = await getPaymentsColumns(executor);

    const columns = [
        'client_id',
        'rental_id',
        'amount_rub',
        'status',
        'payment_type',
        'payment_method_title',
        'yookassa_payment_id',
        'description',
        'method',
    ];
    const values = [
        clientId,
        rentalId,
        amountRub,
        status,
        paymentType,
        paymentMethodTitle,
        yookassaPaymentId,
        description,
        method,
    ];

    if (bookingId != null && columnsMetadata.booking_id) {
        columns.push('booking_id');
        values.push(bookingId);
    }

    if (columnsMetadata.created_at) {
        const timestamp = getMoscowIsoString(createdAt);
        columns.push('created_at');
        values.push(timestamp);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`);

    await executor.query(
        `INSERT INTO payments (${columns.join(', ')})
         VALUES (${placeholders.join(', ')})`,
        values
    );
}

module.exports = {
    normalizePhone,
    getExecutor,
    addToBalance,
    logPayment,
    toMoscowDate,
    getMoscowIsoString,
};
