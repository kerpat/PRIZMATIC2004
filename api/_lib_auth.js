const crypto = require('crypto');
const axios = require('axios');
const busboy = require('busboy');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { query } = require('./_lib_db');
const { saveBuffer, downloadToBuffer } = require('./_lib_storage_backend');

const TELEGRAM_HASH_KEY = 'WebAppData';

function normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 10) return '';
    return digits;
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
        // Добавляем дополнительные параметры для лучшей совместимости с мобильными устройствами
        const bb = busboy({ 
            headers: req.headers,
            // Увеличиваем лимиты для обработки больших файлов с камеры
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
                files: 10,
                fields: 50
            }
        });
        const fields = {};
        const files = {};

        bb.on('field', (fieldname, value) => {
            fields[fieldname] = value;
        });

        bb.on('file', (fieldname, file, info) => {
            const { filename, mimeType } = info;
            console.log(`[auth] Receiving file: ${filename}, field: ${fieldname}, mimeType: ${mimeType}`); // Added logging
            const chunks = [];

            file.on('error', (err) => {
                console.error(`[auth] Error reading file stream for ${fieldname}:`, err);
                file.resume();
            });

            file.on('data', (chunk) => {
                if (chunk && chunk.length > 0) {
                    chunks.push(chunk);
                }
            });
            
            file.on('end', () => {
                if (chunks.length === 0) {
                    console.warn(`[auth] File ${fieldname} has no data chunks.`);
                    return;
                }
                
                const buffer = Buffer.concat(chunks);

                if (!buffer || buffer.length === 0) {
                    console.warn(`[auth] File ${fieldname} resulted in an empty buffer.`);
                    return;
                }
                
                if (buffer.length < 100) { // Lowered threshold to catch tiny invalid files
                    console.warn(`[auth] File ${fieldname} is very small (${buffer.length} bytes), might be invalid.`);
                }
                
                let normalizedMimeType = mimeType || 'application/octet-stream';
                const isGenericMimeType = !mimeType || mimeType === 'application/octet-stream' || mimeType.includes('*');

                if (isGenericMimeType) {
                    console.log(`[auth] MimeType for ${filename} is generic (${mimeType}), attempting magic byte detection.`);
                    const magicBytes = buffer.subarray(0, 4);
                    const magicHex = magicBytes.toString('hex').toLowerCase();
                    
                    if (magicHex.startsWith('ffd8ffe')) { // More general JPEG check
                        normalizedMimeType = 'image/jpeg';
                        console.log(`[auth] Detected JPEG for ${filename}`);
                    } else if (magicHex.startsWith('89504e47')) {
                        normalizedMimeType = 'image/png';
                        console.log(`[auth] Detected PNG for ${filename}`);
                    } else if (magicHex.startsWith('47494638')) {
                        normalizedMimeType = 'image/gif';
                        console.log(`[auth] Detected GIF for ${filename}`);
                    } else if (magicHex.startsWith('52494646')) {
                        normalizedMimeType = 'image/webp';
                        console.log(`[auth] Detected WEBP for ${filename}`);
                    } else {
                        console.warn(`[auth] Could not detect image type for ${filename} from magic bytes: ${magicHex}`);
                    }
                }
                
                files[fieldname] = {
                    filename: filename || `${fieldname}_${Date.now()}.bin`,
                    buffer: buffer,
                    mimeType: normalizedMimeType,
                };
            });
        });

        bb.on('error', (err) => {
            console.error('[auth] Busboy error:', err);
            // Вместо полного отказа, возвращаем частичные данные если есть
            resolve({ fields, files });
        });

        bb.on('finish', () => resolve({ fields, files }));

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
                let buffer;
                let mimeType = file.mimeType || 'image/jpeg';

                if (file.url) {
                    const response = await axios.get(file.url, { responseType: 'arraybuffer' });
                    buffer = Buffer.from(response.data);
                    mimeType = response.headers['content-type'] || mimeType;
                } else {
                    const { bucket, object } = file;
                    const download = await downloadToBuffer(bucket, object);
                    buffer = download.buffer;
                    mimeType = file.mimeType || download.mimeType || mimeType;
                }

                imageParts.push({
                    inlineData: {
                        data: buffer.toString('base64'),
                        mimeType: mimeType,
                    },
                });
            } catch (error) {
                console.error(`[auth] Failed to load file ${file.path || file.url} for OCR:`, error.message);
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



async function ensureTestClient(phone) {
    const testPhone = '79129850281';
    if (phone !== testPhone) {
        return null;
    }

    let client = await findClientByPhone(phone);
    if (!client) {
        const testName = process.env.TEST_ACCOUNT_NAME || 'Тест Тестов';
        const testCity = process.env.TEST_ACCOUNT_CITY || 'Москва';

        await upsertClientByPhone({
            phone,
            name: testName,
            city: testCity,
            citizenship: 'RU',
        });

        await query(
            `UPDATE clients
             SET verification_status = 'approved',
                 extra = COALESCE(extra, '{}'::jsonb) || $2::jsonb
             WHERE phone = $1`,
            [phone, safeJson({ test_account: true })]
        );

        client = await findClientByPhone(phone);
    } else if (client.verification_status !== 'approved') {
        await query(
            `UPDATE clients
             SET verification_status = 'approved',
                 extra = COALESCE(extra, '{}'::jsonb) || $2::jsonb
             WHERE id = $1`,
            [client.id, safeJson({ test_account: true })]
        );
        client = await findClientByPhone(phone);
    }

    return client;
}

async function storeUploadedFiles(files, userId) {
    const entries = Object.entries(files || {});
    if (!entries.length) return [];

    const saved = [];
    for (const [fieldName, fileData] of entries) {
        // Проверяем, что у нас есть валидные данные файла
        if (!fileData?.buffer || !Buffer.isBuffer(fileData.buffer) || !fileData.buffer.length) {
            console.warn(`[auth] Skipping invalid file data for field ${fieldName}`);
            continue;
        }
        
        // Проверяем, что это действительно изображение по содержимому
        const buffer = fileData.buffer;
        if (buffer.length < 1024) { // Слишком маленький файл для изображения
            console.warn(`[auth] Skipping too small file for field ${fieldName}: ${buffer.length} bytes`);
            continue;
        }
        
        // Проверяем сигнатуру файла для подтверждения типа
        const magicBytes = buffer.subarray(0, 4);
        const magicHex = magicBytes.toString('hex').toLowerCase();
        
        let isValidImage = false;
        if (fileData.mimeType.startsWith('image/')) {
            // Если MIME-тип уже определен как изображение, проверяем соответствие
            if (fileData.mimeType === 'image/jpeg' && 
                (magicHex.startsWith('ffd8ffe0') || magicHex.startsWith('ffd8ffe1') || magicHex.startsWith('ffd8ffe2'))) {
                isValidImage = true;
            } else if (fileData.mimeType === 'image/png' && magicHex.startsWith('89504e47')) {
                isValidImage = true;
            } else if (fileData.mimeType === 'image/gif' && magicHex.startsWith('47494638')) {
                isValidImage = true;
            } else if (fileData.mimeType === 'image/webp' && magicHex.startsWith('52494646')) {
                isValidImage = true;
            } else if (!fileData.mimeType.includes('image')) {
                // Если MIME-тип не определен как изображение, но данные выглядят как изображение
                if (magicHex.startsWith('ffd8ffe0') || magicHex.startsWith('ffd8ffe1') || 
                    magicHex.startsWith('ffd8ffe2') || magicHex.startsWith('89504e47') ||
                    magicHex.startsWith('47494638') || magicHex.startsWith('52494646')) {
                    isValidImage = true;
                }
            }
        }
        
        // Если файл не является валидным изображением, пропускаем его
        if (!isValidImage) {
            console.warn(`[auth] Skipping non-image file for field ${fieldName}, magic bytes: ${magicHex}`);
            continue;
        }

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
    let client = await findClientByPhone(phone);
    if (!client) {
        client = await ensureTestClient(phone);
    }
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

    let client = await findClientByPhone(phone);

    if (isTestPhone) {
        client = await ensureTestClient(phone) || client;
    }

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

async function handleRegistrationWithUrls(body, res) {
    const { phone, city, citizenship, country, files } = body;

    if (!phone || !city || !citizenship || !files) {
        res.status(400).json({ error: 'Missing required registration data.' });
        return;
    }

    const client = await upsertClientByPhone({
        phone: normalizePhone(phone),
        name: 'Пользователь', // Default name
        city,
        citizenship,
        country,
    });

    const fileDescriptors = Object.entries(files).map(([fieldName, url]) => ({
        url: url,
        fieldName: fieldName
    }));

    let recognizedData = {};
    if (fileDescriptors.length > 0) {
        recognizedData = await recognizeDocumentsWithGemini(fileDescriptors, citizenship);

        await query(
            `UPDATE clients
             SET recognized_passport_data = $1::jsonb,
                 verification_status = 'needs_confirmation',
                 extra = extra || jsonb_build_object('uploaded_documents', $2::jsonb)
             WHERE id = $3`,
            [safeJson(recognizedData || {}), safeJson(files), client.id]
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
        if (contentType.includes('multipart/form-data')) {
            await handleMultipartRegistration(req, res);
            return;
        }

        const body = parseRequestBody(req.body);
        const { action } = body;

        switch (action) {
            case 'register-with-urls':
                await handleRegistrationWithUrls(body, res);
                break;
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
        }
    } catch (error) {
        console.error('[auth] Handler error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

module.exports = handler;
module.exports.default = handler;
