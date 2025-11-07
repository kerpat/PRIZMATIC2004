// Server-Sent Events для PRIZMATIC
// API endpoint: /api/realtime

const { query } = require('./_lib_db');
const { connections } = require('./_lib_sse_helpers');

module.exports = async function handler(req, res) {
  // Для SSE используем HTTP методы GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Извлекаем userId из query параметров
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Проверяем существование пользователя (пропускаем проверку для админа)
  if (userId !== 'admin') {
    try {
      console.log(`[Realtime] Verifying user with ID: ${userId}`);
      const userQuery = await query('SELECT id FROM clients WHERE id = $1', [userId]);
      console.log(`[Realtime] User query found ${userQuery.rowCount} rows.`);

      if (userQuery.rowCount === 0) {
        console.log(`[Realtime] User not found for ID: ${userId}. Returning 404.`);
        return res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      console.error('Error checking user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    console.log(`[Realtime] Admin connection allowed for ID: ${userId}`);
  }

  // Устанавливаем SSE заголовки
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Создаем уникальный ID для соединения
  const connectionId = `${userId}_${Date.now()}`;
  
  // Сохраняем соединение
  connections.set(connectionId, {
    userId,
    res,
    lastUpdate: Date.now(),
    intervalId: null,
    lastBalance: null,
    lastVerificationStatus: null
  });

  // Отправляем приветствие
  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}

`);
    } catch (error) {
      // Если ошибка при отправке, удаляем соединение
      cleanupConnection(connectionId);
    }
  };

  // Отправляем подтверждающее сообщение
  sendEvent({
    type: 'connected',
    message: 'Connected to PRIZMATIC Realtime Server',
    userId,
    timestamp: Date.now()
  });

  // Запускаем интервал проверки обновлений для этого пользователя
  const connection = connections.get(connectionId);
  connection.intervalId = setInterval(async () => {
    try {
      // Проверяем обновления для конкретного пользователя
      const updates = await checkUserUpdates(connection);
      
      if (updates.length > 0) {
        updates.forEach(update => {
          sendEvent(update);
        });
      }

      // Обновляем время последней активности
      connection.lastUpdate = Date.now();
    } catch (error) {
      console.error('Error checking updates:', error);
      cleanupConnection(connectionId);
    }
  }, 5000); // проверяем каждые 5 секунд

  // Обработка закрытия соединения
  req.on('close', () => {
    cleanupConnection(connectionId);
  });

  req.on('disconnect', () => {
    cleanupConnection(connectionId);
  });
}

// Функция очистки соединения
function cleanupConnection(connectionId) {
  const connection = connections.get(connectionId);
  if (connection && connection.intervalId) {
    clearInterval(connection.intervalId);
  }
  connections.delete(connectionId);
}

// Функция проверки обновлений для пользователя
async function checkUserUpdates(connection) {
  const updates = [];
  const { userId } = connection;

  try {
    // Для админа проверяем новые сообщения поддержки
    if (userId === 'admin') {
      const supportMessagesQuery = await query(`
        SELECT id, client_id, anonymous_chat_id, message_text, sender, created_at
        FROM support_messages
        WHERE created_at > NOW() - INTERVAL '10 seconds'
        ORDER BY created_at DESC
        LIMIT 50
      `);

      for (const row of supportMessagesQuery.rows) {
        updates.push({
          type: 'support_message',
          data: row,
          client_id: row.client_id,
          anonymous_chat_id: row.anonymous_chat_id,
          timestamp: Date.now()
        });
      }

      return updates;
    }

    // Для обычных пользователей - проверяем сообщения поддержки, адресованные им
    const supportMessagesQuery = await query(`
      SELECT id, client_id, anonymous_chat_id, message_text, sender, created_at
      FROM support_messages
      WHERE (client_id = $1 OR anonymous_chat_id = $1)
      AND created_at > NOW() - INTERVAL '10 seconds'
      AND sender = 'admin'
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);

    for (const row of supportMessagesQuery.rows) {
      updates.push({
        type: 'support_message',
        data: row,
        timestamp: Date.now()
      });
    }

    // Проверяем изменения в аренде пользователя
    const rentalQuery = await query(`
      SELECT r.*, 
             jsonb_build_object('title', t.title) as tariffs,
             jsonb_build_object(
               'model_name', b.model_name,
               'frame_number', b.frame_number,
               'battery_numbers', b.battery_numbers,
               'registration_number', b.registration_number,
               'iot_device_id', b.iot_device_id,
               'additional_equipment', b.additional_equipment
             ) as bikes
      FROM rentals r
      LEFT JOIN tariffs t ON r.tariff_id = t.id
      LEFT JOIN bikes b ON r.bike_id = b.id
      WHERE r.user_id = $1 
      AND r.updated_at > NOW() - INTERVAL '10 seconds'
      ORDER BY r.updated_at DESC
      LIMIT 10
    `, [userId]);

    for (const row of rentalQuery.rows) {
      updates.push({
        type: 'rental_update',
        data: row,
        timestamp: Date.now()
      });
    }

    // Проверяем обновления баланса
    const clientQuery = await query(`
      SELECT balance_rub,
             verification_status
      FROM clients 
      WHERE id = $1
    `, [userId]);

    if (clientQuery.rows.length > 0) {
      const { balance_rub: balance, verification_status: verificationStatus } = clientQuery.rows[0];

      if (balance !== undefined && balance !== connection.lastBalance) {
        updates.push({
          type: 'balance_update',
          data: { balance },
          timestamp: Date.now()
        });
        connection.lastBalance = balance;
      }

      if (verificationStatus && verificationStatus !== connection.lastVerificationStatus) {
        updates.push({
          type: 'verification_update',
          data: { status: verificationStatus },
          timestamp: Date.now()
        });
        connection.lastVerificationStatus = verificationStatus;
      }
    }

    return updates;
  } catch (error) {
    console.error('Error checking user updates:', error);
    return updates;
  }
}

// В Vercel API Routes экспорт модуля должен быть один
// Для использования в других файлах создадим отдельную функцию и экспортируем в отдельном файле
// В Vercel API Routes экспорт модуля должен быть один
// Доступ к вспомогательным функциям через отдельный файл
module.exports.connections = connections;
