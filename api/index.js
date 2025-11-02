/**
 * 🚀 UNIFIED API ROUTER
 * Объединяет все API endpoints в одну serverless функцию
 * Решает проблему лимита Vercel (12 функций на Hobby плане)
 */

const { getSupabaseServiceRoleClient, getSupabaseConfig } = require('../supabase');
const crypto = require('crypto');

// Инициализация Supabase
let cachedSupabaseAdmin = null;
const supabaseConfig = getSupabaseConfig();

function ensureSupabaseAdmin() {
    if (!cachedSupabaseAdmin) {
        cachedSupabaseAdmin = getSupabaseServiceRoleClient();
    }
    return cachedSupabaseAdmin;
}

// Импортируем обработчики из отдельных модулей
const handleAuth = require('./handlers/auth');
const handlePayments = require('./handlers/payments');
const handleUser = require('./handlers/user');
const handleAdmin = require('./handlers/admin');
const handleData = require('./handlers/data');
const handleWebhook = require('./handlers/webhook');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Определяем endpoint из URL
    const path = req.url.split('?')[0];
    const endpoint = path.replace('/api/', '');

    console.log(`[API Router] ${req.method} ${endpoint}`);

    try {
        // Роутинг по endpoint'ам
        switch (endpoint) {
            // ===== CONFIG =====
            case 'config':
                return res.status(200).send(`
                    window.CONFIG = {
                        SUPABASE_URL: "${supabaseConfig.url}",
                        SUPABASE_ANON_KEY: "${supabaseConfig.anonKey}",
                        CONTRACTS_API_URL: "${process.env.CONTRACTS_API_URL || process.env.VERCEL_URL || 'http://localhost:3000'}"
                    };
                `);

            // ===== AUTH =====
            case 'auth':
                return handleAuth(req, res, ensureSupabaseAdmin());

            // ===== PAYMENTS =====
            case 'payments':
                return handlePayments(req, res, ensureSupabaseAdmin());

            // ===== PAYMENT WEBHOOK =====
            case 'payment-webhook':
                return handleWebhook(req, res, ensureSupabaseAdmin());

            // ===== USER =====
            case 'user':
                return handleUser(req, res, ensureSupabaseAdmin());

            // ===== ADMIN =====
            case 'admin':
                return handleAdmin(req, res, ensureSupabaseAdmin());

            // ===== DATA (оптимизированный прокси) =====
            case 'data':
                return handleData(req, res, ensureSupabaseAdmin());

            // ===== GET TARIFF BY BIKE =====
            case 'getTariffByBike':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { bikeCode } = req.body;
                if (!bikeCode) {
                    return res.status(400).json({ error: 'bikeCode is required' });
                }

                const supabaseClient = ensureSupabaseAdmin();
                const { data: bike, error: bikeError } = await supabaseClient
                    .from('bikes')
                    .select('*, tariffs(*)')
                    .eq('code', bikeCode)
                    .eq('status', 'available')
                    .single();

                if (bikeError || !bike) {
                    return res.status(404).json({ error: 'Велосипед не найден или недоступен' });
                }

                const tariff = bike.tariffs;
                if (!tariff) {
                    return res.status(404).json({ error: 'Тариф не найден для этого велосипеда' });
                }

                let extensions = null;
                if (tariff.extensions) {
                    try {
                        extensions = typeof tariff.extensions === 'string'
                            ? JSON.parse(tariff.extensions)
                            : tariff.extensions;
                    } catch (e) {
                        console.error('Failed to parse extensions:', e);
                    }
                }

                return res.status(200).json({
                    tariff: {
                        id: tariff.id,
                        slug: tariff.slug,
                        title: tariff.title,
                        price_rub: tariff.price_rub,
                        duration_days: tariff.duration_days,
                        deposit_rub: tariff.deposit_rub || 0,
                        extensions: extensions,
                        short_description: tariff.short_description || '',
                        description: tariff.description || ''
                    },
                    bike: {
                        code: bike.code,
                        model_name: bike.model_name
                    }
                });

            // ===== GEMINI OCR =====
            case 'gemini-ocr':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
                if (!GEMINI_API_KEY) {
                    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
                }

                const { imageBase64 } = req.body;
                if (!imageBase64) {
                    return res.status(400).json({ error: 'imageBase64 is required' });
                }

                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    {
                                        text: `Извлеки следующие данные из российского паспорта:
                                        - series (серия)
                                        - number (номер)
                                        - issuing_authority (кем выдан)
                                        - issue_date (дата выдачи в формате DD.MM.YYYY)
                                        - birth_date (дата рождения в формате DD.MM.YYYY)
                                        - registration_address (адрес регистрации)

                                        Верни ТОЛЬКО валидный JSON без комментариев.`
                                    },
                                    {
                                        inline_data: {
                                            mime_type: 'image/jpeg',
                                            data: imageBase64
                                        }
                                    }
                                ]
                            }]
                        })
                    }
                );

                const geminiData = await geminiResponse.json();
                if (!geminiResponse.ok) {
                    throw new Error(geminiData.error?.message || 'Gemini API error');
                }

                const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textResponse) {
                    throw new Error('No response from Gemini');
                }

                const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
                const parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textResponse);

                return res.status(200).json(parsedData);

            // ===== STORAGE (File Upload) =====
            case 'storage':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { bucket, path: filePath, fileData } = req.body;
                if (!bucket || !filePath || !fileData) {
                    return res.status(400).json({ error: 'bucket, path, and fileData are required' });
                }

                const buffer = Buffer.from(fileData, 'base64');
                const supabaseClient = ensureSupabaseAdmin();
                const { error: uploadError } = await supabaseClient.storage
                    .from(bucket)
                    .upload(filePath, buffer, { contentType: 'application/octet-stream' });

                if (uploadError) {
                    return res.status(500).json({ error: uploadError.message });
                }

                const { data: urlData } = supabaseClient.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                return res.status(200).json({ url: urlData.publicUrl });

            // ===== NOTIFY (Telegram notifications) =====
            case 'notify':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { chatId, message, deeplink } = req.body;
                if (!chatId || !message) {
                    return res.status(400).json({ error: 'chatId and message are required' });
                }

                const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
                if (!BOT_TOKEN) {
                    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
                }

                const keyboard = deeplink ? {
                    inline_keyboard: [[{
                        text: 'Открыть приложение',
                        url: `https://t.me/pr1zmaticbot/prizmatic?startapp=${deeplink}`
                    }]]
                } : undefined;

                const telegramResponse = await fetch(
                    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: message,
                            parse_mode: 'HTML',
                            reply_markup: keyboard
                        })
                    }
                );

                const telegramData = await telegramResponse.json();
                if (!telegramData.ok) {
                    return res.status(500).json({ error: telegramData.description });
                }

                return res.status(200).json({ success: true });

            // ===== GENERATE CONTRACT =====
            case 'generate-contract':
                // Заглушка - добавь логику позже
                return res.status(501).json({ error: 'Not implemented yet' });

            // ===== UPLOAD SUPPORT ATTACHMENT =====
            case 'upload-support-attachment':
                // Заглушка - добавь логику позже
                return res.status(501).json({ error: 'Not implemented yet' });

            default:
                return res.status(404).json({ error: `Unknown endpoint: ${endpoint}` });
        }

    } catch (error) {
        console.error(`[API Router] Error in ${endpoint}:`, error);
        return res.status(500).json({
            error: error.message,
            endpoint
        });
    }
};
