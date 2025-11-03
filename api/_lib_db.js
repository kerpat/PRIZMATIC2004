const { Pool } = require('pg');

let pool = null;

function buildPoolConfig() {
    const baseConfig = {
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

    const rawUrl =
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.POSTGRES_CONNECTION ||
        process.env.POSTGRES_URI ||
        null;

    const dbUrl = typeof rawUrl === 'string' ? rawUrl.trim() : rawUrl;

    if (dbUrl) {
        const normalizedUrl = normalizeConnectionString(dbUrl);
        try {
            const parsed = new URL(normalizedUrl);
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
            console.error('[_lib_db] Failed to parse DATABASE_URL, falling back to individual env vars:', error.message);
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

function normalizeConnectionString(connectionString) {
    let normalized = connectionString.includes('://')
        ? connectionString
        : `postgresql://${connectionString}`;

    normalized = normalized.trim();

    normalized = normalized.replace(
        /(:\/\/[^@/]+):\[([^\]]+)\]@/,
        (_, prefix, password) => `${prefix}:${password}@`
    );

    return encodeAuthCredentials(normalized);
}

function encodeAuthCredentials(url) {
    const schemeIndex = url.indexOf('://');
    if (schemeIndex === -1) {
        return url;
    }

    const authStart = schemeIndex + 3;
    const atIndex = url.indexOf('@', authStart);
    if (atIndex === -1) {
        return url;
    }

    const auth = url.slice(authStart, atIndex);
    if (!auth) {
        return url;
    }

    const colonIndex = auth.indexOf(':');
    let username = auth;
    let password = null;

    if (colonIndex !== -1) {
        username = auth.slice(0, colonIndex);
        password = auth.slice(colonIndex + 1);
    }

    const encodedUser = encodeURIComponent(safeDecodeURIComponent(username));
    let newAuth = encodedUser;

    if (password !== null) {
        const encodedPass = encodeURIComponent(safeDecodeURIComponent(password));
        newAuth += `:${encodedPass}`;
    }

    return `${url.slice(0, authStart)}${newAuth}${url.slice(atIndex)}`;
}

function safeDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
}

function getPool() {
    if (!pool) {
        const config = buildPoolConfig();

        console.log('[_lib_db] Creating DB pool with:', {
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

async function query(text, params) {
    const client = await getPool().connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release();
    }
}

async function transact(callback) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[_lib_db] Failed to rollback transaction:', rollbackError);
        }
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    getPool,
    query,
    transact,
    normalizeConnectionString,
};
