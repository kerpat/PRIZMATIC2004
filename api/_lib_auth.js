<<<<<<< HEAD
const { createClient } = require('@supabase/supabase-js');
=======
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
const crypto = require('crypto');
const axios = require('axios');
const busboy = require('busboy');
const { GoogleGenerativeAI } = require('@google/generative-ai');

<<<<<<< HEAD
function createSupabaseAdmin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service credentials are not configured.');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
=======
const { query } = require('./_lib_db');
const { saveBuffer, downloadToBuffer } = require('./_lib_storage_backend');

const TELEGRAM_HASH_KEY = 'WebAppData';

function normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 10) return '';
    return digits;
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
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

        const secretKey = crypto
            .createHmac('sha256', TELEGRAM_HASH_KEY)
            .update(botToken)
            .digest();

        const hmac = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        return hmac === hash;
    } catch (error) {
        console.error('[auth] Telegram data validation error:', error);
        return false;
    }
}

async function triggerOCRProcessing(userId, fileDescriptors) {
    const ocrWorkerUrl = process.env.OCR_WORKER_URL;
    const internalSecret = process.env.INTERNAL_SECRET;

    if (!ocrWorkerUrl || !internalSecret) {
        console.warn('[auth] OCR worker not configured, skipping async OCR trigger');
        return;
    }

    try {
        await axios.post(
            `${ocrWorkerUrl}/process-document`,
            { userId, files: fileDescriptors },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': internalSecret,
                },
                timeout: 5000,
            }
        );
    } catch (error) {
        console.error('[auth] Failed to trigger OCR worker:', error.message);
    }
}

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
                    filename: filename || `${fieldname}.bin`,
                    buffer: Buffer.concat(chunks),
                    mimeType: mimeType || 'application/octet-stream',
                };
            });
        });

        bb.on('finish', () => resolve({ fields, files }));
        bb.on('error', reject);

        req.pipe(bb);
    });
}

async function recognizeDocumentsWithGemini(fileDescriptors, countryCode) {
    if (!process.env.GOOGLE_API_KEY) {
        console.warn('[auth] GOOGLE_API_KEY is not configured; skipping OCR recognition.');
        return {};
    }

    if (!fileDescriptors?.length) {
        return {};
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const imageParts = [];
        for (const file of fileDescriptors) {
            try {
                const { bucket, object, mimeType } = file;
                const download = await downloadToBuffer(bucket, object);
                imageParts.push({
                    inlineData: {
                        data: download.buffer.toString('base64'),
                        mimeType: file.mimeType || download.mimeType || 'image/jpeg',
                    },
                });
            } catch (error) {
                console.error(`[auth] Failed to load file ${file.path} for OCR:`, error.message);
            }
        }

        if (imageParts.length === 0) {
            return {};
        }

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

        const result = await model.generateContent([prompt, ...imageParts]);
        const text = await result.response.text();
        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(cleaned);
        } catch (error) {
            console.error('[auth] Failed to parse OCR JSON output:', cleaned);
            return { error: 'Failed to parse recognition result.' };
        }
    } catch (error) {
        console.error('[auth] Gemini OCR failed:', error);
        return { error: error.message || 'Gemini OCR failed.' };
    }
}

function safeJson(data) {
    if (data == null) return null;
    try {
        return JSON.stringify(data);
    } catch {
        return null;
    }
}

async function findClientByPhone(phone) {
    const result = await query(
        `SELECT id, name, phone, city, verification_status, balance_rub, extra, telegram_user_id
         FROM clients
         WHERE phone = $1
         LIMIT 1`,
        [phone]
    );
    return result.rows[0] || null;
}

async function findClientByTelegramId(telegramUserId) {
    const result = await query(
        `SELECT id, name, phone, city, verification_status, balance_rub, extra, telegram_user_id
         FROM clients
         WHERE telegram_user_id = $1
         LIMIT 1`,
        [telegramUserId]
    );
    if (result.rows[0]) return result.rows[0];

    // Backwards compatibility: legacy records might have telegram_user_id in extra
    const legacy = await query(
        `SELECT id, name, phone, city, verification_status, balance_rub, extra, telegram_user_id
         FROM clients
         WHERE extra ->> 'telegram_user_id' = $1
         LIMIT 1`,
        [String(telegramUserId)]
    );
    return legacy.rows[0] || null;
}

