const axios = require('axios');
const { query: dbQuery } = require('./_lib_db');

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
        const body = req.body;
        
        if (body.action === 'rental_status_change') {
            // Обработка уведомления о смене статуса аренды
            const { userId, rentalId, newStatus, rentalData } = body;
            
            if (!userId || !rentalId || !newStatus) {
                return res.status(400).json({ error: 'userId, rentalId, and newStatus are required for rental_status_change.' });
            }
            
            // Отправляем уведомление на VPS WebSocket сервер
            try {
                const vpsResponse = await axios.post('http://51.250.17.150:8081/api/notify', {
                    userId,
                    type: 'rental_status_change',
                    data: {
                        rentalId,
                        status: newStatus,
                        rental: rentalData,
                        timestamp: new Date().toISOString()
                    }
                }, {
                    headers: {
                        'x-internal-secret': process.env.INTERNAL_SECRET,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000 // 5 секунд таймаут
                });
                
                console.log(`Rental status change notification sent to VPS: user=${userId}, rental=${rentalId}, status=${newStatus}`);
            } catch (wsError) {
                console.error('Error sending WebSocket notification to VPS:', wsError.message);
                // Продолжаем выполнение, даже если WebSocket уведомление не отправлено
            }
            
            // Также можно отправить уведомление в Telegram, если нужно
            try {
                const clientResult = await dbQuery('SELECT name FROM clients WHERE id = $1', [userId]);
                if (clientResult.rows.length > 0) {
                    const clientName = clientResult.rows[0].name;
                    // Опционально: отправить уведомление в Telegram
                    // await sendTelegramNotification(userId, `Ваша аренда #${rentalId} сменила статус на: ${newStatus}`);
                }
            } catch (error) {
                console.error('Error getting client name for notification:', error);
            }
            
            res.status(200).json({ success: true, message: 'Rental status change notification processed.', sentToWs: true });
        } 
        else if (body.action === 'balance_update') {
            // Обработка уведомления об изменении баланса
            const { userId, newBalance } = body;
            
            if (!userId || newBalance === undefined) {
                return res.status(400).json({ error: 'userId and newBalance are required for balance_update.' });
            }
            
            // Отправляем уведомление на VPS WebSocket сервер
            try {
                const vpsResponse = await axios.post('http://51.250.17.150:8081/api/notify', {
                    userId,
                    type: 'balance_update',
                    data: {
                        balance: newBalance,
                        timestamp: new Date().toISOString()
                    }
                }, {
                    headers: {
                        'x-internal-secret': process.env.INTERNAL_SECRET,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                });
                
                console.log(`Balance update notification sent to VPS: user=${userId}, balance=${newBalance}`);
            } catch (wsError) {
                console.error('Error sending balance update notification to VPS:', wsError.message);
            }
            
            res.status(200).json({ success: true, message: 'Balance update notification processed.', sentToWs: true });
        }
        else {
            // Старая логика для Telegram уведомлений
            const { user_id, text } = body;

            if (!user_id || !text) {
                return res.status(400).json({ error: 'user_id and text are required for Telegram notifications.' });
            }

            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

            // Отправляем запрос к Telegram API для отправки сообщения
            await axios.post(telegramApiUrl, {
                chat_id: user_id,
                text: text,
                parse_mode: 'Markdown'
            });

            res.status(200).json({ success: true, message: 'Telegram notification sent.' });
        }
    } catch (error) {
        console.error('Notify API error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to send notification.' });
    }
}

// Вспомогательная функция для отправки Telegram уведомлений
async function sendTelegramNotification(userId, text) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

        await axios.post(telegramApiUrl, {
            chat_id: userId,
            text: text,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
    }
}

module.exports = handler;
