const { getSupabaseServiceRoleClient } = require('../supabase');
const crypto = require('crypto');
const axios = require('axios');
const busboy = require('busboy');
// +++ ДОБАВЛЯЕМ НОВЫЙ ИМПОРТ +++
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    return result;
}

/**
 * Parse multipart/form-data with busboy
 */
function parseMultipartForm(req) {
    return new Promise((resolve, reject) => {
        const bb = busboy({ headers: req.headers });
        const fields = {};
        const files = {};
        
        bb.on('field', (fieldname, value) => {
            fields[fieldname] = value;
        });
        
        bb.on('file', (fieldname, file, info) => {
            const { filename, mimeType } = info;
            const chunks = [];
            
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                files[fieldname] = {
                    filename: filename || `${fieldname}.jpg`,
                    buffer: Buffer.concat(chunks),
                    mimeType: mimeType || 'image/jpeg'
                };
            });
        });
        
        bb.on('finish', () => resolve({ fields, files }));
        bb.on('error', reject);
        
        req.pipe(bb);
    });
}

async function handler(req, res) {
    try {
        // Set JSON content type first to ensure errors are returned as JSON
        res.setHeader('Content-Type', 'application/json');
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
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not configured on server' });
        }

        // Check if this is multipart/form-data (web registration with files)
        const contentType = req.headers['content-type'] || '';
        const isMultipart = contentType.includes('multipart/form-data');
        
        if (isMultipart) {
            // Handle web registration with file uploads
            const { fields, files } = await parseMultipartForm(req);
            
            let supabaseAdmin;
            try {
                supabaseAdmin = getSupabaseServiceRoleClient();
            } catch (supabaseError) {
                console.error('[Auth] Supabase initialization error:', supabaseError);
                return res.status(500).json({ error: 'Database configuration error. Please contact support.' });
            }
            
            const { phone, city, citizenship, country } = fields;
            
            if (!phone || !city || !citizenship) {
                return res.status(400).json({ error: 'Phone, city, and citizenship are required.' });
            }
            
            // Extract name from phone verification data
            const { data: existingClient } = await supabaseAdmin
                .from('clients')
                .select('name')
                .eq('phone', phone)
                .single();
            
            const name = existingClient?.name || 'Пользователь';
            
            // Create client first to get user_id
            const { data: clientData, error: clientError } = await supabaseAdmin
                .from('clients')
                .upsert([{
                    phone,
                    name,
                    city,
                    verification_status: 'pending',
                    extra: {
                        citizenship,
                        country: country || null
                    }
                }], {
                    onConflict: 'phone',
                    ignoreDuplicates: false
                })
                .select()
                .single();
            
            if (clientError) {
                console.error('Error creating/updating client:', clientError);
                return res.status(500).json({ error: 'Failed to create client record.' });
            }
            
            const userId = clientData.id;
            console.log(`[Web Registration] Created/updated client ${userId}`);
            
            // Upload files to Storage under user_id folder
            const uploadedPaths = [];
            const fileEntries = Object.entries(files);
            
            console.log(`[Web Registration] Attempting to upload ${fileEntries.length} files for user ${userId}`);
            
            for (const [fieldname, fileData] of fileEntries) {
                const filePath = `${userId}/${fieldname}_${Date.now()}.jpg`;
                
                console.log(`[Web Registration] Uploading ${fieldname}: ${fileData.buffer.length} bytes`);
                
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('passports')
                    .upload(filePath, fileData.buffer, {
                        contentType: fileData.mimeType,
                        upsert: false
                    });
                
                if (uploadError) {
                    console.error(`[Web Registration] Failed to upload ${fieldname}:`, uploadError.message);
                } else {
                    uploadedPaths.push(filePath);
                    console.log(`[Web Registration] ✓ Uploaded ${filePath}`);
                }
            }
            
            console.log(`[Web Registration] Successfully uploaded ${uploadedPaths.length}/${fileEntries.length} files`);
            
            // Run OCR with Gemini
            let recognized_data = {};
            if (uploadedPaths.length > 0) {
                try {
                    console.log(`[Web Registration] Starting OCR for user ${userId}...`);
                    recognized_data = await recognizeDocumentsWithGemini(
                        supabaseAdmin,
                        uploadedPaths,
                        citizenship
                    );
                    console.log(`[Web Registration] OCR result:`, recognized_data);
                    
                    // Update client with recognized data
                    await supabaseAdmin
                        .from('clients')
                        .update({
                            recognized_passport_data: recognized_data,
                            verification_status: 'needs_confirmation'
                        })
                        .eq('id', userId);
                } catch (e) {
                    console.error('[Web Registration] OCR failed:', e);
                    recognized_data = { error: `Recognition failed: ${e.message}` };
                }
            }
            
            return res.status(200).json({
                success: true,
                user: {
                    id: userId,
                    name: clientData.name,
                    phone: clientData.phone,
                    city: clientData.city
                },
                message: 'Регистрация завершена. Ваши данные отправлены на проверку.',
                // Отладочная информация (уберите в продакшене)
                debug: {
                    filesReceived: fileEntries.length,
                    filesUploaded: uploadedPaths.length,
                    uploadedPaths: uploadedPaths,
                    ocrAttempted: uploadedPaths.length > 0,
                    recognizedFields: Object.keys(recognized_data).length
                }
            });
        }
        
        // Handle JSON requests (Telegram-based auth)
        let body;
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (parseError) {
            console.error('[Auth] Failed to parse request body:', parseError);
            return res.status(400).json({ error: 'Invalid JSON in request body' });
        }
        
        if (!body) {
            return res.status(400).json({ error: 'Request body is required' });
        }
        
        const { action } = body;

        if (action === 'check-user-exists') {
            // Проверка существует ли пользователь с таким номером
            const { phone } = body;
            console.log('[check-user-exists] Searching for phone:', phone);
            const supabaseAdmin = getSupabaseServiceRoleClient();
            
            const { data: client, error } = await supabaseAdmin
                .from('clients')
                .select('id')
                .eq('phone', phone)
                .single();
            
            console.log('[check-user-exists] Result:', { found: !!client, error: error?.message });
            
            return res.status(200).json({
                exists: !!client
            });
        } else if (action === 'login-by-phone') {
            // Вход по номеру телефона (после звонка)
            const { phone, skipCallCheck } = body;
            const supabaseAdmin = getSupabaseServiceRoleClient();
            
            // Тестовый номер - пропускаем проверку звонка
            const isTestPhone = phone === '79129850281';
            
            if (isTestPhone || skipCallCheck) {
                console.log('[login-by-phone] Test phone detected, skipping call check:', phone);
            }
            
            const { data: client, error } = await supabaseAdmin
                .from('clients')
                .select('*')
                .eq('phone', phone)
                .single();
            
            if (error || !client) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            return res.status(200).json({
                success: true,
                user: {
                    id: client.id,
                    name: client.name,
                    phone: client.phone,
                    city: client.city,
                    balance_rub: client.balance_rub,
                    verification_status: client.extra?.verification_status || client.verification_status
                }
            });
        } else if (action === 'login') {
            const { initData } = body;
            if (!validateTelegramData(initData, botToken)) {
                return res.status(401).json({ error: 'Invalid Telegram data' });
            }
            const urlParams = new URLSearchParams(initData);
            const userData = JSON.parse(decodeURIComponent(urlParams.get('user')));
            const telegramUserId = userData.id;
            const supabaseAdmin = getSupabaseServiceRoleClient();
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

            const supabaseAdmin = getSupabaseServiceRoleClient();

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
            const supabaseAdmin = getSupabaseServiceRoleClient();
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
        console.error('[Auth] Handler error:', error);
        // Ensure Content-Type is set to JSON
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ 
            error: error.message || 'An internal server error occurred',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

module.exports = handler;