async function upsertClientByPhone({ phone, name, city, citizenship, country }) {
    const extraPayload = {
        citizenship: citizenship || '',
    };
    if (country) {
        extraPayload.country = country;
    }

    const result = await query(
        `INSERT INTO clients (phone, name, city, verification_status, extra)
         VALUES ($1, $2, $3, 'pending', $4::jsonb)
         ON CONFLICT (phone) DO UPDATE
         SET city = EXCLUDED.city,
             name = COALESCE(clients.name, EXCLUDED.name),
             verification_status = 'pending',
             extra = COALESCE(clients.extra, '{}'::jsonb) || EXCLUDED.extra
         RETURNING id, name, phone, city, verification_status, extra`,
        [phone, name, city, safeJson(extraPayload)]
    );

    return result.rows[0];
}

async function storeUploadedFiles(files, userId) {
    const entries = Object.entries(files || {});
    if (!entries.length) return [];

    const saved = [];
    for (const [fieldName, fileData] of entries) {
        if (!fileData?.buffer?.length) continue;
        try {
            const stored = await saveBuffer({
                bucket: 'passports',
                buffer: fileData.buffer,
                mimeType: fileData.mimeType,
                userId,
                prefix: fieldName,
                originalName: fileData.filename,
            });
            saved.push({
                ...stored,
                fieldName,
                mimeType: fileData.mimeType,
            });
        } catch (error) {
            console.error(`[auth] Failed to store file ${fieldName}:`, error.message);
        }
    }

    return saved;
}

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (error) {
            console.error('[auth] Failed to parse JSON body:', error);
            return {};
        }
    }
    return body;
}

function parseStoragePath(pathValue) {
    if (!pathValue) return null;
    const trimmed = String(pathValue).replace(/^\/+/, '');
    const [bucket, ...rest] = trimmed.split('/');
    if (!bucket || rest.length === 0) {
        return null;
    }
    return { bucket, object: rest.join('/'), path: `${bucket}/${rest.join('/')}` };
}

async function handleMultipartRegistration(req, res) {
    const { fields, files } = await parseMultipartForm(req);

    const phone = normalizePhone(fields.phone);
    const city = fields.city?.trim();
    const citizenship = fields.citizenship || '';
    const country = fields.country || null;

    if (!phone || !city || !citizenship) {
        res.status(400).json({ error: 'Phone, city, and citizenship are required.' });
        return;
    }

    const existingClient = await findClientByPhone(phone);
    const clientName = existingClient?.name || 'Пользователь';

    const client = await upsertClientByPhone({
        phone,
        name: clientName,
        city,
        citizenship,
        country,
    });

    const storedFiles = await storeUploadedFiles(files, client.id);

    let recognizedData = {};
    if (storedFiles.length > 0) {
        recognizedData = await recognizeDocumentsWithGemini(storedFiles, citizenship);

        await query(
            `UPDATE clients
             SET recognized_passport_data = $1::jsonb,
                 verification_status = 'needs_confirmation'
             WHERE id = $2`,
            [safeJson(recognizedData || {}), client.id]
        );
    }

    res.status(200).json({
        success: true,
        user: {
            id: client.id,
            name: client.name,
            phone: client.phone,
            city: client.city,
        },
        message: 'Регистрация завершена. Ваши данные отправлены на проверку.',
        debug: {
            filesReceived: Object.keys(files).length,
            filesUploaded: storedFiles.length,
            uploadedPaths: storedFiles.map((file) => file.path),
            ocrAttempted: storedFiles.length > 0,
            recognizedFields: Object.keys(recognizedData || {}).length,
        },
    });
}

async function handleCheckUserExists(body, res) {
    const phone = normalizePhone(body.phone);
    if (!phone) {
        res.status(400).json({ error: 'Phone is required.' });
        return;
    }
    const client = await findClientByPhone(phone);
    res.status(200).json({ exists: !!client });
}

