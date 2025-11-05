// Функции для отправки SSE уведомлений
// Используется для импорта в других Vercel функциях

const realtimeModule = require('./realtime');

// Экспортируем функции
module.exports = {
  notifyUserUpdate: realtimeModule.notifyUserUpdate,
  connections: realtimeModule.connections
};