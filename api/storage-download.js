/**
 * API endpoint для скачивания файлов
 * Заменяет Supabase Storage download
 */

const fs = require('fs');
const path = require('path');

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'filesystem';
const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/prizmatic-storage';

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

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bucket, path: filePath } = req.query;

    if (!bucket || !filePath) {
      return res.status(400).json({ error: 'bucket and path are required' });
    }

    if (STORAGE_TYPE === 'filesystem') {
      const fullPath = path.join(STORAGE_PATH, bucket, filePath);

      // Проверка безопасности: файл должен быть внутри STORAGE_PATH
      const normalizedPath = path.normalize(fullPath);
      if (!normalizedPath.startsWith(STORAGE_PATH)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Проверяем существование файла
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Определяем MIME тип
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.pdf': 'application/pdf'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);

      // Отправляем файл
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);

    } else if (STORAGE_TYPE === 'minio') {
      // Скачиваем из Minio
      const stream = await minioClient.getObject(bucket, filePath);
      
      // Получаем метаданные для Content-Type
      const stat = await minioClient.statObject(bucket, filePath);
      res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);

      stream.pipe(res);
    }

  } catch (error) {
    console.error('Download error:', error);
    
    if (error.code === 'NoSuchKey' || error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to download file', 
      details: error.message 
    });
  }
};