async function handleLoginByPhone(body, res) {
    const phone = normalizePhone(body.phone);
    if (!phone) {
        res.status(400).json({ error: 'Phone is required.' });
        return;
    }

    const isTestPhone = phone === '79129850281';
    if (!isTestPhone && !body.skipCallCheck) {
        console.log('[auth] login-by-phone without skipCallCheck (assuming verification done upstream).');
    }

    const client = await findClientByPhone(phone);
    if (!client) {
        res.status(404).json({ error: 'Пользователь не найден' });
        return;
    }

    res.status(200).json({
        success: true,
        user: {
            id: client.id,
            name: client.name,
            phone: client.phone,
            city: client.city,
            balance_rub: client.balance_rub,
            verification_status: client.verification_status,
        },
    });
}

async function handleTelegramLogin(body, res) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not configured' });
        return;
    }

    const { initData } = body;
    if (!initData || !validateTelegramData(initData, botToken)) {
        res.status(401).json({ error: 'Invalid Telegram data' });
        return;
    }

    const urlParams = new URLSearchParams(initData);
    const userParam = urlParams.get('user');
    if (!userParam) {
        res.status(400).json({ error: 'Telegram user payload missing' });
        return;
    }

    const telegramUser = JSON.parse(decodeURIComponent(userParam));
    const telegramUserId = telegramUser.id;

    const client = await findClientByTelegramId(telegramUserId);
    if (!client) {
        res.status(404).json({ error: 'User not found. Please register first.' });
        return;
    }

    res.status(200).json({
        success: true,
        user: {
            id: client.id,
            name: client.name,
            phone: client.phone,
            city: client.city,
            balance_rub: client.balance_rub,
            verification_status: client.verification_status,
        },
    });
}

async function handleBotRegister(body, res) {
    const { userId: telegramUserId, formData } = body;
    if (!telegramUserId || !formData) {
        res.status(400).json({ error: 'Missing registration payload.' });
        return;
    }

    const {
        name,
        phone,
        city,
        recognized_data,
        video_note_storage_path,
        ...otherData
    } = formData;

    if (!name || !phone || !city || !video_note_storage_path) {
        res.status(400).json({ error: 'Missing required registration data.' });
        return;
    }

    const phoneDigits = normalizePhone(phone);
    if (!phoneDigits) {
        res.status(400).json({ error: 'Invalid phone number.' });
        return;
    }

    const existing = await findClientByPhone(phoneDigits);
    if (existing) {
        res.status(409).json({ error: 'Пользователь с таким номером уже существует.' });
        return;
    }

    const imagePaths = Object.entries(otherData)
        .filter(([key]) => key.endsWith('_storage_path'))
        .map(([, value]) => parseStoragePath(value))
        .filter(Boolean);

    let recognizedData = recognized_data || {};
    if (!Object.keys(recognizedData).length && imagePaths.length > 0) {
        recognizedData = await recognizeDocumentsWithGemini(
            imagePaths.map((item) => ({ ...item, mimeType: 'image/jpeg' })),
            otherData.citizenship || 'ru'
        );
    }

    const extraPayload = {
        ...otherData,
        telegram_user_id: telegramUserId,
        video_selfie_storage_path: video_note_storage_path,
    };

    const insertResult = await query(
        `INSERT INTO clients (name, phone, city, verification_status, extra, recognized_passport_data, telegram_user_id)
         VALUES ($1, $2, $3, 'needs_confirmation', $4::jsonb, $5::jsonb, $6)
         RETURNING id, name, phone, city, verification_status`,
        [
            name,
            phoneDigits,
            city,
            safeJson(extraPayload),
            safeJson(recognizedData || {}),
            telegramUserId,
        ]
    );

    const client = insertResult.rows[0];
    const fileDescriptors = imagePaths.map((item) => item.path);
    if (fileDescriptors.length > 0) {
        triggerOCRProcessing(client.id, fileDescriptors);
    }

    res.status(200).json({
        success: true,
        client,
        message: 'Ваши данные приняты на проверку.',
    });
}

