// API endpoint для мгновенных уведомлений через SSE
// Этот endpoint может быть вызван из других функций для отправки уведомлений

import { notifyUserUpdate } from './realtime.js';

export default async function handler(req, res) {
  // Проверяем секретный ключ
  const internalSecret = req.headers['x-internal-secret'];
  if (internalSecret !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, type, data } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ error: 'userId and type are required' });
    }

    // Отправляем уведомление пользователю через SSE, если он подключен
    notifyUserUpdate(userId, type, data || {});

    res.status(200).json({ success: true, message: 'Notification sent via SSE' });
  } catch (error) {
    console.error('SSE Notify API error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}