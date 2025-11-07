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

function normalizePrefix(prefix = '') {
    return String(prefix || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

function assertWithinBase(baseDir, targetPath) {
    const normalizedBase = path.resolve(baseDir);
    const normalizedTarget = path.resolve(targetPath);
    if (!normalizedTarget.startsWith(normalizedBase)) {
        throw new Error('Access denied.');
    }
}

async function listFilesystemObjects(bucket, prefix) {
    const baseDir = path.join(STORAGE_PATH, bucket);
    const targetDir = prefix ? path.join(baseDir, prefix) : baseDir;
    assertWithinBase(baseDir, targetDir);

    try {
        const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            const fullPath = path.join(targetDir, entry.name);
            const stats = await fs.promises.stat(fullPath);
            files.push({
                name: entry.name,
                id: entry.name,
                path: normalizePrefix(prefix ? `${prefix}/${entry.name}` : entry.name),
                updated_at: stats.mtime.toISOString(),
                created_at: stats.birthtime.toISOString(),
                last_modified: stats.mtime.toISOString(),
                size: stats.size,
                metadata: null,
            });
        }
        return files;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

async function listMinioObjects(bucket, prefix) {
    if (minioReadyPromise) {
        await minioReadyPromise;
    }

    console.log(`[storage_backend] listMinioObjects: bucket="${bucket}", prefix="${prefix}"`);

    return new Promise((resolve, reject) => {
        const objects = [];
        const stream = minioClient.listObjectsV2(bucket, prefix || '', false);
        stream.on('data', (obj) => {
            if (obj.prefix) {
                console.log(`[storage_backend] Skipping prefix:`, obj.prefix);
                return;
            }
            console.log(`[storage_backend] Found object:`, obj.name);
            const name = path.basename(obj.name);
            objects.push({
                name,
                id: obj.name,
                path: obj.name,
                updated_at: obj.lastModified ? new Date(obj.lastModified).toISOString() : null,
                created_at: obj.lastModified ? new Date(obj.lastModified).toISOString() : null,
                last_modified: obj.lastModified ? new Date(obj.lastModified).toISOString() : null,
                size: obj.size,
                metadata: null,
            });
        });
        stream.on('error', (error) => {
            console.error('[storage_backend] MinIO stream error:', error);
            reject(error);
        });
        stream.on('end', () => {
            console.log(`[storage_backend] listMinioObjects: finished, total ${objects.length} objects`);
            resolve(objects);
        });
    });
}

async function listObjects({ bucket = 'passports', prefix = '' } = {}) {
    const normalizedPrefix = normalizePrefix(prefix);
    if (STORAGE_TYPE === 'filesystem') {
        return listFilesystemObjects(bucket, normalizedPrefix);
    }
    if (minioClient) {
        return listMinioObjects(bucket, normalizedPrefix);
    }
    throw new Error('Storage is not configured.');
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
    const sanitizedUserId = sanitizeFilenamePart(userId) || 'anonymous';
    const parts = [
        sanitizedUserId,
        sanitizeFilenamePart(prefix),
        Date.now(),
        crypto.randomBytes(6).toString('hex'),
    ].filter(Boolean);

    const objectName = `${parts.join('_')}.${extension}`;
    const relativePath = objectName.includes('/') ? objectName : `${sanitizedUserId}/${objectName}`;
    
    console.log(`[storage_backend] saveBuffer: userId="${userId}", sanitized="${sanitizedUserId}", prefix="${prefix}", path="${relativePath}"`);

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
        assertWithinBase(path.join(STORAGE_PATH, bucket), fullPath);
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
    listObjects,
};
