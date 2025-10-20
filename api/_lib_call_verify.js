const axios = require('axios');

const SMS_RU_API_ID = process.env.SMS_RU_API_ID;

if (!SMS_RU_API_ID) {
    console.warn('SMS_RU_API_ID not configured');
}

/**
 * Initiate call verification
 * @param {string} phone - Phone number to verify
 */
async function initiateCallVerification(phone) {
    try {
        const response = await axios.get('https://sms.ru/callcheck/add', {
            params: {
                api_id: SMS_RU_API_ID,
                phone: phone,
                json: 1
            },
            timeout: 10000
        });

        const data = response.data;

        if (data.status !== 'OK') {
            throw new Error(data.status_text || 'Failed to initiate call verification');
        }

        return {
            check_id: data.check_id,
            call_phone: data.call_phone,
            call_phone_pretty: data.call_phone_pretty,
            call_phone_html: data.call_phone_html
        };

    } catch (error) {
        console.error('[Call Verify] Initiate error:', error);
        throw new Error('Failed to initiate call verification');
    }
}

/**
 * Check call verification status
 * @param {string} checkId - Check ID from initiate call
 */
async function checkCallStatus(checkId) {
    try {
        const response = await axios.get('https://sms.ru/callcheck/status', {
            params: {
                api_id: SMS_RU_API_ID,
                check_id: checkId,
                json: 1
            },
            timeout: 10000
        });

        const data = response.data;

        if (data.status !== 'OK') {
            throw new Error(data.status_text || 'Failed to check status');
        }

        return {
            check_status: data.check_status, // '400' = not verified, '401' = verified, '402' = expired
            check_status_text: data.check_status_text
        };

    } catch (error) {
        console.error('[Call Verify] Check status error:', error);
        throw new Error('Failed to check call status');
    }
}

async function handler(req, res) {
    try {
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
