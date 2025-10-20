const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const axios = require('axios');
// +++ ДОБАВЛЯЕМ НОВЫЙ ИМПОРТ +++
const { GoogleGenerativeAI } = require('@google/generative-ai');

function createSupabaseAdmin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service credentials are not configured.');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function validateTelegramData(initData, botToken) {
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();

        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        return hmac === hash;
    } catch (error) {
        console.error('Telegram data validation error:', error);
        return false;
    }
}

async function triggerOCRProcessing(userId, fileIds) {
    try {
        const ocrWorkerUrl = process.env.OCR_WORKER_URL;
        const internalSecret = process.env.INTERNAL_SECRET;

        if (!ocrWorkerUrl || !internalSecret) {
            console.warn('OCR Worker not configured, skipping OCR processing');
            return;
        }

        axios.post(`${ocrWorkerUrl}/process-document`, {
            userId,
            fileIds
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': internalSecret
            },
            timeout: 5000
        }).catch(error => {
            console.error('Failed to trigger OCR processing:', error.message);
        });

        console.log(`OCR processing triggered for user ${userId}`);
    } catch (error) {
        console.error('Error triggering OCR processing:', error);
    }
}

// +++ НОВАЯ ФУНКЦИЯ ДЛЯ РАСПОЗНАВАНИЯ +++
async function recognizeDocumentsWithGemini(supabaseAdmin, filePaths, countryCode) {
    if (!process.env.GOOGLE_API_KEY) {
        throw new Error('GOOGLE_API_KEY is not configured on the server.');
    }
    // Инициализируем Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Скачиваем все файлы из Supabase
    const imageParts = [];
    for (const path of filePaths) {
        const { data, error } = await supabaseAdmin.storage.from('passports').download(path);
        if (error) {
            console.error(`Failed to download ${path} from Supabase:`, error);
            continue; // Пропускаем битый файл
        }
        // Конвертируем файл в base64 для Gemini
        const buffer = await data.arrayBuffer();
        imageParts.push({
            inlineData: {
                data: Buffer.from(buffer).toString("base64"),
                mimeType: 'image/jpeg'
            }
        });
    }

    if (imageParts.length === 0) {
        console.log("No images found to process.");
        return {};
    }

    // Создаем промпт (такой же, как в Python)
    const prompt = `
        Analyze these document images from a user with '${countryCode}' citizenship.
        Extract the following data into a single, minified JSON object with no comments or markdown:
        {
          "full_name": "...",
          "last_name": "...",
          "first_name": "...",
          "middle_name": "...",
          "birth_date": "DD.MM.YYYY",
          "birth_place": "...",
          "gender": "male/female",
          "series": "...",
          "number": "...",
          "issue_date": "DD.MM.YYYY",
          "expiry_date": "DD.MM.YYYY",
          "issuing_authority": "...",
          "registration_address": "..."
        }
        Only include fields you can find. For middle_name, if it's part of the full name, extract it.
    `;

    // Отправляем запрос в Gemini
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Чистим и парсим JSON
    try {
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", text);
        return { error: "Failed to parse recognition result." };
    }
}

/**
 * Complete VK registration with phone and city
 */
