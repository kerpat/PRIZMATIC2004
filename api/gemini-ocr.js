
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Busboy = require('busboy');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        if (!process.env.GEMINI_API_KEY) {
            console.log('GEMINI_API_KEY not set, skipping OCR');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.status(200).send('{"error": "API key not configured"}');
            return;
        }

        // Parse multipart form data
        const busboy = Busboy({ headers: req.headers });
        let prompt = '';
        const files = [];
        let fileBuffers = [];

        busboy.on('field', (fieldname, val) => {
            if (fieldname === 'prompt') {
                prompt = val;
            }
        });

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            const chunks = [];
            file.on('data', (chunk) => {
                chunks.push(chunk);
            });
            file.on('end', () => {
                // Handle both old and new Busboy API formats
                let actualFilename = filename;
                let actualMimetype = mimetype;

                // If filename is an object (new Busboy API), extract properties
                if (typeof filename === 'object' && filename !== null) {
                    actualFilename = filename.filename || filename.name || '';
                    actualMimetype = filename.mimeType || filename.type || mimetype;
                }

                let finalMimetype = actualMimetype;

                // Fallback for mimetype if not provided by browser
                if ((!finalMimetype || finalMimetype === 'application/octet-stream') && typeof actualFilename === 'string' && actualFilename.length > 0) {
                    const ext = actualFilename.split('.').pop().toLowerCase();
                    const mimeTypes = {
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'png': 'image/png',
                        'gif': 'image/gif',
                        'webp': 'image/webp',
                        'pdf': 'application/pdf'
                    };
                    finalMimetype = mimeTypes[ext] || 'image/jpeg'; // Default to image/jpeg for unknown types
                }

                // Final safeguard - never send application/octet-stream to Gemini
                if (finalMimetype === 'application/octet-stream') {
                    finalMimetype = 'image/jpeg';
                }

                files.push({
                    buffer: Buffer.concat(chunks),
                    mimetype: finalMimetype,
                    filename: actualFilename
                });
            });
        });

        busboy.on('finish', async () => {
            try {
                if (!prompt || files.length === 0) {
                    res.status(400).json({ error: 'Request must contain a "prompt" field and at least one file.' });
                    return;
                }

                // Convert files to Gemini format
                const imageParts = files.map(file => ({
                    inlineData: {
                        data: file.buffer.toString('base64'),
                        mimeType: file.mimetype
                    }
                }));

                // Check file sizes - Gemini has limits
                const totalSize = files.reduce((sum, file) => sum + file.buffer.length, 0);
                if (totalSize > 20 * 1024 * 1024) { // 20MB limit
                    res.status(400).json({ error: 'Total file size exceeds 20MB limit.' });
                    return;
                }

                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

                console.log('Sending to Gemini:', {
                    prompt: prompt.substring(0, 100) + '...',
                    fileCount: imageParts.length,
                    fileTypes: imageParts.map(p => p.inlineData.mimeType),
                    totalSize: totalSize,
                    files: files.map(f => ({ filename: f.filename, mimetype: f.mimetype }))
                });

                try {
                    const result = await model.generateContent([prompt, ...imageParts]);
                    const response = await result.response;
                    const text = response.text();

                    console.log('Gemini response:', text.substring(0, 200) + '...');

                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.status(200).send(text);
                } catch (geminiError) {
                    console.error('Gemini API error:', geminiError);
                    // Return a fallback response that indicates OCR failed
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.status(200).send('{"error": "OCR processing failed"}');
                }
            } catch (error) {
                console.error('Error processing Gemini request:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to process the request with the Gemini API.', details: error.message });
                }
            }
        });

        req.pipe(busboy);
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Failed to process the request with the Gemini API.', details: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
