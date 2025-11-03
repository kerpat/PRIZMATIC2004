/**
 * API endpoint для загрузки файлов (замена Supabase Storage)
 * Работает с файловой системой VPS или Minio
 */

const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Выбор хранилища: 'filesystem' или 'minio'
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'filesystem';

// Для filesystem
const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/prizmatic-storage';
const STORAGE_URL = process.env.STORAGE_URL || 'https://your-domain.com/storage';

// Для Minio
let minioClient;
if (STORAGE_TYPE === 'minio') {
  const Minio = require('minio');
  minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'password'
  });
}

// Разрешенные типы файлов
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf'
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    keepExtensions: true
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: 'Upload failed', details: err.message });
    }

    try {
      const file = files.file;
      const bucket = fields.bucket || 'passports';
      const userId = fields.userId;

      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Проверка типа файла
      if (!ALLOWED_TYPES[file.mimetype]) {
        return res.status(400).json({ error: 'File type not allowed' });
      }

      // Генерируем уникальное имя файла
      const ext = ALLOWED_TYPES[file.mimetype];
      const filename = `${userId || 'unknown'}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
      const filePath = `${bucket}/${filename}`;

      if (STORAGE_TYPE === 'filesystem') {
        // Сохраняем в файловую систему
        const targetDir = path.join(STORAGE_PATH, bucket);
        const targetPath = path.join(targetDir, filename);

        // Создаем директорию если не существует
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Копируем файл
        fs.copyFileSync(file.filepath, targetPath);

        // Удаляем временный файл
        fs.unlinkSync(file.filepath);

        const publicUrl = `${STORAGE_URL}/${filePath}`;

        return res.status(200).json({
          success: true,
          path: filePath,
          publicUrl: publicUrl,
          size: file.size,
          type: file.mimetype
        });

      } else if (STORAGE_TYPE === 'minio') {
        // Загружаем в Minio
        const fileStream = fs.createReadStream(file.filepath);
        
        await minioClient.putObject(bucket, filename, fileStream, file.size, {
          'Content-Type': file.mimetype
        });

        // Удаляем временный файл
        fs.unlinkSync(file.filepath);

        // Генерируем presigned URL для доступа
        const publicUrl = await minioClient.presignedGetObject(bucket, filename, 24 * 60 * 60); // 24 часа

        return res.status(200).json({
          success: true,
          path: `${bucket}/${filename}`,
          publicUrl: publicUrl,
          size: file.size,
          type: file.mimetype
        });
      }

    } catch (error) {
      console.error('Storage error:', error);
      return res.status(500).json({ 
        error: 'Failed to save file', 
        details: error.message 
      });
    }
  });
};

