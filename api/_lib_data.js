/**
 * Data API - универсальный endpoint для замены прямых запросов Supabase
 * Обрабатывает все read-операции через единый интерфейс
 * ОБНОВЛЕНО: Прямое подключение к PostgreSQL на VPS
 */

const { query: dbQuery } = require('./_lib_db');

const IDENTIFIER_REGEX = /^[a-zA-Z0-9_.]+$/;
const SELECT_CLAUSE_REGEX = /^[a-zA-Z0-9_*.,()\s"'>:<={}\[\]\-]+$/;

function quoteIdentifier(identifier) {
    if (typeof identifier !== 'string' || !IDENTIFIER_REGEX.test(identifier)) {
        throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier
        .split('.')
        .map((part) => `"${part.replace(/"/g, '""')}"`)
        .join('.');
}

function validateSelectClause(selectClause = '*') {
    const clause = selectClause.trim();
    if (clause === '*') {
        return '*';
    }
    if (!SELECT_CLAUSE_REGEX.test(clause) || clause.includes(';') || clause.includes('--')) {
        throw new Error('Invalid select clause');
    }
    return clause;
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
                    clauses.push('FALSE'); // empty IN should return nothing
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

async function executeQuery(text, params) {
    const result = await dbQuery(text, params);
    return { rows: result.rows, count: result.rowCount ?? null };
}

async function handleSelect(params) {
    const {
        table,
        select = '*',
        filters = [],
        order = null,
        limit = null,
        offset = null,
        single = false,
        maybeSingle = false,
    } = params;

    if (!table) {
        throw new Error('Table name is required for select action.');
    }

    const values = [];
    let sql = `SELECT ${validateSelectClause(select)} FROM ${quoteIdentifier(table)}`;

    const whereClause = buildWhereClause(filters, values);
    if (whereClause) {
        sql += ` WHERE ${whereClause}`;
    }

    if (order?.field) {
        const direction = order.direction === 'desc' ? 'DESC' : 'ASC';
        sql += ` ORDER BY ${quoteIdentifier(order.field)} ${direction}`;
    }

    const parsedOffset = offset == null ? null : Number(offset);
    if (Number.isFinite(parsedOffset) && parsedOffset >= 0) {
        values.push(parsedOffset);
        sql += ` OFFSET $${values.length}`;
    }

    const parsedLimit = limit == null ? null : Number(limit);
    if (Number.isFinite(parsedLimit) && parsedLimit >= 0) {
        values.push(parsedLimit);
        sql += ` LIMIT $${values.length}`;
    }

    const { rows, count } = await executeQuery(sql, values);
    let data = rows;

    if (single) {
        if (rows.length === 0) {
            if (maybeSingle) {
                data = null;
            } else {
                return { data: null, error: 'Record not found.', count: 0, wrapResponse: true };
            }
        } else {
            data = rows[0];
        }
    }

return { data, error: null, count, wrapResponse: true };
}

function prepareValue(value) {
    if (value === undefined) {
        return null;
    }
    if (value === null) {
        return null;
    }
    if (value instanceof Date) {
        return value;
    }
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        try {
            return JSON.stringify(value);
        } catch (error) {
            console.warn('[Data API] Failed to serialize value to JSON:', error);
            return JSON.stringify({});
        }
    }
    return value;
}

async function handleInsert(params) {
    const { table, data, returning = '*' } = params;
    if (!table) {
        throw new Error('Table name is required for insert action.');
    }
    if (!data || (Array.isArray(data) && data.length === 0)) {
        throw new Error('Insert action requires data payload.');
    }

    const records = Array.isArray(data) ? data : [data];
    const columns = Object.keys(records[0] || {});
    if (columns.length === 0) {
        throw new Error('Insert action requires at least one column.');
    }

    const quotedColumns = columns.map(quoteIdentifier).join(', ');
    const values = [];
    const rowsPlaceholders = records.map((record) => {
        const placeholders = columns.map((column) => {
            values.push(prepareValue(record[column]));
            return `$${values.length}`;
        });
        return `(${placeholders.join(', ')})`;
    });

    const sql = `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES ${rowsPlaceholders.join(', ')} RETURNING ${validateSelectClause(returning)}`;
    const { rows, count } = await executeQuery(sql, values);

    return { data: rows, error: null, count, wrapResponse: true };
}

async function handleUpdate(params) {
    const { table, data, filters = [], returning = '*' } = params;
    if (!table) {
        throw new Error('Table name is required for update action.');
    }
    if (!data || typeof data !== 'object') {
        throw new Error('Update action requires data payload.');
    }

    const columns = Object.keys(data);
    if (columns.length === 0) {
        throw new Error('Update action requires at least one column.');
    }

    const values = [];
    const setClauses = columns.map((column) => {
        values.push(prepareValue(data[column]));
        return `${quoteIdentifier(column)} = $${values.length}`;
    });

    const whereClause = buildWhereClause(filters, values);
    if (!whereClause) {
        throw new Error('Update action requires at least one filter.');
    }

    const sql = `UPDATE ${quoteIdentifier(table)} SET ${setClauses.join(', ')} WHERE ${whereClause} RETURNING ${validateSelectClause(returning)}`;
    const { rows, count } = await executeQuery(sql, values);

    // Если обновляется таблица аренды и есть обновление статуса, отправляем SSE уведомление
    if (table === 'rentals' && data.status && rows && rows.length > 0) {
        const updatedRental = rows[0];
        if (updatedRental.user_id) {
            // Отправляем SSE уведомление пользователю
            try {
                const { notifyUserUpdate } = require('./_lib_sse_helpers');
                notifyUserUpdate(updatedRental.user_id, 'rental_update', {
                    rentalId: updatedRental.id,
                    status: updatedRental.status,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error sending SSE notification:', error.message);
            }
        }
    }

    return { data: rows, error: null, count, wrapResponse: true };
}

async function handleDelete(params) {
    const { table, filters = [], returning = '*' } = params;
    if (!table) {
        throw new Error('Table name is required for delete action.');
    }

    const values = [];
    const whereClause = buildWhereClause(filters, values);
    if (!whereClause) {
        throw new Error('Delete action requires at least one filter.');
    }

    const sql = `DELETE FROM ${quoteIdentifier(table)} WHERE ${whereClause} RETURNING ${validateSelectClause(returning)}`;
    const { rows, count } = await executeQuery(sql, values);

    return { data: rows, error: null, count, wrapResponse: true };
}

async function handleRpc(params) {
    const { function: functionName, params: rpcParams = {} } = params;
    if (!functionName || !IDENTIFIER_REGEX.test(functionName)) {
        throw new Error('Invalid function name for RPC action.');
    }

    const keys = Object.keys(rpcParams);
    const values = keys.map((key) => rpcParams[key]);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const sql = `SELECT * FROM ${quoteIdentifier(functionName)}(${placeholders})`;

    const { rows, count } = await executeQuery(sql, values);
    return { data: rows, error: null, count, wrapResponse: true };
}

// Вспомогательная функция для выполнения запросов в существующих кейсах
async function query(text, params) {
    try {
        const { rows, count } = await executeQuery(text, params);
        return { data: rows, error: null, count };
    } catch (error) {
        console.error('Database query error:', error);
        return { data: null, error: error.message };
    }
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, ...params } = req.body;

    try {
        let result;

        switch (action) {
            case 'select':
                result = await handleSelect(params);
                break;
            case 'insert':
                result = await handleInsert(params);
                break;
            case 'update':
                result = await handleUpdate(params);
                break;
            case 'delete':
                result = await handleDelete(params);
                break;
            case 'rpc':
                result = await handleRpc(params);
                break;
            // ===== КЛИЕНТЫ =====
            case 'get-client':
                result = await query(
                    'SELECT id, name, verification_status, balance_rub, city, yookassa_payment_method_id, extra FROM clients WHERE id = $1',
                    [params.userId]
                );
                if (result.data && result.data.length > 0) {
                    result.data = result.data[0];
                }
                break;

            case 'get-all-clients':
                result = await query(
                    'SELECT * FROM clients ORDER BY created_at DESC',
                    []
                );
                break;

            // ===== АРЕНДЫ =====
            case 'get-active-rental':
                result = await query(
                    `SELECT r.*, 
                        jsonb_build_object('title', t.title, 'price_rub', t.price_rub, 'duration_days', t.duration_days) as tariffs,
                        jsonb_build_object('id', b.id, 'bike_code', b.bike_code, 'model_name', b.model_name) as bikes
                    FROM rentals r
                    LEFT JOIN tariffs t ON r.tariff_id = t.id
                    LEFT JOIN bikes b ON r.bike_id = b.id
                    WHERE r.user_id = $1 
                    AND r.status IN ('active', 'overdue', 'pending_return', 'awaiting_battery_assignment', 'awaiting_contract_signing', 'awaiting_return_signature')
                    ORDER BY r.created_at DESC
                    LIMIT 1`,
                    [params.userId]
                );
                result.data = result.data && result.data.length > 0 ? result.data[0] : null;
                break;

            case 'get-all-rentals':
                const limit = params.limit || 100;
                result = await query(
                    `SELECT r.*, 
                        t.title as tariff_title,
                        b.bike_code,
                        c.name as client_name
                    FROM rentals r
                    LEFT JOIN tariffs t ON r.tariff_id = t.id
                    LEFT JOIN bikes b ON r.bike_id = b.id
                    LEFT JOIN clients c ON r.user_id = c.id
                    ORDER BY r.created_at DESC
                    LIMIT $1`,
                    [limit]
                );
                break;

            // ===== БРОНИРОВАНИЯ =====
            case 'get-active-booking':
                result = await query(
                    `SELECT * FROM bookings 
                    WHERE user_id = $1 
                    AND status = 'active' 
                    AND expires_at > NOW()
                    ORDER BY created_at DESC
                    LIMIT 1`,
                    [params.userId]
                );
                result.data = result.data && result.data.length > 0 ? result.data[0] : null;
                break;

            case 'get-all-bookings':
                result = await query(
                    `SELECT b.*, c.name as client_name
                    FROM bookings b
                    LEFT JOIN clients c ON b.user_id = c.id
                    ORDER BY b.created_at DESC
                    LIMIT $1`,
                    [params.limit || 100]
                );
                break;

            // ===== ВЕЛОСИПЕДЫ =====
            case 'get-available-bikes':
                result = await query(
                    `SELECT id, bike_code, model_name, status 
                    FROM bikes 
                    WHERE city = $1 AND status = 'available'`,
                    [params.city]
                );
                break;

            case 'get-all-bikes':
                result = await query(
                    `SELECT b.*, t.title as tariff_title
                    FROM bikes b
                    LEFT JOIN tariffs t ON b.tariff_id = t.id
                    ORDER BY b.bike_code ASC`,
                    []
                );
                break;

            // ===== ТАРИФЫ =====
            case 'get-tariffs':
                if (params.activeOnly) {
                    result = await query(
                        'SELECT * FROM tariffs WHERE is_active = true ORDER BY id ASC',
                        []
                    );
                } else {
                    result = await query(
                        'SELECT * FROM tariffs ORDER BY id ASC',
                        []
                    );
                }
                break;

            // ===== ПЛАТЕЖИ =====
            case 'get-all-payments':
                result = await query(
                    `SELECT p.*, c.name as client_name
                    FROM payments p
                    LEFT JOIN clients c ON p.client_id = c.id
                    ORDER BY p.created_at DESC
                    LIMIT $1`,
                    [params.limit || 100]
                );
                break;

            case 'get-payments-range': {
                const conditions = [];
                const values = [];
                let idx = 1;

                if (params.userId) {
                    conditions.push(`p.client_id = $${idx}`);
                    values.push(params.userId);
                    idx += 1;
                }
                if (params.startDate) {
                    const start = new Date(params.startDate);
                    if (!Number.isNaN(start.getTime())) {
                        conditions.push(`p.created_at >= $${idx}`);
                        values.push(start);
                        idx += 1;
                    }
                }
                if (params.endDate) {
                    const end = new Date(params.endDate);
                    if (!Number.isNaN(end.getTime())) {
                        conditions.push(`p.created_at <= $${idx}`);
                        values.push(end);
                        idx += 1;
                    }
                }
                if (Array.isArray(params.paymentTypes) && params.paymentTypes.length > 0) {
                    conditions.push(`p.payment_type = ANY($${idx})`);
                    values.push(params.paymentTypes);
                    idx += 1;
                }

                let sql = `SELECT p.*, c.name as client_name
                           FROM payments p
                           LEFT JOIN clients c ON p.client_id = c.id`;

                if (conditions.length > 0) {
                    sql += ` WHERE ${conditions.join(' AND ')}`;
                }

                sql += ' ORDER BY p.created_at DESC';

                if (params.limit) {
                    sql += ` LIMIT $${idx}`;
                    values.push(Number(params.limit));
                }

                result = await query(sql, values);
                break;
            }

            case 'get-rental-batteries':
                if (!params.rentalId) {
                    return res.status(400).json({ error: 'rentalId is required' });
                }
                result = await query(
                    `SELECT b.serial_number
                     FROM rental_batteries rb
                     JOIN batteries b ON b.id = rb.battery_id
                     WHERE rb.rental_id = $1
                     ORDER BY b.serial_number ASC`,
                    [params.rentalId]
                );
                break;

            // ===== СТАТИСТИКА (ДЛЯ АДМИНКИ) =====
            case 'get-dashboard-stats':
                // Велосипеды по статусам
                const bikesResult = await query(
                    'SELECT status, COUNT(*) as count FROM bikes GROUP BY status',
                    []
                );
                const bikesStats = { available: 0, in_use: 0, maintenance: 0, lost: 0 };
                bikesResult.data?.forEach(row => {
                    bikesStats[row.status] = parseInt(row.count);
                });

                // Активные аренды
                const rentalsResult = await query(
                    "SELECT COUNT(*) as count FROM rentals WHERE status = 'active'",
                    []
                );
                const rentalsStats = { active: parseInt(rentalsResult.data?.[0]?.count || 0) };

                // Доход за неделю
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const paymentsResult = await query(
                    `SELECT amount_rub, payment_type 
                    FROM payments 
                    WHERE status = 'succeeded' AND created_at >= $1`,
                    [weekAgo]
                );
                
                let totalRevenue = 0;
                const breakdown = {};
                paymentsResult.data?.forEach(p => {
                    const amount = parseFloat(p.amount_rub || 0);
                    totalRevenue += amount;
                    const type = p.payment_type || 'other';
                    breakdown[type] = (breakdown[type] || 0) + amount;
                });

                result = { 
                    data: { 
                        bikes: bikesStats, 
                        rentals: rentalsStats, 
                        payments: { total: totalRevenue, breakdown } 
                    },
                    error: null
                };
                break;

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }

        if (result.error) {
            console.error(`[Data API] ${action} error:`, result.error);
            return res.status(500).json({ error: result.error });
        }

        if (result.wrapResponse) {
            return res.status(200).json({
                data: result.data ?? null,
                error: null,
                count: typeof result.count === 'number' ? result.count : null,
            });
        }

        return res.status(200).json(result.data);

    } catch (error) {
        console.error(`[Data API] Unexpected error in ${action}:`, error);
        return res.status(500).json({ error: error.message });
    }
};
