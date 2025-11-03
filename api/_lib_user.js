const { Pool } = require('pg');
const fetch = require('node-fetch');
const playwright = require('playwright-aws-lambda');
const htmlToDocx = require('html-to-docx');

// Lazy initialization для connection pool
let pool = null;

function buildPoolConfig() {
    const baseConfig = {
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
        try {
            const parsed = new URL(dbUrl);
            const searchParams = Object.fromEntries(parsed.searchParams.entries());

            const sslMode = (searchParams.sslmode || '').toLowerCase();
            let sslConfig = baseConfig.ssl;
            if (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'allow') {
                sslConfig = { rejectUnauthorized: false };
            } else if (sslMode === 'disable') {
                sslConfig = false;
            }

            return {
                ...baseConfig,
                ...sanitizeClientConfig(searchParams),
                ssl: sslConfig,
                host: parsed.hostname,
                port: parsed.port ? parseInt(parsed.port, 10) : 5432,
                user: decodeURIComponent(parsed.username || ''),
                password: decodeURIComponent(parsed.password || ''),
                database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || process.env.DB_NAME || 'postgres'),
                _source: 'DATABASE_URL',
            };
        } catch (error) {
            console.error('[_lib_user] Failed to parse DATABASE_URL, falling back to individual env vars:', error.message);
        }
    }

    return {
        ...baseConfig,
        host: process.env.DB_HOST || '51.250.17.150',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'prizmatic_user',
        password: process.env.DB_PASSWORD || 'ln2+1fSbrciaIavThI+w2S/0+BQufhiMUmUU9g1CDeQ=',
        database: process.env.DB_NAME || 'prizmatic',
        _source: 'ENV_FALLBACK',
    };
}

function sanitizeClientConfig(params) {
    const config = {};

    if ('application_name' in params) {
        config.application_name = params.application_name;
    }
    if ('options' in params) {
        config.options = params.options;
    }
    if ('statement_timeout' in params) {
        const value = parseInt(params.statement_timeout, 10);
        if (!Number.isNaN(value)) {
            config.statement_timeout = value;
        }
    }
    if ('query_timeout' in params) {
        const value = parseInt(params.query_timeout, 10);
        if (!Number.isNaN(value)) {
            config.query_timeout = value;
        }
    }
    if ('connect_timeout' in params) {
        const value = parseInt(params.connect_timeout, 10);
        if (!Number.isNaN(value)) {
            config.connectionTimeoutMillis = value * 1000;
        }
    }
    if ('keepalives' in params) {
        config.keepAlive = params.keepalives === '1' || params.keepalives === 'true';
    }

    return config;
}

function getPool() {
    if (!pool) {
        const config = buildPoolConfig();

        console.log('[_lib_user] Creating DB pool with:', {
            source: config._source,
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            ssl: !!config.ssl,
        });

        const { _source, ...poolConfig } = config;
        pool = new Pool(poolConfig);
    }
    return pool;
}

// Вспомогательная функция для выполнения запросов
async function query(text, params) {
    const client = await getPool().connect();
    try {
        const result = await client.query(text, params);
        return { rows: result.rows, rowCount: result.rowCount };
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } finally {
        client.release();
    }
}

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (err) {
            console.error('Failed to parse request body:', err);
            return {};
        }
    }
    return body;
}

async function handleUpdateLocation({ userId, latitude, longitude }) {
    if (!userId || typeof latitude !== 'number' || typeof longitude !== 'number') {
        return { status: 400, body: { error: 'userId, latitude, and longitude are required.' } };
    }
    
    // PostGIS использует ST_SetSRID(ST_MakePoint(lon, lat), 4326)
    await query(
        `UPDATE clients 
         SET last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography 
         WHERE id = $3`,
        [longitude, latitude, userId]
    );

    return { status: 200, body: { message: 'Location updated successfully.' } };
}

async function handleVerifyToken({ token }) {
    if (!token) {
        return { status: 400, body: { error: 'token is required.' } };
    }
    
    const result = await query(
        'SELECT id, name, auth_token FROM clients WHERE auth_token = $1',
        [token]
    );

    if (result.rowCount === 0) {
        return { status: 401, body: { error: 'Invalid or expired token.' } };
    }

    const client = result.rows[0];
    return { status: 200, body: { userId: client.id, userName: client.name } };
}

async function handleGetPendingContracts({ userId }) {
    if (!userId) {
        return { status: 400, body: { error: 'userId is required.' } };
    }
    
    const result = await query(
        `SELECT r.id, r.status, r.bike_id,
            jsonb_build_object('title', t.title) as tariffs,
            jsonb_build_object(
                'id', b.id,
                'bike_code', b.bike_code,
                'model_name', b.model_name,
                'frame_number', b.frame_number,
                'battery_numbers', b.battery_numbers,
                'registration_number', b.registration_number,
                'iot_device_id', b.iot_device_id,
                'additional_equipment', b.additional_equipment
            ) as bikes
         FROM rentals r
         LEFT JOIN tariffs t ON r.tariff_id = t.id
         LEFT JOIN bikes b ON r.bike_id = b.id
         WHERE r.user_id = $1 AND r.status = 'awaiting_contract_signing'`,
        [userId]
    );

    return { status: 200, body: { rentals: result.rows } };
}

