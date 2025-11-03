const { createClient } = require('@supabase/supabase-js');
const htmlToDocx = require('html-to-docx');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { clientId, templateId } = req.body;

    if (!clientId || !templateId) {
        return res.status(400).json({ error: 'clientId and templateId are required' });
    }

    try {
        // 1. Достаем HTML-шаблон
        const { data: template, error: templateError } = await supabase
            .from('contract_templates')
            .select('content')
            .eq('id', templateId)
            .single();

        if (templateError || !template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // 2. Достаем данные клиента
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();

        if (clientError || !client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // 3. Достаем данные аренды (предполагаем, что есть активная аренда)
        const { data: rental, error: rentalError } = await supabase
            .from('rentals')
            .select('*')
            .eq('client_id', clientId)
            .eq('status', 'active')
            .single();

        // 4. Достаем данные тарифа
        let tariff = null;
        if (rental) {
            const { data: tariffData, error: tariffError } = await supabase
                .from('tariffs')
                .select('*')
                .eq('id', rental.tariff_id)
                .single();
            if (!tariffError) tariff = tariffData;
        }

        // 5. Заменяем плейсхолдеры в HTML
        let htmlContent = template.content;

        // Клиент
        htmlContent = htmlContent.replace(/\{\{client\.full_name\}\}/g, client.name || '');
        htmlContent = htmlContent.replace(/\{\{client\.first_name\}\}/g, client.name?.split(' ')[0] || '');
        htmlContent = htmlContent.replace(/\{\{client\.last_name\}\}/g, client.name?.split(' ')[1] || '');
        htmlContent = htmlContent.replace(/\{\{client\.middle_name\}\}/g, client.name?.split(' ')[2] || '');
        htmlContent = htmlContent.replace(/\{\{client\.phone\}\}/g, client.phone || '');
        htmlContent = htmlContent.replace(/\{\{client\.city\}\}/g, client.city || '');
        htmlContent = htmlContent.replace(/\{\{client\.address\}\}/g, client.extra?.address || '');

        // Тариф
        if (tariff) {
            htmlContent = htmlContent.replace(/\{\{tariff\.title\}\}/g, tariff.title || '');
            htmlContent = htmlContent.replace(/\{\{tariff\.price_rub\}\}/g, tariff.price_rub || '');
            htmlContent = htmlContent.replace(/\{\{tariff\.duration_days\}\}/g, tariff.duration_days || '');
        }

        // Аренда
        if (rental) {
            htmlContent = htmlContent.replace(/\{\{rental\.id\}\}/g, rental.id || '');
            htmlContent = htmlContent.replace(/\{\{rental\.starts_at\}\}/g, rental.starts_at || '');
            htmlContent = htmlContent.replace(/\{\{rental\.ends_at\}\}/g, rental.ends_at || '');
            htmlContent = htmlContent.replace(/\{\{rental\.bike_id\}\}/g, rental.bike_id || '');
        }

        // Служебные
        htmlContent = htmlContent.replace(/\{\{now\.date\}\}/g, new Date().toLocaleDateString('ru-RU'));
        htmlContent = htmlContent.replace(/\{\{now\.time\}\}/g, new Date().toLocaleTimeString('ru-RU'));

        // 6. Генерируем DOCX
        const fileBuffer = await htmlToDocx(htmlContent, {
            title: `Договор ${client.name}`,
            description: 'Сгенерированный договор аренды',
        });

        // 7. Отдаем файл
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=contract_${clientId}.docx`);
        res.send(fileBuffer);

    } catch (error) {
        console.error('Generate contract error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};