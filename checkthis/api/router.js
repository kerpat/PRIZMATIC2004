/**
 * 🚀 MEGA ROUTER - Единая точка входа для ВСЕХ API endpoints
 * Решает проблему лимита Vercel Hobby (12 функций)
 *
 * Все запросы идут через /api/router?endpoint=XXX
 * Например: /api/router?endpoint=auth
 */

// Импортируем обработчики из api/_lib_*.js
// Префикс "_lib_" нужен чтобы Vercel не деплоил их как отдельные функции
// Vercel игнорирует файлы начинающиеся с _ (underscore)
const authHandler = require('./_lib_auth');
const userHandler = require('./_lib_user');
const adminHandler = require('./_lib_admin');
const paymentsHandler = require('./_lib_payments');
const webhookHandler = require('./_lib_payment-webhook');
const getTariffHandler = require('./_lib_getTariffByBike');
const geminiOCR = require('./_lib_gemini-ocr');
const storageHandler = require('./_lib_storage');
const notifyHandler = require('./_lib_notify');
const dataHandler = require('./_lib_data');
const callVerifyHandler = require('./_lib_call_verify');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Определяем endpoint из query параметра или URL
    let endpoint;

    // Проверяем query параметр ?endpoint=XXX
    const url = new URL(req.url, `http://${req.headers.host}`);
    endpoint = url.searchParams.get('endpoint');

    // Если нет query параметра, берём из пути: /api/router/auth -> auth
    if (!endpoint) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        // pathParts = ['api', 'router', 'auth'] -> берём последнее
        endpoint = pathParts[pathParts.length - 1];

        // Если endpoint === 'router', значит путь был /api/router без дополнительного сегмента
        if (endpoint === 'router') {
            endpoint = null;
        }
    }

    console.log(`[Router] ${req.method} endpoint="${endpoint}" url="${req.url}"`);

    try {
        switch (endpoint) {
            case 'config':
                console.log('[Config] ENV check:', {
                    hasDbUrl: !!process.env.DATABASE_URL,
                    hasDbHost: !!process.env.DB_HOST,
                    hasStorageUrl: !!process.env.STORAGE_URL
                });

                // Fallback значения для локальной разработки (VPS mode)
                const config = {
                    DATABASE_URL: process.env.DATABASE_URL,
                    DB_HOST: process.env.DB_HOST || '51.250.17.150',
                    DB_PORT: process.env.DB_PORT || '5432',
                    DB_NAME: process.env.DB_NAME || 'prizmatic',
                    STORAGE_URL: process.env.STORAGE_URL || 'http://51.250.17.150:9000',
                    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || '51.250.17.150',
                    CONTRACTS_API_URL: process.env.CONTRACTS_API_URL || 'https://gogovorprizmatic.onrender.com',
                    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
                    GEMINI_API_KEY: process.env.GEMINI_API_KEY
                };

                console.log('[Config] Returning config with DB_HOST:', config.DB_HOST);

                res.setHeader('Content-Type', 'application/javascript');
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                return res.status(200).send(`window.CONFIG = ${JSON.stringify(config, null, 2)};`);

            case 'auth':
                return authHandler(req, res);

            case 'user':
                return userHandler(req, res);

            case 'admin':
                return adminHandler(req, res);

            case 'payments':
                return paymentsHandler(req, res);

            case 'payment-webhook':
                return webhookHandler(req, res);

            case 'getTariffByBike':
                return getTariffHandler(req, res);

            case 'gemini-ocr':
                return geminiOCR(req, res);

            case 'storage':
                return storageHandler(req, res);

            case 'notify':
                return notifyHandler(req, res);

            case 'data':
                return dataHandler(req, res);

            case 'call-verify':
                return callVerifyHandler(req, res);

            default:
                return res.status(404).json({
                    error: `Unknown endpoint: ${endpoint}`,
                    hint: 'Use ?endpoint=XXX or /api/router/XXX'
                });
        }
    } catch (error) {
        console.error(`[Router] Error in ${endpoint}:`, error);
        return res.status(500).json({
            error: error.message,
            endpoint
        });
    }
};
