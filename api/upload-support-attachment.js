<<<<<<< HEAD

const { createClient } = require('@supabase/supabase-js');
=======
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
const Busboy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');

<<<<<<< HEAD
function createSupabaseAdmin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service credentials are not configured.');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
=======
const { saveBuffer } = require('./_lib_storage_backend');
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4

function parseMultipartForm(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        const files = [];

        busboy.on('file', (fieldname, file, info) => {
            const { filename, encoding, mimeType } = info;
            const safeName = filename || `upload-${Date.now()}`;
            const filepath = path.join(os.tmpdir(), safeName);
            const writeStream = fs.createWriteStream(filepath);
            file.pipe(writeStream);

            file.on('end', () => {
                files.push({
                    fieldname,
                    filename: safeName,
                    encoding,
                    mimetype: mimeType,
                    filepath,
                });
            });

            file.on('error', reject);
        });

        busboy.on('field', (fieldname, value) => {
            fields[fieldname] = value;
        });

        let resolved = false;
        const finalize = () => {
            if (resolved) return;
            resolved = true;
            resolve({ fields, files });
        };

        busboy.on('close', finalize);
        busboy.on('finish', finalize);
        busboy.on('error', reject);
        req.on('error', reject);

        req.pipe(busboy);
    });
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const { fields, files } = await parseMultipartForm(req);

        if (!files || !files.length) {
            res.status(400).json({ error: 'No file uploaded.' });
            return;
        }

        const file = files[0];
        const { anonymousChatId, clientId } = fields;

        if (!anonymousChatId && !clientId) {
            res.status(400).json({ error: 'anonymousChatId or clientId is required.' });
            return;
        }

<<<<<<< HEAD
        const supabaseAdmin = createSupabaseAdmin();
        const bucketName = 'support_attachments';
        const destinationPath = `${clientId || anonymousChatId}/${Date.now()}-${file.filename}`;
=======
>>>>>>> d4306959aa221b0eb872970fe06d8d9816de1ea4
        const fileBuffer = fs.readFileSync(file.filepath);

        const stored = await saveBuffer({
            bucket: 'support',
            buffer: fileBuffer,
            mimeType: file.mimetype,
            userId: clientId || anonymousChatId || 'anonymous',
            prefix: file.fieldname || 'attachment',
            originalName: file.filename,
        });

        fs.unlink(file.filepath, (unlinkErr) => {
            if (unlinkErr) {
                console.warn('[upload-support-attachment] Failed to remove temporary upload:', unlinkErr.message);
            }
        });

        res.status(200).json({
            message: 'File uploaded successfully.',
            publicUrl: stored.publicUrl,
            path: stored.path,
            fileType: file.mimetype,
        });
    } catch (error) {
        console.error('[upload-support-attachment] Handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
module.exports.default = handler;
module.exports.config = { api: { bodyParser: false } };
