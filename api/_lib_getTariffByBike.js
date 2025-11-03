const { query } = require('./_lib_db');

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

module.exports = async function handler(req, res) {
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
