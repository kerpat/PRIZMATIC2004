/**
 * Data API - универсальный endpoint для замены прямых запросов Supabase
 * Обрабатывает все read-операции через единый интерфейс
 * ОБНОВЛЕНО: Прямое подключение к PostgreSQL на VPS
 */

<<<<<<< HEAD
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
=======
const { query: dbQuery } = require('./_lib_db');

// Вспомогательная функция для выполнения запросов
async function query(text, params) {
    try {
        const result = await dbQuery(text, params);
        return { data: result.rows, error: null, count: result.rowCount };
    } catch (error) {
        console.error('Database query error:', error);
        return { data: null, error: error.message };
    }
}
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

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
                    AND r.status IN ('active', 'overdue', 'pending_return', 'awaiting_battery_assignment', 'awaiting_contract_signing')
                    ORDER BY r.created_at DESC
                    LIMIT 1`,
                    [params.userId]
                );
                if (result.data && result.data.length > 0) {
                    result.data = result.data[0];
                } else {
                    result.error = 'No active rental found';
                }
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
                if (result.data && result.data.length > 0) {
                    result.data = result.data[0];
                } else {
                    result.error = 'No active booking found';
                }
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

        return res.status(200).json(result.data);

    } catch (error) {
        console.error(`[Data API] Unexpected error in ${action}:`, error);
        return res.status(500).json({ error: error.message });
    }
};
