// Вспомогательные функции для SSE уведомлений
// Используются напрямую в других файлах для избежания проблем с импортом

// Маппинг для хранения соединений по userId
const connections = new Map();

// Функция для отправки уведомлений конкретному пользователю
function notifyUserUpdate(userId, updateType, data) {
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
