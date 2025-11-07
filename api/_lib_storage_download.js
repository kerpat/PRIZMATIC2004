const { downloadToBuffer } = require('./_lib_storage_backend');

/**
 * Storage Download Handler
 * Обслуживает публичные URL для файлов из MinIO/Filesystem
 */

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (error) {
            return {};
        }
    }
    return body;
}

async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Получаем параметры из query string
        const url = new URL(req.url, `http://${req.headers.host}`);
        const bucket = url.searchParams.get('bucket') || 'passports';
        const path = url.searchParams.get('path');

        if (!path) {
            return res.status(400).json({ error: 'Missing required parameter: path' });
        }

        console.log(`[storage-download] Downloading: bucket=${bucket}, path=${path}`);

        // Скачиваем файл
        const { buffer, mimeType } = await downloadToBuffer(bucket, path);

        // Отправляем файл
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Кэшируем на год
        return res.status(200).send(buffer);

    } catch (error) {
        console.error('[storage-download] Error:', error);
        
        // Проверяем типичные ошибки
        if (error.code === 'ENOENT' || error.message?.includes('not found')) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}

module.exports = handler;
module.exports.default = handler;
