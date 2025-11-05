const WebSocket = require('ws');
const { query: dbQuery } = require('./_lib_db');

// Map для хранения соединений по userId
const connections = new Map();

// Map для отслеживания WebSocket сервера
let wss = null;

function broadcastToUser(userId, message) {
    const connection = connections.get(userId);
    if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
    }
}

function broadcastToAll(message) {
    for (const [userId, connection] of connections) {
        if (connection.readyState === WebSocket.OPEN) {
            connection.send(JSON.stringify(message));
        }
    }
}

async function initializeWebSocketServer(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', async (ws, req) => {
        // Извлекаем userId из query параметра (для аутентификации)
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const userId = urlParams.get('userId');
        
        if (!userId) {
            ws.close(4001, 'userId is required');
            return;
        }

        // Проверяем, что пользователь существует
        try {
            const result = await dbQuery('SELECT id FROM clients WHERE id = $1', [userId]);
            if (result.rowCount === 0) {
                ws.close(4003, 'User not found');
                return;
            }
        } catch (error) {
            console.error('WebSocket auth error:', error);
            ws.close(4003, 'Authentication failed');
            return;
        }

        // Сохраняем соединение
        connections.set(userId, ws);
        console.log(`WebSocket connection established for user ${userId}`);

        // Отправляем приветственное сообщение
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to PRIZMATIC WebSocket server',
            userId
        }));

        // Обработка сообщений от клиента
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`Received from user ${userId}:`, data);
                
                // Здесь можно обрабатывать сообщения от клиента
                switch (data.type) {
                    case 'ping':
                        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                        break;
                    // Добавьте другие типы сообщений по необходимости
                    default:
                        // Отправляем подтверждение получения
                        ws.send(JSON.stringify({ type: 'ack', messageId: data.id }));
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        // Обработка закрытия соединения
        ws.on('close', (code, reason) => {
            connections.delete(userId);
            console.log(`WebSocket connection closed for user ${userId}, code: ${code}, reason: ${reason}`);
        });

        // Обработка ошибок
        ws.on('error', (error) => {
            console.error(`WebSocket error for user ${userId}:`, error);
            connections.delete(userId);
        });
    });

    wss.on('error', (error) => {
        console.error('WebSocket Server error:', error);
    });

    console.log('WebSocket server initialized');
}

// Функция для отправки обновления статуса аренды пользователю
function notifyRentalStatusChange(userId, rentalId, newStatus, rentalData = null) {
    const message = {
        type: 'rental_status_change',
        rentalId,
        status: newStatus,
        timestamp: Date.now(),
        rental: rentalData
    };
    
    broadcastToUser(userId, message);
}

// Функция для отправки уведомления пользователю
function notifyUser(userId, notificationType, data) {
    const message = {
        type: 'notification',
        notificationType,
        data,
        timestamp: Date.now()
    };
    
    broadcastToUser(userId, message);
}

// Функция для обновления баланса
function notifyBalanceUpdate(userId, newBalance) {
    const message = {
        type: 'balance_update',
        balance: newBalance,
        timestamp: Date.now()
    };
    
    broadcastToUser(userId, message);
}

// Функция для обновления аренды
function notifyRentalUpdate(userId, rental) {
    const message = {
        type: 'rental_update',
        rental,
        timestamp: Date.now()
    };
    
    broadcastToUser(userId, message);
}

module.exports = {
    initializeWebSocketServer,
    broadcastToUser,
    broadcastToAll,
    notifyRentalStatusChange,
    notifyUser,
    notifyBalanceUpdate,
    notifyRentalUpdate,
    connections
};