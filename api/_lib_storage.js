<<<<<<< HEAD
const { createClient } = require('@supabase/supabase-js');

function createSupabaseAdmin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service credentials are not configured.');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
=======
const path = require('path');
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (error) {
            console.error('[storage] Failed to parse body:', error);
            return {};
        }
    }
    return body;
}

function buildDirectUploadInstruction(filePath, bucket) {
    const targetBucket = bucket || 'passports';
    const normalizedPath = filePath.replace(/^\/+/, '');
    const filename = path.basename(normalizedPath);

    return {
        uploadUrl: '/api/storage-upload',
        method: 'POST',
        formFields: {
            bucket: targetBucket,
            path: normalizedPath,
        },
        filename,
        note: 'Используйте POST multipart/form-data на /api/storage-upload с полями bucket и userId.'
    };
}

async function handleGetUploadInstruction({ path, bucket }) {
    if (!path) {
        return { status: 400, body: { error: 'File path is required.' } };
    }
<<<<<<< HEAD
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
        .from('passports')
        .createSignedUploadUrl(path);
=======
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

    const instruction = buildDirectUploadInstruction(path, bucket);
    return { status: 200, body: instruction };
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
            case 'get-upload-instruction':
                result = await handleGetUploadInstruction(body);
                break;
            default:
                result = { status: 400, body: { error: 'Invalid action' } };
        }

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('[storage] Handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
