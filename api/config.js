// API endpoint to serve configuration from environment variables (VPS mode)
export default function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/javascript');

    const config = {
<<<<<<< HEAD
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://avamqfmuhiwtlumjkzmv.supabase.co',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YW1xZm11aGl3dGx1bWprem12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjMyODcsImV4cCI6MjA3MjIzOTI4N30.EwEPM0pObAd3v_NXI89DLcgKVYrUiOn7iHuCXXaqU4I',
=======
        // Database (VPS PostgreSQL)
        DATABASE_URL: process.env.DATABASE_URL,
        DB_HOST: process.env.DB_HOST || '51.250.17.150',
        DB_PORT: process.env.DB_PORT || '5432',
        DB_NAME: process.env.DB_NAME || 'prizmatic',

        // Storage (Minio)
        STORAGE_URL: process.env.STORAGE_URL || 'http://51.250.17.150:9000',
        MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || '51.250.17.150',

        // API keys (пока оставляем для обратной совместимости)
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || 'AIzaSyCds0FmujbSW88GPJwXeyhIjD8JOdyx5uU',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyCds0FmujbSW88GPJwXeyhIjD8JOdyx5uU',
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8126548981:AAGC86ZaJ0SYLICC0WbpS7aGOhU9t8iz_a4',

        // Payments
        YOOKASSA_SHOP_ID: process.env.YOOKASSA_SHOP_ID || '1107459',
        YOOKASSA_SECRET_KEY: process.env.YOOKASSA_SECRET_KEY || 'live_oTnWf7sfV0ePngXm7eGdeoXewCYCbW2RXfn0PacBlrE',
<<<<<<< HEAD
        BOT_NOTIFY_URL: process.env.BOT_NOTIFY_URL || 'https://gogovorprizmatic.onrender.com/notify',
=======

        // Service URLs
        BOT_NOTIFY_URL: process.env.BOT_NOTIFY_URL || 'https://gemini-npxg.onrender.com/notify',
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
        OCR_WORKER_URL: process.env.OCR_WORKER_URL || 'https://832a1274ed7e.ngrok-free.app',
        CONTRACTS_API_URL: process.env.CONTRACTS_API_URL || 'https://gogovorprizmatic.onrender.com',

        // Secrets
        ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || 'your_super_secret_admin_key',
        INTERNAL_SECRET: process.env.INTERNAL_SECRET || 'MySuperSecretKeyForBikeAppOCR123!',
    };

    const payload = `window.CONFIG = ${JSON.stringify(config, null, 2)};`;
    res.status(200).send(payload);
}