async function handleVKCompleteRegistration(req, res) {
    const { vkData, phone, city } = req.body;

    if (!vkData || !vkData.user_id || !city) {
        return res.status(400).json({ error: 'Missing required registration data (vk_user_id and city required)' });
    }

    try {
        const supabaseAdmin = createSupabaseAdmin();

        // Check if user already exists
        const { data: existingClient } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('vk_user_id', vkData.user_id)
            .single();

        if (existingClient) {
            // User already registered, just return user data
            return res.status(200).json({
                success: true,
                user: {
                    id: existingClient.id,
                    name: existingClient.name,
                    phone: existingClient.phone,
                    city: existingClient.city,
                    balance_rub: existingClient.balance_rub,
                    verification_status: existingClient.verification_status
                }
            });
        }

        // Create new user (phone is optional for now)
        const newClientData = {
            vk_user_id: vkData.user_id,
            name: `${vkData.first_name} ${vkData.last_name}`,
            phone: phone || null,  // Optional until VK Phone API access
            city: city,
            verification_status: 'pending',
            balance_rub: 0,
            extra: {
                vk_photo: vkData.photo_url,
                auth_provider: 'vk',
                registered_at: new Date().toISOString(),
                phone_required: !phone  // Flag to ask for phone later
            }
        };

        const { data: newClient, error: insertError } = await supabaseAdmin
            .from('clients')
            .insert([newClientData])
            .select()
            .single();

        if (insertError) {
            console.error('[VK Complete Reg] Insert error:', insertError);

            if (insertError.code === '23505') {
                // Duplicate phone or vk_user_id
                return res.status(409).json({ error: 'User already registered' });
            }

            throw new Error('Failed to create user account');
        }

        console.log('[VK Complete Reg] New user created:', newClient.id);

        return res.status(200).json({
            success: true,
            user: {
                id: newClient.id,
                name: newClient.name,
                phone: newClient.phone,
                city: newClient.city,
                balance_rub: newClient.balance_rub,
                verification_status: newClient.verification_status
            }
        });

    } catch (error) {
        console.error('[VK Complete Reg] Error:', error);
        return res.status(500).json({
            error: 'Registration failed',
            details: error.message
        });
    }
}

/**
 * Handle VK ID authentication
 */
async function handleVKLogin(req, res) {
    const { authData } = req.body;

    if (!authData || !authData.user_id) {
        return res.status(400).json({ error: 'Missing VK authentication data' });
    }

    try {
        const supabaseAdmin = createSupabaseAdmin();

        // Use VK Service Token from environment (not user token)
        const VK_SERVICE_TOKEN = process.env.VK_SERVICE_TOKEN || process.env.VK_ACCESS_TOKEN;

        let vkUser;

        if (VK_SERVICE_TOKEN) {
            // Use service token to get user info (IP restriction safe)
            console.log('[VK Auth] Using VK Service Token');
            const vkApiUrl = `https://api.vk.com/method/users.get?user_ids=${authData.user_id}&fields=photo_200,city,screen_name&access_token=${VK_SERVICE_TOKEN}&v=5.131`;

            const vkResponse = await axios.get(vkApiUrl);

            if (vkResponse.data.error) {
                console.error('[VK Auth] VK API Error:', vkResponse.data.error);
                throw new Error(`VK API Error: ${vkResponse.data.error.error_msg}`);
            }

            vkUser = vkResponse.data.response[0];
        } else {
            // Fallback: Trust client-provided data (less secure but works)
            console.warn('[VK Auth] No VK_SERVICE_TOKEN, trusting client data');
            vkUser = {
                id: authData.user_id,
                first_name: authData.first_name || 'VK',
                last_name: authData.last_name || 'User',
                photo_200: authData.photo_url || ''
            };
        }

        if (!vkUser) {
            throw new Error('Failed to fetch VK user data');
        }

        console.log('[VK Auth] VK user data received:', vkUser.id);

        // Check if user exists in database
        const { data: existingClient, error: selectError } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('vk_user_id', authData.user_id)
            .single();

        let client;

        if (selectError && selectError.code === 'PGRST116') {
            // User doesn't exist - create new account
            console.log('[VK Auth] Creating new user...');

            const newClientData = {
                vk_user_id: authData.user_id,
                name: `${vkUser.first_name} ${vkUser.last_name}`,
                verification_status: 'pending',
                balance_rub: 0,
                extra: {
                    vk_photo: vkUser.photo_200,
                    vk_city: vkUser.city?.title || '',
                    auth_provider: 'vk'
                }
            };

            const { data: newClient, error: insertError } = await supabaseAdmin
                .from('clients')
                .insert([newClientData])
                .select()
                .single();

            if (insertError) {
                console.error('[VK Auth] Insert error:', insertError);
                throw new Error('Failed to create user account');
            }

            client = newClient;
            console.log('[VK Auth] New user created:', client.id);

        } else if (selectError) {
            // Other database error
            throw selectError;
        } else {
            // User exists - update last login
            client = existingClient;
            console.log('[VK Auth] Existing user found:', client.id);

            // Update user data
            await supabaseAdmin
                .from('clients')
                .update({
                    name: `${vkUser.first_name} ${vkUser.last_name}`,
                    extra: {
                        ...client.extra,
                        vk_photo: vkUser.photo_200,
                        vk_city: vkUser.city?.title || '',
                        last_vk_login: new Date().toISOString()
                    }
                })
                .eq('id', client.id);
        }

        // Return user data
        return res.status(200).json({
            success: true,
            isNewUser: !existingClient,
            user: {
                id: client.id,
                name: client.name,
                phone: client.phone,
                city: client.city,
                balance_rub: client.balance_rub,
                verification_status: client.verification_status
            }
        });

    } catch (error) {
        console.error('[VK Auth] Error:', error);
        return res.status(500).json({
            error: 'VK authentication failed',
            details: error.message
        });
    }
}

