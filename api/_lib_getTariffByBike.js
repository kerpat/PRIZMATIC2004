const { getSupabaseServiceRoleClient } = require('../supabase');

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
        const { bikeCode } = body;

        if (!bikeCode) {
            res.status(400).json({ error: 'bikeCode is required.' });
            return;
        }

        const supabaseAdmin = getSupabaseServiceRoleClient();
        const { data: bike, error } = await supabaseAdmin
            .from('bikes')
            .select('*, tariffs(*)')
            .eq('code', bikeCode)
            .eq('status', 'available')
            .single();

        if (error || !bike) {
            res.status(404).json({ error: 'Bike not found or unavailable.' });
            return;
        }

        const tariff = bike.tariffs;
        if (!tariff) {
            res.status(404).json({ error: 'Tariff not found for this bike.' });
            return;
        }

        let extensions = null;
        if (tariff.extensions) {
            try {
                extensions = typeof tariff.extensions === 'string'
                    ? JSON.parse(tariff.extensions)
                    : tariff.extensions;
            } catch (err) {
                console.error('Failed to parse extensions:', err);
            }
        }

        res.status(200).json({
            tariff: {
                id: tariff.id,
                slug: tariff.slug,
                title: tariff.title,
                price_rub: tariff.price_rub,
                duration_days: tariff.duration_days,
                deposit_rub: tariff.deposit_rub || 0,
                extensions,
                short_description: tariff.short_description || '',
                description: tariff.description || ''
            },
            bike: {
                code: bike.code,
                model_name: bike.model_name
            }
        });
    } catch (err) {
        console.error('getTariffByBike handler error:', err);
        res.status(500).json({ error: err.message || 'Unexpected error' });
    }
}

module.exports = handler;
module.exports.default = handler;
