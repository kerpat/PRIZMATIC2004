// Функции для отправки уведомлений через SSE
// Используем CommonJS для Vercel совместимости
const { notifyUserUpdate } = require('./_lib_sse_helpers');

// Экспортируем функции для использования в других модулях
module.exports = { notifyUserUpdate };