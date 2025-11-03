<<<<<<< HEAD
const { createClient } = require('@supabase/supabase-js');
const htmlToDocx = require('html-to-docx');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
=======
const htmlToDocx = require('html-to-docx');

const { query } = require('./_lib_db');
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { clientId, templateId } = req.body || {};
    if (!clientId || !templateId) {
        return res.status(400).json({ error: 'clientId and templateId are required' });
    }

    try {
        const templateResult = await query(
            'SELECT content FROM contract_templates WHERE id = $1',
            [templateId]
        );
        const template = templateResult.rows[0];
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const clientResult = await query(
            'SELECT * FROM clients WHERE id = $1',
            [clientId]
        );
        const client = clientResult.rows[0];
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const rentalResult = await query(
            `SELECT * FROM rentals
             WHERE user_id = $1 AND status IN ('active', 'overdue', 'pending_return')
             ORDER BY created_at DESC
             LIMIT 1`,
            [clientId]
        );
        const rental = rentalResult.rows[0] || null;

        let tariff = null;
        if (rental?.tariff_id) {
            const tariffResult = await query(
                'SELECT * FROM tariffs WHERE id = $1',
                [rental.tariff_id]
            );
            tariff = tariffResult.rows[0] || null;
        }

        let htmlContent = template.content;
        const [firstName = '', lastName = '', middleName = ''] = (client.name || '').split(' ');

        htmlContent = htmlContent.replace(/\{\{client\.full_name\}\}/g, client.name || '');
        htmlContent = htmlContent.replace(/\{\{client\.first_name\}\}/g, firstName);
        htmlContent = htmlContent.replace(/\{\{client\.last_name\}\}/g, lastName);
        htmlContent = htmlContent.replace(/\{\{client\.middle_name\}\}/g, middleName);
        htmlContent = htmlContent.replace(/\{\{client\.phone\}\}/g, client.phone || '');
        htmlContent = htmlContent.replace(/\{\{client\.city\}\}/g, client.city || '');
        htmlContent = htmlContent.replace(/\{\{client\.address\}\}/g, client.extra?.address || '');

        if (tariff) {
            htmlContent = htmlContent.replace(/\{\{tariff\.title\}\}/g, tariff.title || '');
            htmlContent = htmlContent.replace(/\{\{tariff\.price_rub\}\}/g, tariff.price_rub || '');
            htmlContent = htmlContent.replace(/\{\{tariff\.duration_days\}\}/g, tariff.duration_days || '');
        }

        if (rental) {
            htmlContent = htmlContent.replace(/\{\{rental\.id\}\}/g, rental.id || '');
            htmlContent = htmlContent.replace(/\{\{rental\.starts_at\}\}/g, rental.starts_at || '');
            htmlContent = htmlContent.replace(/\{\{rental\.ends_at\}\}/g, rental.current_period_ends_at || '');
            htmlContent = htmlContent.replace(/\{\{rental\.bike_id\}\}/g, rental.bike_id || '');
        }

        const now = new Date();
        htmlContent = htmlContent.replace(/\{\{now\.date\}\}/g, now.toLocaleDateString('ru-RU'));
        htmlContent = htmlContent.replace(/\{\{now\.time\}\}/g, now.toLocaleTimeString('ru-RU'));

        const fileBuffer = await htmlToDocx(htmlContent, {
            title: `Договор ${client.name}`,
            description: 'Сгенерированный договор аренды',
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=contract_${clientId}.docx`);
        res.send(fileBuffer);
    } catch (error) {
        console.error('[generate-contract] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
