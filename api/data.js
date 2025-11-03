<<<<<<< HEAD
/**
 * Data API - универсальный endpoint для замены прямых запросов Supabase
 * Обрабатывает все read-операции через единый интерфейс
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
                result = await supabaseAdmin
                    .from('clients')
                    .select('id, name, verification_status, balance_rub, city, yookassa_payment_method_id, extra')
                    .eq('id', params.userId)
                    .single();
                break;

            case 'get-all-clients':
                result = await supabaseAdmin
                    .from('clients')
                    .select('*')
                    .order('created_at', { ascending: false });
                break;

            // ===== АРЕНДЫ =====
            case 'get-active-rental':
                result = await supabaseAdmin
                    .from('rentals')
                    .select('*, tariffs(*), bikes(*), rental_batteries(batteries(serial_number))')
                    .eq('user_id', params.userId)
                    .in('status', ['active', 'overdue', 'pending_return', 'awaiting_battery_assignment', 'awaiting_contract_signing'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                break;

            case 'get-all-rentals':
                result = await supabaseAdmin
                    .from('rentals')
                    .select('*, tariffs(title), bikes(code), clients(name)')
                    .order('created_at', { ascending: false })
                    .limit(params.limit || 100);
                break;

            // ===== БРОНИРОВАНИЯ =====
            case 'get-active-booking':
                result = await supabaseAdmin
                    .from('bookings')
                    .select('*')
                    .eq('user_id', params.userId)
                    .eq('status', 'active')
                    .gt('expires_at', new Date().toISOString())
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                break;

            case 'get-all-bookings':
                result = await supabaseAdmin
                    .from('bookings')
                    .select('*, clients(name)')
                    .order('created_at', { ascending: false })
                    .limit(params.limit || 100);
                break;

            // ===== ВЕЛОСИПЕДЫ =====
            case 'get-available-bikes':
                result = await supabaseAdmin
                    .from('bikes')
                    .select('id, code, model_name, status')
                    .eq('city', params.city)
                    .eq('status', 'available');
                break;

            case 'get-all-bikes':
                result = await supabaseAdmin
                    .from('bikes')
                    .select('*, tariffs(title)')
                    .order('code', { ascending: true });
                break;

            // ===== ТАРИФЫ =====
            case 'get-tariffs':
                const query = supabaseAdmin
                    .from('tariffs')
                    .select('*')
                    .order('id', { ascending: true });

                if (params.activeOnly) {
                    query.eq('is_active', true);
                }

                result = await query;
                break;

            // ===== ПЛАТЕЖИ =====
            case 'get-all-payments':
                result = await supabaseAdmin
                    .from('payments')
                    .select('*, clients(name)')
                    .order('created_at', { ascending: false })
                    .limit(params.limit || 100);
                break;

            // ===== СТАТИСТИКА (ДЛЯ АДМИНКИ) =====
            case 'get-dashboard-stats':
                const [bikesStats, rentalsStats, paymentsStats] = await Promise.all([
                    // Велосипеды по статусам
                    supabaseAdmin
                        .from('bikes')
                        .select('status')
                        .then(({ data }) => {
                            const stats = { available: 0, rented: 0, maintenance: 0, lost: 0 };
                            data?.forEach(b => stats[b.status] = (stats[b.status] || 0) + 1);
                            return stats;
                        }),

                    // Активные аренды
                    supabaseAdmin
                        .from('rentals')
                        .select('id')
                        .eq('status', 'active')
                        .then(({ data }) => ({ active: data?.length || 0 })),

                    // Доход за неделю
                    supabaseAdmin
                        .from('payments')
                        .select('amount_rub, payment_type')
                        .eq('status', 'succeeded')
                        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                        .then(({ data }) => {
                            const total = data?.reduce((sum, p) => sum + (p.amount_rub || 0), 0) || 0;
                            const breakdown = {};
                            data?.forEach(p => {
                                const type = p.payment_type || 'other';
                                breakdown[type] = (breakdown[type] || 0) + p.amount_rub;
                            });
                            return { total, breakdown };
                        })
                ]);

                result = { data: { bikes: bikesStats, rentals: rentalsStats, payments: paymentsStats } };
                break;

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }

        if (result.error) {
            console.error(`[Data API] ${action} error:`, result.error);
            return res.status(500).json({ error: result.error.message });
        }

        return res.status(200).json(result.data);

    } catch (error) {
        console.error(`[Data API] Unexpected error in ${action}:`, error);
        return res.status(500).json({ error: error.message });
    }
};
=======
module.exports = require('./_lib_data');
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
