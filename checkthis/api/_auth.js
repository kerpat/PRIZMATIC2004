// Обёртка для auth endpoint
// Vercel требует файл в /api, но логика в /lib
module.exports = require('../lib/auth');
