// Server-Sent Events для PRIZMATIC
// API endpoint: /api/realtime

const { query } = require('./_lib_db');
const { connections, notifyUserUpdate: internalNotifyUserUpdate } = require('./_lib_sse_helpers');

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

  // Проверяем существование пользователя
  try {
    const userQuery = await query('SELECT id FROM clients WHERE id = $1', [userId]);
    if (userQuery.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error checking user:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
    intervalId: null
  });

  // Отправляем приветствие
  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
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
      const updates = await checkUserUpdates(userId);
      
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
async function checkUserUpdates(userId) {
  const updates = [];

  try {
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
    const balanceQuery = await query(`
      SELECT balance_rub 
      FROM clients 
      WHERE id = $1
    `, [userId]);

    if (balanceQuery.rows.length > 0) {
      updates.push({
        type: 'balance_update',
        data: { balance: balanceQuery.rows[0].balance_rub },
        timestamp: Date.now()
      });
    }

    return updates;
  } catch (error) {
    console.error('Error checking user updates:', error);
    return updates;
  }
}

// Функция для отправки уведомлений конкретному пользователю
// Эта функция может быть вызвана из других API при обновлениях
export function notifyUserUpdate(userId, updateType, data) {
  // Находим все соединения для этого пользователя
  for (const [connectionId, connection] of connections) {
    if (connection.userId === userId) {
      const sendEvent = (data) => {
        try {
          connection.res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          // Если ошибка при отправке, удаляем соединение
          cleanupConnection(connectionId);
        }
      };

      sendEvent({
        type: updateType,
        data: data,
        timestamp: Date.now()
      });
    }
  }
}

// В Vercel API Routes экспорт модуля должен быть один
// Для использования в других файлах создадим отдельную функцию и экспортируем в отдельном файле
// В Vercel API Routes экспорт модуля должен быть один
// Доступ к вспомогательным функциям через отдельный файл
module.exports.connections = connections;