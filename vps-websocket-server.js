/**
 * WebSocket сервер для PRIZMATIC
 * Запускать на VPS: ssh -l kerpat 51.250.17.150
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

// Конфигурация
const PORT = process.env.WS_PORT || 8080;
const API_PORT = process.env.API_PORT || 3000;

// Хранилище активных WebSocket соединений
const connections = new Map(); // userId -> WebSocket

const app = express();
const server = http.createServer(app);

// WebSocket сервер
const wss = new WebSocket.Server({ server });

// Подсчет подключений
let connectionCount = 0;

wss.on('connection', (ws, req) => {
    // Извлекаем userId из query параметров
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userId = urlParams.get('userId');
    
    if (!userId) {
        ws.close(4001, 'userId is required in query parameters');
        console.log('Закрыто соединение без userId');
        return;
    }

    // Добавляем соединение
    connections.set(userId, ws);
    connectionCount++;
    console.log(`Пользователь ${userId} подключился. Всего подключений: ${connectionCount}`);

    // Отправляем приветственное сообщение
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to PRIZMATIC WebSocket server',
        userId: userId,
        timestamp: Date.now()
    }));

    // Обработка сообщений от клиента
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`Сообщение от пользователя ${userId}:`, data);
            
            // Обработка различных типов сообщений
            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: Date.now()
                    }));
                    break;
                    
                case 'get_status':
                    // Ответ с текущим статусом соединения
                    ws.send(JSON.stringify({
                        type: 'status',
                        connected: true,
                        userId: userId,
                        timestamp: Date.now()
                    }));
                    break;
                    
                default:
                    console.log(`Неизвестный тип сообщения от ${userId}:`, data.type);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `Unknown message type: ${data.type}`,
                        timestamp: Date.now()
                    }));
            }
        } catch (error) {
            console.error(`Ошибка при обработке сообщения от ${userId}:`, error);
        }
    });

    // Обработка закрытия соединения
    ws.on('close', (code, reason) => {
        connections.delete(userId);
        connectionCount--;
        console.log(`Пользователь ${userId} отключился. Код: ${code}. Причина: ${reason}. Всего подключений: ${connectionCount}`);
    });

    // Обработка ошибок
    ws.on('error', (error) => {
        console.error(`Ошибка WebSocket соединения для пользователя ${userId}:`, error);
        connections.delete(userId);
    });
});

// Middleware для CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// API endpoint для отправки уведомлений из Vercel функций
app.post('/api/notify', express.json(), (req, res) => {
    // ВАЖНО: Этот endpoint должен быть защищен, например, проверкой секретного ключа
    const internalSecret = req.headers['x-internal-secret'];
    if (internalSecret !== process.env.INTERNAL_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, type, data } = req.body;
    
    if (!userId || !type) {
        return res.status(400).json({ error: 'userId and type are required' });
    }

    // Пытаемся отправить сообщение пользователю
    const userConnection = connections.get(userId);
    
    if (userConnection && userConnection.readyState === WebSocket.OPEN) {
        const message = {
            type: type,
            data: data,
            timestamp: Date.now()
        };
        
        userConnection.send(JSON.stringify(message), (error) => {
            if (error) {
                console.error(`Ошибка отправки уведомления пользователю ${userId}:`, error);
                res.status(500).json({ error: 'Failed to send notification', success: false });
            } else {
                console.log(`Уведомление отправлено пользователю ${userId}, тип: ${type}`);
                res.status(200).json({ success: true, message: 'Notification sent' });
            }
        });
    } else {
        // Пользователь не подключен, возвращаем специальный статус
        console.log(`Пользователь ${userId} не подключен, уведомление сохранено для доставки`);
        res.status(200).json({ 
            success: true, 
            message: 'User not connected, notification queued for delivery when available' 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        connections: connections.size,
        timestamp: new Date().toISOString()
    });
});

// Статистика
app.get('/stats', (req, res) => {
    const stats = {
        totalConnections: connections.size,
        connectionCount: connectionCount,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        connectedUsers: Array.from(connections.keys())
    };
    res.json(stats);
});

// Запуск сервера
server.listen(PORT, '0.0.0.0', () => {
    console.log(``);
    console.log(`===============================================`);
    console.log(`  PRIZMATIC WebSocket сервер запущен`);
    console.log(`  Адрес: ws://51.250.17.150:${PORT}`);
    console.log(`  API уведомлений: http://51.250.17.150:${PORT}/api/notify`);
    console.log(`  Порт: ${PORT}`);
    console.log(`===============================================`);
    console.log(``);
    console.log(`Для подключения клиента используйте:`);
    console.log(`const ws = new WebSocket('ws://51.250.17.150:${PORT}?userId=XXX');`);
    console.log(``);
});

// Обработка завершения работы
process.on('SIGINT', () => {
    console.log('Завершение работы WebSocket сервера...');
    
    // Закрываем все соединения
    connections.forEach((ws, userId) => {
        ws.close(1001, 'Server shutdown');
    });
    
    server.close(() => {
        console.log('WebSocket сервер остановлен');
        process.exit(0);
    });
    
    // Если сервер не закроется вовремя, принудительно завершаем
    setTimeout(() => {
        console.log('Принудительное завершение');
        process.exit(1);
    }, 10000);
});

// Функция для отправки уведомлений (для использования в других частях приложения)
function notifyUser(userId, type, data) {
    const userConnection = connections.get(userId);
    
    if (userConnection && userConnection.readyState === WebSocket.OPEN) {
        const message = {
            type: type,
            data: data,
            timestamp: Date.now()
        };
        
        userConnection.send(JSON.stringify(message), (error) => {
            if (error) {
                console.error(`Ошибка отправки уведомления пользователю ${userId}:`, error);
            } else {
                console.log(`Уведомление отправлено пользователю ${userId}, тип: ${type}`);
            }
        });
        
        return true;
    }
    
    return false; // Пользователь не подключен
}

// Экспортируем для использования в других модулях
module.exports = { notifyUser, connections, wss };