async function handleTelegramFormRegistration(body, res) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not configured' });
        return;
    }

    const { initData, formData } = body;
    if (!initData || !formData) {
        res.status(400).json({ error: 'Invalid payload.' });
        return;
    }

    if (!validateTelegramData(initData, botToken)) {
        res.status(401).json({ error: 'Invalid Telegram data' });
        return;
    }

    const urlParams = new URLSearchParams(initData);
    const userPayload = urlParams.get('user');
    if (!userPayload) {
        res.status(400).json({ error: 'Telegram user payload missing' });
        return;
    }

    const telegramUser = JSON.parse(decodeURIComponent(userPayload));
    const telegramUserId = telegramUser.id;

    const {
        name,
        phone,
        city,
        citizenship,
        emergency_contact_phone,
        recognized_data,
        inn,
        has_no_registration_stamp,
        migrant_info,
        file_ids = [],
    } = formData || {};

    const normalizedPhone = normalizePhone(phone);
    if (!name || !normalizedPhone || !city) {
        res.status(400).json({ error: 'Name, phone, and city are required.' });
        return;
    }

    const existingClient = await findClientByPhone(normalizedPhone);
    if (existingClient) {
        res.status(409).json({ error: 'Пользователь с таким номером телефона уже зарегистрирован.' });
        return;
    }

    const normalizedFileIds = Array.isArray(file_ids)
        ? file_ids.filter((item) => item && item.file_id && item.field)
        : [];

    const migrantInfoObject = (() => {
        if (!migrant_info) return {};
        if (typeof migrant_info === 'string') {
            try {
                return JSON.parse(migrant_info);
            } catch {
                return {};
            }
        }
        if (typeof migrant_info === 'object') {
            return migrant_info;
        }
        return {};
    })();

    const extraPayload = {
        citizenship: citizenship || '',
        emergency_contact_phone: emergency_contact_phone || '',
        migrant_info: migrantInfoObject,
        telegram_user_id: telegramUserId,
        verification_status: normalizedFileIds.length > 0 ? 'pending_ocr' : 'approved',
    };

    if (citizenship === 'ru') {
        extraPayload.inn = inn || '';
        extraPayload.has_no_registration_stamp = has_no_registration_stamp === 'true';
    } else {
        extraPayload.inn = inn || '';
    }

    const insertResult = await query(
        `INSERT INTO clients (name, phone, city, verification_status, extra, recognized_passport_data, telegram_user_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
         RETURNING id, name, phone, city, verification_status`,
        [
            name,
            normalizedPhone,
            city,
            normalizedFileIds.length > 0 ? 'pending_ocr' : 'approved',
            safeJson(extraPayload),
            safeJson(recognized_data || {}),
            telegramUserId,
        ]
    );

    const client = insertResult.rows[0];

    if (normalizedFileIds.length > 0) {
        triggerOCRProcessing(client.id, normalizedFileIds);
    }

    res.status(200).json({
        success: true,
        client,
        message:
            normalizedFileIds.length > 0
                ? 'Регистрация принята. Документы обрабатываются.'
                : 'Регистрация завершена успешно.',
    });
}

async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST, OPTIONS');
            res.status(405).json({ error: 'Method Not Allowed' });
            return;
        }

        const contentType = req.headers['content-type'] || '';
<<<<<<< HEAD
        const isMultipart = contentType.includes('multipart/form-data');
        
        if (isMultipart) {
            // Handle web registration with file uploads
            const { fields, files } = await parseMultipartForm(req);
            const supabaseAdmin = createSupabaseAdmin();
            
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
=======
        if (contentType.includes('multipart/form-data')) {
            await handleMultipartRegistration(req, res);
            return;
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
        }

        const body = parseRequestBody(req.body);
        const { action } = body;

<<<<<<< HEAD
        if (action === 'check-user-exists') {
            // Проверка существует ли пользователь с таким номером
            const { phone } = body;
            console.log('[check-user-exists] Searching for phone:', phone);
            const supabaseAdmin = createSupabaseAdmin();
            
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
            const supabaseAdmin = createSupabaseAdmin();
            
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
=======
        switch (action) {
            case 'check-user-exists':
                await handleCheckUserExists(body, res);
                break;
            case 'login-by-phone':
                await handleLoginByPhone(body, res);
                break;
            case 'login':
                await handleTelegramLogin(body, res);
                break;
            case 'bot-register':
                await handleBotRegister(body, res);
                break;
            default:
                await handleTelegramFormRegistration(body, res);
                break;
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
        }
    } catch (error) {
        console.error('[auth] Handler error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

module.exports = handler;
module.exports.default = handler;
