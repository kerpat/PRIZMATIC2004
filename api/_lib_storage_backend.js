const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'filesystem';
const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/prizmatic-storage';
const STORAGE_URL = process.env.STORAGE_URL || '';

let minioClient = null;
let minioReadyPromise = null;

if (STORAGE_TYPE === 'minio') {
    const Minio = require('minio');
    minioClient = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
        secretKey: process.env.MINIO_SECRET_KEY || 'password',
    });

    const buckets = ['passports', 'documents', 'support'];
    minioReadyPromise = Promise.all(
        buckets.map(async (bucket) => {
            try {
                const exists = await minioClient.bucketExists(bucket);
                if (!exists) {
                    await minioClient.makeBucket(bucket, '');
                }
            } catch (error) {
                console.warn(`[_lib_storage_backend] Failed to verify bucket ${bucket}:`, error.message);
            }
        })
    ).catch((error) => {
        console.error('[_lib_storage_backend] Failed to initialize Minio buckets:', error);
    });
}

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function sanitizeFilenamePart(part) {
    if (!part) return '';
    return String(part)
        .normalize('NFKD')
        .replace(/[^\w.-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 60);
}

function inferExtension(mimeType, fallback = 'bin') {
    if (!mimeType) return fallback;
    const mapping = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'application/pdf': 'pdf',
        'video/mp4': 'mp4',
    };
    return mapping[mimeType] || fallback;
}

function getPublicUrl(bucket, object) {
    if (!STORAGE_URL) {
        return null;
    }
    const base = STORAGE_URL.endsWith('/') ? STORAGE_URL.slice(0, -1) : STORAGE_URL;
    return `${base}/${bucket}/${object}`;
}

async function saveBuffer({
    bucket = 'passports',
    buffer,
    mimeType,
    userId,
    prefix,
    originalName,
}) {
    if (!buffer || !(buffer instanceof Buffer)) {
        throw new Error('saveBuffer expects a Buffer.');
    }

    const extension = inferExtension(mimeType, path.extname(originalName || '').replace('.', '') || 'bin');
    const parts = [
        sanitizeFilenamePart(userId) || 'anonymous',
        sanitizeFilenamePart(prefix),
        Date.now(),
        crypto.randomBytes(6).toString('hex'),
    ].filter(Boolean);

    const objectName = `${parts.join('_')}.${extension}`;
    const relativePath = objectName.includes('/') ? objectName : `${sanitizeFilenamePart(userId) || 'anonymous'}/${objectName}`;

    if (STORAGE_TYPE === 'filesystem') {
        const targetDir = path.join(STORAGE_PATH, bucket, path.dirname(relativePath));
        ensureDirectory(targetDir);

        const fullPath = path.join(STORAGE_PATH, bucket, relativePath);
        await fs.promises.writeFile(fullPath, buffer);

        return {
            bucket,
            object: relativePath,
            path: `${bucket}/${relativePath}`,
            mimeType,
            size: buffer.length,
            publicUrl: getPublicUrl(bucket, relativePath),
        };
    }

    if (minioClient) {
        if (minioReadyPromise) {
            await minioReadyPromise;
        }

        const objectPath = relativePath;
        await minioClient.putObject(bucket, objectPath, buffer, buffer.length, {
            'Content-Type': mimeType || 'application/octet-stream',
        });

        return {
            bucket,
            object: objectPath,
            path: `${bucket}/${objectPath}`,
            mimeType,
            size: buffer.length,
            publicUrl: getPublicUrl(bucket, objectPath),
        };
    }

    throw new Error('Storage is not configured. Set STORAGE_TYPE to "filesystem" or "minio".');
}

async function downloadToBuffer(bucket, objectPath) {
    if (!bucket || !objectPath) {
        throw new Error('downloadToBuffer requires bucket and objectPath.');
    }

    if (STORAGE_TYPE === 'filesystem') {
        const fullPath = path.join(STORAGE_PATH, bucket, objectPath);
        const buffer = await fs.promises.readFile(fullPath);
        const ext = path.extname(objectPath).slice(1);
        return { buffer, mimeType: inferMimeByExtension(ext) };
    }

    if (minioClient) {
        if (minioReadyPromise) {
            await minioReadyPromise;
        }
        const stream = await minioClient.getObject(bucket, objectPath);
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const ext = path.extname(objectPath).slice(1);
        return { buffer, mimeType: inferMimeByExtension(ext) };
    }

    throw new Error('Storage is not configured.');
}

function inferMimeByExtension(ext) {
    const mapping = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        pdf: 'application/pdf',
        mp4: 'video/mp4',
    };
    return mapping[ext?.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
    saveBuffer,
    downloadToBuffer,
};
