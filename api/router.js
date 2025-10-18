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
                    hasUrl: !!process.env.SUPABASE_URL,
                    hasKey: !!process.env.SUPABASE_ANON_KEY,
                    hasContractsUrl: !!process.env.CONTRACTS_API_URL
                });

                res.setHeader('Content-Type', 'application/javascript');
                return res.status(200).send(`
                    window.CONFIG = {
                        SUPABASE_URL: "${process.env.SUPABASE_URL || ''}",
                        SUPABASE_ANON_KEY: "${process.env.SUPABASE_ANON_KEY || ''}",
                        CONTRACTS_API_URL: "${process.env.CONTRACTS_API_URL || process.env.VERCEL_URL || ''}"
                    };
                `);

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