async function handleGetContractDetails({ userId, rentalId }) {
    if (!userId || !rentalId) {
        return { status: 400, body: { error: 'userId and rentalId are required.' } };
    }
    
    const result = await query(
        `SELECT r.id,
            jsonb_build_object(
                'name', c.name,
                'city', c.city,
                'recognized_passport_data', c.recognized_passport_data
            ) as clients,
            jsonb_build_object('title', t.title) as tariffs,
            jsonb_build_object(
                'model_name', b.model_name,
                'frame_number', b.frame_number,
                'battery_numbers', b.battery_numbers,
                'registration_number', b.registration_number,
                'iot_device_id', b.iot_device_id,
                'additional_equipment', b.additional_equipment
            ) as bikes
         FROM rentals r
         LEFT JOIN clients c ON r.user_id = c.id
         LEFT JOIN tariffs t ON r.tariff_id = t.id
         LEFT JOIN bikes b ON r.bike_id = b.id
         WHERE r.id = $1 AND r.user_id = $2`,
        [rentalId, userId]
    );

    if (result.rowCount === 0) {
        return { status: 404, body: { error: 'Rental not found' } };
    }

    return { status: 200, body: { rental: result.rows[0] } };
}

async function handleGetActiveRental({ userId }) {
    if (!userId) {
        return { status: 400, body: { error: 'userId is required.' } };
    }
    
    const result = await query(
        `SELECT r.*,
            jsonb_build_object(
                'title', t.title,
                'price_rub', t.price_rub,
                'duration_days', t.duration_days
            ) as tariffs
         FROM rentals r
         LEFT JOIN tariffs t ON r.tariff_id = t.id
         WHERE r.user_id = $1 
         AND r.status IN ('active', 'overdue', 'pending_return')
         ORDER BY r.created_at DESC
         LIMIT 1`,
        [userId]
    );

    return { status: 200, body: { rental: result.rowCount > 0 ? result.rows[0] : null } };
}

function generateContractHTML(rentalData) {
    const client = rentalData.clients;
    const bike = rentalData.bikes;
    const now = new Date();
    const passport = client?.recognized_passport_data || {};

    // Format battery numbers if it's an array
    const batteryNumbers = Array.isArray(bike?.battery_numbers)
        ? bike.battery_numbers.join(', ')
        : (bike?.battery_numbers || 'N/A');

    return `
        <div style="text-align: center; font-weight: bold; font-size: 1.2em; margin-bottom: 20px;">
            Акт приема-передачи<br>
            (Приложение №1 к Договору проката)
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9em;">
            <span>г. ${client?.city || 'Москва'}</span>
            <span>${now.toLocaleDateString('ru-RU')}</span>
        </div>
        <h4 style="margin-top: 20px; margin-bottom: 10px;">1. Оборудование</h4>
        <table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 20px; text-align: left; font-size: 0.9em;">
            <tbody style="text-align: left;">
                <tr><th style="padding: 8px; width: 40%;">Наименование</th><td style="padding: 8px;">${bike?.model_name || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номер рамы</th><td style="padding: 8px;">${bike?.frame_number || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номера аккумуляторов</th><td style="padding: 8px;">${batteryNumbers}</td></tr>
                <tr><th style="padding: 8px;">Рег. номер</th><td style="padding: 8px;">${bike?.registration_number || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номер IOT</th><td style="padding: 8px;">${bike?.iot_device_id || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Доп. оборудование</th><td style="padding: 8px;">${bike?.additional_equipment || 'N/A'}</td></tr>
            </tbody>
        </table>

        <h4 style="margin-top: 20px; margin-bottom: 10px;">2. Арендатор</h4>
        <table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 20px; text-align: left; font-size: 0.9em;">
            <tbody style="text-align: left;">
                <tr><th style="padding: 8px; width: 40%;">ФИО</th><td style="padding: 8px;">${client?.name || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Дата рождения</th><td style="padding: 8px;">${passport['Дата рождения'] || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Паспорт</th><td style="padding: 8px;">${passport['Серия и номер паспорта'] || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Кем выдан</th><td style="padding: 8px;">${passport['Кем выдан'] || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Дата выдачи</th><td style="padding: 8px;">${passport['Дата выдачи'] || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Адрес регистрации</th><td style="padding: 8px;">${passport['Адрес регистрации'] || 'N/A'}</td></tr>
            </tbody>
        </table>

        <p style="font-size: 0.9em; margin-top: 20px;">Инструктаж пройден, с условиями согласен, техника и оборудование комплектны, на момент передачи исправны, нареканий нет.</p>
    `;
}

