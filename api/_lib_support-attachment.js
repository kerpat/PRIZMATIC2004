const { downloadToBuffer } = require('./_lib_storage_backend');

function parseQuery(req) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return {
        path: url.searchParams.get('path') || url.searchParams.get('object'),
        bucket: url.searchParams.get('bucket'),
    };
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET,OPTIONS');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { path, bucket: bucketParam } = parseQuery(req);

        if (!path) {
            return res.status(400).json({ error: 'Parameter "path" is required.' });
        }

        let bucket = bucketParam || 'support';
        let objectPath = path;

        // Allow passing bucket inside path, e.g. "support/filename.jpg"
        if (!bucketParam && path.includes('/')) {
            const parts = path.split('/');
            bucket = parts.shift() || bucket;
            objectPath = parts.join('/');
        }

        if (!objectPath) {
            return res.status(400).json({ error: 'Invalid path.' });
        }

        const { buffer, mimeType } = await downloadToBuffer(bucket, objectPath);

        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).end(buffer);
    } catch (error) {
        console.error('[support-attachment] Failed to deliver file:', error);
        const status = error.code === 'ENOENT' || error.message === 'File not found'
            ? 404
            : 500;
        res.status(status).json({ error: status === 404 ? 'File not found.' : 'Failed to download file.' });
    }
}

module.exports = handler;
module.exports.default = handler;
