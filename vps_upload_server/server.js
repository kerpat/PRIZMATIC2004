import express from "express";
import multer from "multer";
import cors from "cors";
import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";

const app = express();
const uploadDir = "/var/www/prismatic-uploads";
await fs.mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
});

app.use(cors({ origin: "https://prizmatic-2004.vercel.app", credentials: true }));

// Принимаем до 5 файлов в поле 'files'
app.post("/upload", upload.array("files", 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Файлы не получены" });
  }

  // Возвращаем массив с информацией о загруженных файлах
  const uploadedFiles = req.files.map(file => ({
    url: `https://prizmaticupliad.duckdns.org/${file.filename}`,
    originalName: file.originalname,
    fieldName: file.fieldname // fieldName будет 'files' для всех
  }));

  res.json({ files: uploadedFiles });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Uploader running on ${port}`));