async function handleConfirmContract({ userId, rentalId, signatureData }) {
    if (!userId || !rentalId || !signatureData) {
        return { status: 400, body: { error: 'userId, rentalId, and signatureData are required.' } };
    }

    let browser = null;

    try {
        // ШАГ 1: Получаем все данные для договора
        const result = await query(
            `SELECT 
                jsonb_build_object(
                    'name', c.name,
                    'city', c.city,
                    'recognized_passport_data', c.recognized_passport_data
                ) as clients,
                jsonb_build_object(
                    'model_name', b.model_name,
                    'frame_number', b.frame_number,
                    'battery_numbers', b.battery_numbers,
                    'registration_number', b.registration_number,
                    'iot_device_id', b.iot_device_id,
                    'additional_equipment', b.additional_equipment
                ) as bikes
             FROM rentals r
             LEFT JOIN clients c ON r.user_id = c.id
             LEFT JOIN bikes b ON r.bike_id = b.id
             WHERE r.id = $1 AND r.user_id = $2`,
            [rentalId, userId]
        );

        if (result.rowCount === 0) {
            throw new Error('Rental not found or access denied');
        }

        const rentalData = result.rows[0];

        // ШАГ 2: Собираем полный HTML для PDF-документа
        const contractBodyHTML = generateContractHTML(rentalData);
        const fullHTML = `
            <!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><style>
            body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; line-height: 1.4; color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; width: 40%; }
            h2, h4 { text-align: center; }
            </style></head><body>
                ${contractBodyHTML}
                <div style="margin-top: 30px; page-break-inside: avoid;">
                    <h4>Подпись Арендатора:</h4>
                    <img src="${signatureData}" alt="Подпись" style="width: 180px; height: auto;"/>
                </div>
            </body></html>
        `;

        // ШАГ 3: Запускаем "невидимый" браузер и генерируем PDF
        browser = await playwright.launchChromium({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.setContent(fullHTML, { waitUntil: 'load' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

        // ШАГ 4: Загружаем готовый PDF в Minio (TODO: нужно будет реализовать)
        // Пока сохраним как base64 в extra_data
        const pdfBase64 = pdfBuffer.toString('base64');
        const publicUrl = `data:application/pdf;base64,${pdfBase64}`;

        // ШАГ 5: Активируем аренду и сохраняем ссылку на документ
        await query(
            `UPDATE rentals 
             SET status = 'active',
                 extra_data = jsonb_set(COALESCE(extra_data, '{}'::jsonb), '{contract_document_url}', $1::jsonb)
             WHERE id = $2 AND user_id = $3`,
            [JSON.stringify(publicUrl), rentalId, userId]
        );

        return { status: 200, body: { message: 'Contract signed and rental activated' } };

    } catch (error) {
        console.error('Contract confirmation error:', error);
        return { status: 500, body: { error: 'Не удалось сгенерировать договор: ' + error.message } };
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
}

async function handleGetPaymentMethod({ userId }) {
    if (!userId) {
        return { status: 400, body: { error: 'userId is required.' } };
    }
    
    const result = await query(
        'SELECT extra FROM clients WHERE id = $1',
        [userId]
    );

    if (result.rowCount === 0) {
        return { status: 404, body: { error: 'User not found' } };
    }

    const client = result.rows[0];
    const paymentMethodDetails = client?.extra?.payment_method_details;

    if (!paymentMethodDetails) {
        return { status: 404, body: { error: 'No saved payment method found for this user.' } };
    }

    return { status: 200, body: { payment_method: paymentMethodDetails } };
}

async function handleUnbindPaymentMethod({ userId }) {
    if (!userId) {
        return { status: 400, body: { error: 'User ID is required' } };
    }

    await query(
        `UPDATE clients 
         SET yookassa_payment_method_id = NULL,
             autopay_enabled = false,
             extra = '{}'::jsonb
         WHERE id = $1`,
        [userId]
    );

    return { status: 200, body: { success: true, message: 'Payment method successfully unbound.' } };
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const body = parseRequestBody(req.body);
        const { action } = body;

        let result;
        switch (action) {
            case 'update-location':
                result = await handleUpdateLocation(body);
                break;
            case 'verify-token':
                result = await handleVerifyToken(body);
                break;
            case 'get-pending-contracts':
                result = await handleGetPendingContracts(body);
                break;
            case 'get-contract-details':
                result = await handleGetContractDetails(body);
                break;
            case 'confirm-contract':
                result = await handleConfirmContract(body);
                break;
            case 'get-active-rental':
                result = await handleGetActiveRental(body);
                break;
            case 'get-payment-method':
                result = await handleGetPaymentMethod(body);
                break;
            case 'unbind-payment-method':
                result = await handleUnbindPaymentMethod(body);
                break;
            default:
                result = { status: 400, body: { error: 'Invalid action' } };
        }

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('User handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
