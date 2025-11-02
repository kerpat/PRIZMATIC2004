const { createClient } = require('@supabase/supabase-js');

function createSupabaseAdmin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service credentials are not configured.');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try { return JSON.parse(body); } catch (err) { return {}; }
    }
    return body;
}

async function handleGetSignedUploadUrl({ path }) {
    if (!path) {
        return { status: 400, body: { error: 'File path is required.' } };
    }
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
        .from('passports')
        .createSignedUploadUrl(path);

    if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
    }
    return { status: 200, body: data };
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = parseRequestBody(req.body);
        const { action } = body;

        let result;
        switch (action) {
            case 'get-signed-upload-url':
                result = await handleGetSignedUploadUrl(body);
                break;
            default:
                result = { status: 400, body: { error: 'Invalid action' } };
        }

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Storage handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;