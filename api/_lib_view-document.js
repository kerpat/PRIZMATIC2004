const { query } = require('./_lib_db');

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const rentalId = url.searchParams.get('rental');
        const docType = url.searchParams.get('type'); // 'contract' или 'return_act'

        if (!rentalId || !docType) {
            return res.status(400).send('Missing rental ID or document type');
        }

        // Получаем HTML документа из базы
        const result = await query(
            'SELECT extra_data FROM rentals WHERE id = $1',
            [rentalId]
        );

        if (result.rowCount === 0) {
            return res.status(404).send('Rental not found');
        }

        const extraData = result.rows[0].extra_data || {};
        let documentUrl;

        if (docType === 'contract') {
            documentUrl = extraData.contract_document_url;
        } else if (docType === 'return_act') {
            documentUrl = extraData.return_act_url;
        }

        if (!documentUrl) {
            return res.status(404).send('Document not found');
        }

        // Извлекаем HTML из data: URL
        if (documentUrl.startsWith('data:text/html;base64,')) {
            const base64Data = documentUrl.replace('data:text/html;base64,', '');
            const htmlContent = Buffer.from(base64Data, 'base64').toString('utf-8');
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(htmlContent);
        }

        // Если это обычный URL (старый формат)
        return res.redirect(documentUrl);

    } catch (error) {
        console.error('[view-document] Error:', error);
        return res.status(500).send('Internal server error');
    }
}

module.exports = handler;

