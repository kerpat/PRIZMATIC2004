const axios = require('axios');

const SMS_RU_API_ID = process.env.SMS_RU_API_ID;

console.log('[Call Verify] SMS_RU_API_ID configured:', !!SMS_RU_API_ID);

if (!SMS_RU_API_ID) {
    console.error('[Call Verify] SMS_RU_API_ID not configured! Set it in Vercel environment variables.');
}

/**
 * Initiate call verification
 * @param {string} phone - Phone number to verify
 */
async function initiateCallVerification(phone) {
    try {
        console.log('[Call Verify] Initiating call for phone:', phone);

        const response = await axios.get('https://sms.ru/callcheck/add', {
            params: {
                api_id: SMS_RU_API_ID,
                phone: phone,
                json: 1
            },
            timeout: 10000
        });

        const data = response.data;
        console.log('[Call Verify] SMS.ru response:', JSON.stringify(data));

        if (data.status !== 'OK') {
            console.error('[Call Verify] SMS.ru error:', data.status_text);
            throw new Error(data.status_text || 'Failed to initiate call verification');
        }

        console.log('[Call Verify] Call initiated successfully. Check ID:', data.check_id);

        return {
            check_id: data.check_id,
            call_phone: data.call_phone,
            call_phone_pretty: data.call_phone_pretty,
            call_phone_html: data.call_phone_html
        };

    } catch (error) {
        console.error('[Call Verify] Initiate error:', error.message);
        throw new Error('Failed to initiate call verification: ' + error.message);
    }
}

/**
 * Check call verification status
 * @param {string} checkId - Check ID from initiate call
 */
async function checkCallStatus(checkId) {
    try {
        console.log('[Call Verify] Checking status for check_id:', checkId);

        const response = await axios.get('https://sms.ru/callcheck/status', {
            params: {
                api_id: SMS_RU_API_ID,
                check_id: checkId,
                json: 1
            },
            timeout: 10000
        });

        const data = response.data;
        console.log('[Call Verify] Status response:', JSON.stringify(data));

        if (data.status !== 'OK') {
            console.error('[Call Verify] SMS.ru status error:', data.status_text);
            throw new Error(data.status_text || 'Failed to check status');
        }

        console.log('[Call Verify] Status:', data.check_status, data.check_status_text);

        return {
            check_status: data.check_status, // '400' = not verified, '401' = verified, '402' = expired
            check_status_text: data.check_status_text
        };

    } catch (error) {
        console.error('[Call Verify] Check status error:', error.message);
        throw new Error('Failed to check call status: ' + error.message);
    }
}

async function handler(req, res) {
    try {
        console.log('[Call Verify] Request received:', req.method, req.url);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, phone, check_id } = body;

        console.log('[Call Verify] Action:', action, 'Phone:', phone, 'Check ID:', check_id);

        if (action === 'initiate') {
            // Initiate call verification
            if (!phone) {
                return res.status(400).json({ error: 'Phone number is required' });
            }

            const result = await initiateCallVerification(phone);
            return res.status(200).json(result);

        } else if (action === 'check-status') {
            // Check verification status
            if (!check_id) {
                return res.status(400).json({ error: 'Check ID is required' });
            }

            const result = await checkCallStatus(check_id);
            return res.status(200).json(result);

        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

    } catch (error) {
        console.error('[Call Verify] Handler error:', error);
        return res.status(500).json({ error: error.message });
    }
}

module.exports = handler;
