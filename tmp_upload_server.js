import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import * as Minio from 'minio';

const minioClient = new Minio.Client({
    endPoint: '51.250.17.150',
    port: 9000,
    useSSL: false,
    accessKey: 'prizmatic',
    secretKey: 'OVEWUZGHAlUtLqGe+d4qnYbRZtC6+E7kaKFp2TCqsAE='
});

const BUCKET_NAME = 'passports';

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors({
    origin: 'https://prizmatic-2004.vercel.app',
    credentials: true
}));

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.post('/upload', upload.array('files', 5), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Файлы не получены' });
    }

    try {
        const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
        if (!bucketExists) {
            await minioClient.makeBucket(BUCKET_NAME, '');
        }

        const uploadPromises = req.files.map(file => {
            const ext = extname(file.originalname);
            const objectName = `${randomUUID()}${ext}`;

            const metaData = {
                'Content-Type': file.mimetype
            };

            return minioClient.putObject(BUCKET_NAME, objectName, file.buffer, metaData)
                .then(() => ({
                    url: `http://51.250.17.150:9000/${BUCKET_NAME}/${objectName}`,
                    originalName: file.originalname
                }));
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        res.json({ files: uploadedFiles });
    } catch (err) {
        console.error('MinIO upload error:', err);
        res.status(500).json({ error: 'Ошибка при загрузке файла в хранилище.', details: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Uploader running on port ${PORT}`);
});