async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST, OPTIONS');
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action } = body;

        // Handle VK ID complete registration
        if (action === 'vk-complete-registration') {
            return await handleVKCompleteRegistration(req, res);
        }

        // Handle VK ID login
        if (action === 'vk-login') {
            return await handleVKLogin(req, res);
        }

        // Telegram auth requires bot token
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is not configured');
        }

        if (action === 'login') {
            const { initData } = body;
            if (!validateTelegramData(initData, botToken)) {
                return res.status(401).json({ error: 'Invalid Telegram data' });
            }
            const urlParams = new URLSearchParams(initData);
            const userData = JSON.parse(decodeURIComponent(urlParams.get('user')));
            const telegramUserId = userData.id;
            const supabaseAdmin = createSupabaseAdmin();
            const { data: client, error } = await supabaseAdmin
                .from('clients')
                .select('*')
                .eq('extra->telegram_user_id', telegramUserId)
                .single();
            if (error || !client) {
                return res.status(404).json({ error: 'User not found. Please register first.' });
            }
            return res.status(200).json({
                success: true,
                user: {
                    id: client.id,
                    name: client.name,
                    phone: client.phone,
                    city: client.city,
                    balance_rub: client.balance_rub,
                    verification_status: client.extra?.verification_status
                }
            });
        } else if (action === 'bot-register') {
            const { userId: telegram_user_id, formData } = req.body;
            // Убираем recognized_data, так как мы его получим сами
            const { name, phone, video_note_storage_path, ...otherData } = formData;

            if (!name || !phone || !video_note_storage_path || !telegram_user_id) {
                return res.status(400).json({ error: 'Missing required registration data from bot.' });
            }

            const supabaseAdmin = createSupabaseAdmin();

            // +++ ЛОГИКА РАСПОЗНАВАНИЯ +++
            // 1. Собираем пути к файлам-картинкам
            const imagePathsToRecognize = Object.keys(otherData)
                .filter(key => key.endsWith('_storage_path') && key !== 'video_note_storage_path')
                .map(key => otherData[key]);

            // 2. Вызываем нашу новую функцию
            let recognized_data = {};
            if (imagePathsToRecognize.length > 0) {
                try {
                    console.log(`Starting OCR for user ${telegram_user_id} with files:`, imagePathsToRecognize);
                    recognized_data = await recognizeDocumentsWithGemini(
                        supabaseAdmin,
                        imagePathsToRecognize,
                        otherData.citizenship || 'ru'
                    );
                    console.log(`OCR result for user ${telegram_user_id}:`, recognized_data);
                } catch (e) {
                    console.error("Gemini recognition failed:", e);
                    // Можно не прерывать регистрацию, а просто записать ошибку
                    recognized_data = { error: `Recognition failed: ${e.message}` };
                }
            }
            // +++ КОНЕЦ ЛОГИКИ РАСПОЗНАВАНИЯ +++

            const extra = {
                ...otherData,
                telegram_user_id: telegram_user_id,
                // Переименовываем для консистентности
                video_selfie_storage_path: video_note_storage_path,
            };

            const { data: clientData, error: clientError } = await supabaseAdmin
                .from("clients")
                .insert([{
                    name,
                    phone,
                    city: otherData.city,
                    extra,
                    verification_status: 'needs_confirmation',
                    // Сохраняем распознанные данные
                    recognized_passport_data: recognized_data,
                    telegram_user_id: telegram_user_id // <--- FIX: Save to main column too
                }])
                .select()
                .single();

            if (clientError) {
                if (clientError.message.includes('duplicate key')) {
                    return res.status(409).json({ error: "Пользователь с таким номером или Telegram ID уже существует." });
                }
                throw clientError;
            }

            return res.status(200).json({
                success: true,
                client: clientData,
                message: 'Ваши данные приняты на проверку.'
            });
        } else { // Default to webapp-register
            const { initData, formData } = body;
            if (!validateTelegramData(initData, botToken)) {
                return res.status(401).json({ error: 'Invalid Telegram data' });
            }
            const urlParams = new URLSearchParams(initData);
            const userData = JSON.parse(decodeURIComponent(urlParams.get('user')));
            const userId = userData.id;
            const supabaseAdmin = createSupabaseAdmin();
            const {
                name, phone, city, citizenship, emergency_contact_phone,
                recognized_data, inn, has_no_registration_stamp, migrant_info,
                file_ids = []
            } = formData || {};
            let normalizedFileIds = [];
            if (Array.isArray(file_ids)) {
                normalizedFileIds = file_ids.filter((item) => item && item.file_id && item.field);
            } else if (typeof file_ids === 'string' && file_ids.trim()) {
                try {
                    const parsed = JSON.parse(file_ids);
                    if (Array.isArray(parsed)) {
                        normalizedFileIds = parsed.filter((item) => item && item.file_id && item.field);
                    }
                } catch (err) {
                    console.warn('Failed to parse file_ids string:', err);
                }
            }
            if (!name || !phone || !city) {
                return res.status(400).json({ error: 'Name, phone, and city are required.' });
            }
            const migrantInfo = (() => {
                if (!migrant_info) return {};
                if (typeof migrant_info === 'string') {
                    try {
                        return JSON.parse(migrant_info) || {};
                    } catch {
                        return {};
                    }
                }
                if (typeof migrant_info === 'object') {
                    return migrant_info;
                }
                return {};
            })();
            const extra = {
                citizenship: citizenship || '',
                emergency_contact_phone: emergency_contact_phone || '',
                migrant_info: migrantInfo,
                telegram_user_id: userId,
                verification_status: normalizedFileIds.length > 0 ? 'pending_ocr' : 'approved'
            };
            if (citizenship === 'ru') {
                extra.inn = inn || '';
                extra.has_no_registration_stamp = has_no_registration_stamp === 'true';
            } else {
                extra.inn = inn || '';
            }
            const { data: clientData, error: clientError } = await supabaseAdmin
                .from("clients")
                .insert([{ name, phone, city, extra }])
                .select()
                .single();
            if (clientError) {
                if (clientError.message.includes('duplicate key value violates unique constraint "clients_phone_key"')) {
                    return res.status(409).json({ error: "Пользователь с таким номером телефона уже зарегистрирован." });
                }
                throw clientError;
            }
            const newUserId = clientData.id;
            if (normalizedFileIds.length > 0) {
                triggerOCRProcessing(newUserId, normalizedFileIds);
            }
            return res.status(200).json({
                success: true,
                client: clientData,
                message: normalizedFileIds.length > 0
                    ? 'Регистрация принята. Документы обрабатываются.'
                    : 'Регистрация завершена успешно.'
            });
        }
    } catch (error) {
        console.error('Authentication handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
