const axios = require('axios');

async function handler(req, res) {
    // Проверяем секретный ключ, чтобы только ваша админка могла вызывать этот API
    const internalSecret = req.headers['x-internal-secret'];
    if (internalSecret !== process.env.INTERNAL_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { user_id, text } = req.body;

        if (!user_id || !text) {
            return res.status(400).json({ error: 'user_id and text are required.' });
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

        // Отправляем запрос к Telegram API для отправки сообщения
        await axios.post(telegramApiUrl, {
            chat_id: user_id,
            text: text,
            parse_mode: 'Markdown'
        });

        res.status(200).json({ success: true, message: 'Notification sent.' });

    } catch (error) {
        console.error('Notify API error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to send notification.' });
    }
}

module.exports = handler;
