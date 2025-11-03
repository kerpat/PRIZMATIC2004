<<<<<<< HEAD
const { createClient } = require('@supabase/supabase-js');
=======
const { query } = require('./_lib_db');
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

function createSupabaseAdmin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        // Если переменных нет, мы увидим это в логах
        console.error('CRITICAL: Supabase credentials are not configured in Vercel Environment Variables.');
        throw new Error('Supabase service credentials are not configured.');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ... parseRequestBody остается без изменений ...
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

<<<<<<< HEAD

export default async function handler(req, res) {
    // ... CORS и проверка метода остаются без изменений ...
=======
module.exports = async function handler(req, res) {
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
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
        const { bikeCode } = body;

<<<<<<< HEAD
        // --- ОТЛАДОЧНЫЙ ЛОГ №1 ---
        console.log(`[DEBUG] Received request for bikeCode: "${bikeCode}"`);

        if (!bikeCode) {
            return res.status(400).json({ error: 'bikeCode is required' });
        }

        const supabase = createSupabaseAdmin();

        // --- ОТЛАДОЧНЫЙ ЛОГ №2 ---
        console.log('[DEBUG] Supabase admin client created. Starting query for bike...');

        const { data: bike, error: bikeError } = await supabase
            .from('bikes')
            .select('id, status, tariff_id')
            .eq('bike_code', bikeCode)
            .single();

        // --- ОТЛАДОЧНЫЙ ЛОГ №3 ---
        if (bikeError) {
            // Если есть ошибка, мы ее увидим
            console.error('[DEBUG] Supabase error while fetching bike:', bikeError);
        }
        if (!bike) {
            // Если ничего не найдено, это тоже будет видно
            console.log('[DEBUG] No bike found in database for this code.');
        }

        if (bikeError || !bike) {
            return res.status(404).json({ error: 'Велосипед не найден' });
        }

        // --- ОТЛАДОЧНЫЙ ЛОГ №4 ---
        console.log('[DEBUG] Bike found:', JSON.stringify(bike));
        console.log('[DEBUG] Now fetching tariff with ID:', bike.tariff_id);

        // ... остальная часть кода остается без изменений ...

        if (bike.status !== 'available') {
            return res.status(400).json({ error: 'Велосипед недоступен для аренды' });
        }
        if (!bike.tariff_id) {
            return res.status(400).json({ error: 'У велосипеда не указан тариф' });
        }
        const { data: tariff, error: tariffError } = await supabase
            .from('tariffs')
            .select('*')
            .eq('id', bike.tariff_id)
            .eq('is_active', true)
            .single();

        if (tariffError || !tariff) {
            return res.status(404).json({ error: 'Тариф не найден или неактивен' });
        }

        const formattedTariff = {
            id: tariff.id,
            slug: tariff.slug || tariff.title.toLowerCase().replace(/\s+/g, '-'),
            title: tariff.title,
            price_rub: tariff.price_rub,
            duration_days: tariff.duration_days,
            deposit_rub: tariff.deposit_rub || 0,
            extensions: tariff.extensions ? (typeof tariff.extensions === 'string' ? JSON.parse(tariff.extensions) : tariff.extensions) : null,
            description: tariff.description || '',
            short_description: tariff.short_description || ''
        };

        res.status(200).json({ tariff: formattedTariff });

    } catch (error) {
        console.error('getTariffByBike Handler Error:', error);
        res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера.' });
    }
}
=======
        console.log(`[getTariffByBike] Received bikeCode="${bikeCode}"`);

        if (!bikeCode) {
            res.status(400).json({ error: 'bikeCode is required' });
            return;
        }

        const bikeResult = await query(
            'SELECT id, status, tariff_id FROM bikes WHERE bike_code = $1 LIMIT 1',
            [bikeCode]
        );

        const bike = bikeResult.rows[0];
        if (!bike) {
            res.status(404).json({ error: 'Велосипед не найден' });
            return;
        }

        if (bike.status !== 'available') {
            res.status(400).json({ error: 'Велосипед недоступен для аренды' });
            return;
        }

        if (!bike.tariff_id) {
            res.status(400).json({ error: 'У велосипеда не указан тариф' });
            return;
        }

        const tariffResult = await query(
            'SELECT * FROM tariffs WHERE id = $1 AND is_active = true LIMIT 1',
            [bike.tariff_id]
        );

        const tariff = tariffResult.rows[0];
        if (!tariff) {
            res.status(404).json({ error: 'Тариф не найден или неактивен' });
            return;
        }

        const formattedTariff = {
            id: tariff.id,
            slug: tariff.slug || tariff.title?.toLowerCase()?.replace(/\s+/g, '-') || `tariff-${tariff.id}`,
            title: tariff.title,
            price_rub: tariff.price_rub,
            duration_days: tariff.duration_days,
            deposit_rub: tariff.deposit_rub || 0,
            extensions: typeof tariff.extensions === 'string'
                ? safeJsonParse(tariff.extensions, null)
                : tariff.extensions || null,
            description: tariff.description || '',
            short_description: tariff.short_description || ''
        };

        res.status(200).json({ tariff: formattedTariff });
    } catch (error) {
        console.error('[getTariffByBike] Handler error:', error);
        res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера.' });
    }
};

function safeJsonParse(value, fallback) {
    try {
        if (typeof value !== 'string') {
            return fallback;
        }
        return JSON.parse(value);
    } catch (error) {
        console.warn('[getTariffByBike] Failed to parse extensions JSON:', error);
        return fallback;
    }
}
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
