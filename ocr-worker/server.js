const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
const { query } = require('../api/_lib_db');

const checkInternalSecret = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// NEW: Generic function to download from any URL
async function downloadFromUrl(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    return {
      data: response.data,
      mimeType: response.headers['content-type']
    };
  } catch (error) {
    console.error(`Error downloading from URL ${url}:`, error.message);
    throw error;
  }
}

// Process OCR with Gemini (this function remains unchanged)
async function processWithGemini(files) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const parts = files.map(file => ({
      inlineData: {
        data: file.data.toString('base64'),
        mimeType: file.mimeType
      }
    }));

    const prompt = `
Супер-строгий промпт для OCR документов (РФ + СНГ)\n\nТы — высокоточный OCR/IE-эксперт по документам, удостоверяющим личность...`; // Keeping the new prompt

    const requestBody = { contents: [{ parts: [{ text: prompt }, ...parts] }] };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      requestBody,
      { headers: { 'Content-Type': 'application/json' }, timeout: 120000 }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
    return JSON.parse(cleaned);

  } catch (error) {
    console.error('Gemini OCR error:', error);
    throw error;
  }
}

// Main OCR processing endpoint - REWRITTEN
app.post('/process-document', checkInternalSecret, async (req, res) => {
  const startTime = Date.now();
  let currentStep = '';

  try {
    const { userId, files: filesToDownload } = req.body;
    console.log(`🔄 [${new Date().toISOString()}] НАЧАЛО ОБРАБОТКИ: userId=${userId}`);

    if (!userId || !filesToDownload || !Array.isArray(filesToDownload) || filesToDownload.length === 0) {
      return res.status(400).json({ error: 'Request must contain userId and a non-empty files array.' });
    }

    currentStep = 'Обновление статуса на processing_ocr';
    await query(
      'UPDATE clients SET verification_status = $1, ocr_started_at = NOW() WHERE id = $2',
      ['processing_ocr', userId]
    );
    console.log(`✅ [${new Date().toISOString()}] Статус обновлен на processing_ocr`);

    let files = [];
    currentStep = 'Скачивание файлов по прямым ссылкам';
    console.log(`📥 [${new Date().toISOString()}] ${currentStep}: ${filesToDownload.length} файлов`);

    for (const fileInfo of filesToDownload) {
        if (fileInfo.direct_url) {
            try {
                const fileData = await downloadFromUrl(fileInfo.direct_url);
                files.push({
                    data: Buffer.from(fileData.data),
                    mimeType: fileData.mimeType,
                    field: fileInfo.field
                });
                console.log(`✅ [${new Date().toISOString()}] Файл ${fileInfo.field} скачан успешно.`);
            } catch (error) {
                console.error(`❌ [${new Date().toISOString()}] ОШИБКА СКАЧИВАНИЯ ${fileInfo.field}:`, error.message);
            }
        }
    }

    if (files.length === 0) {
      throw new Error('No files could be downloaded from the provided URLs');
    }

    console.log(`📊 [${new Date().toISOString()}] УСПЕШНО СКАЧАНО ${files.length} ФАЙЛОВ ДЛЯ OCR`);

    currentStep = 'OCR обработка через Gemini';
    const ocrResult = await processWithGemini(files);
    console.log(`📋 [${new Date().toISOString()}] РЕЗУЛЬТАТЫ OCR:`, JSON.stringify(ocrResult, null, 2));

    currentStep = 'Сохранение результатов в базу данных';
    await query(
      'UPDATE clients SET verification_status = $1, recognized_data = $2::jsonb, ocr_completed_at = NOW() WHERE id = $3',
      ['ocr_complete', JSON.stringify(ocrResult), userId]
    );

    console.log(`🎉 [${new Date().toISOString()}] OCR ЗАВЕРШЕН УСПЕШНО для пользователя ${userId}`);
    res.json({ success: true, message: 'OCR processing completed' });

  } catch (error) {
    console.error(`💥 [${new Date().toISOString()}] OCR ОБРАБОТКА ПРОВАЛИЛАСЬ НА ШАГЕ: ${currentStep}`, error);
    if (req.body.userId) {
      await query(
        'UPDATE clients SET verification_status = $1, ocr_error = $2 WHERE id = $3',
        ['ocr_failed', `${currentStep}: ${error.message}`, req.body.userId]
      );
    }
    res.status(500).json({ error: 'OCR processing failed', step: currentStep, details: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

app.listen(PORT, () => console.log(`OCR Worker running on port ${PORT}`));
