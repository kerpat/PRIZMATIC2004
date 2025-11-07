// Вспомогательные функции для SSE уведомлений
// Используются напрямую в других файлах для избежания проблем с импортом

// Маппинг для хранения соединений по userId
const connections = new Map();

// Функция для отправки уведомлений конкретному пользователю
function notifyUserUpdate(userId, updateType, data) {
  console.log(`[SSE] Attempting to notify user ${userId} with type ${updateType}`, data);
  
  let sentCount = 0;
  // Находим все соединения для этого пользователя
  for (const [connectionId, connection] of connections) {
    if (connection.userId === userId) {
      const sendEvent = (data) => {
        try {
          connection.res.write(`data: ${JSON.stringify(data)}\n\n`);
          console.log(`[SSE] Successfully sent ${updateType} to connection ${connectionId}`);
          sentCount++;
        } catch (error) {
          console.error(`[SSE] Error sending to connection ${connectionId}:`, error);
          // Если ошибка при отправке, удаляем соединение
          cleanupConnection(connectionId);
        }
      };

      const payload = {
        type: updateType,
        data: data,
        timestamp: Date.now()
      };

      sendEvent(payload);

      if (updateType === 'balance_update' && data && typeof data.balance !== 'undefined') {
        connection.lastBalance = data.balance;
      }
      if (updateType === 'verification_update' && data && typeof data.status === 'string') {
        connection.lastVerificationStatus = data.status;
      }
    }
  }
  
  if (sentCount === 0) {
    console.log(`[SSE] No active connections found for user ${userId}. Total connections: ${connections.size}`);
  } else {
    console.log(`[SSE] Sent ${updateType} to ${sentCount} connection(s) for user ${userId}`);
  }
}

// Функция очистки соединения
function cleanupConnection(connectionId) {
  const connection = connections.get(connectionId);
  if (connection && connection.intervalId) {
    clearInterval(connection.intervalId);
  }
  connections.delete(connectionId);
}

// Экспортируем функции
module.exports = {
  notifyUserUpdate,
  connections
};
