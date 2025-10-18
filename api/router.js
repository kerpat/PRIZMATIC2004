/**
 * 🚀 MEGA ROUTER - Единая точка входа для ВСЕХ API endpoints
 * Решает проблему лимита Vercel Hobby (12 функций)
 *
 * Все запросы идут через /api/router?endpoint=XXX
 * Например: /api/router?endpoint=auth
 */

// Импортируем ВСЕ обработчики из lib/ (не из api/)
// Это важно! Vercel игнорирует файлы не в /api, поэтому они не считаются функциями
const authHandler = require('../lib/auth');
const userHandler = require('../lib/user');
const adminHandler = require('../lib/admin');
const paymentsHandler = require('../lib/payments');
const webhookHandler = require('../lib/payment-webhook');
const getTariffHandler = require('../lib/getTariffByBike');
const geminiOCR = require('../lib/gemini-ocr');
const storageHandler = require('../lib/storage');
const notifyHandler = require('../lib/notify');
const dataHandler = require('../lib/data');

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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = url.searchParams.get('endpoint') || url.pathname.split('/').pop();

    console.log(`[Router] ${req.method} /${endpoint}`);

    try {
        switch (endpoint) {
            case 'config':
                return res.status(200).send(`
                    window.CONFIG = {
                        SUPABASE_URL: "${process.env.SUPABASE_URL}",
                        SUPABASE_ANON_KEY: "${process.env.SUPABASE_ANON_KEY}",
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
