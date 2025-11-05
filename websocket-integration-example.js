/**
 * Пример интеграции WebSocket уведомлений с вашим существующим сервером
 * 
 * Этот файл показывает, как можно добавить уведомления в ваш существующий код
 */

// В местах, где происходят изменения статуса аренды, добавьте вызовы уведомлений

// Пример: при изменении статуса аренды
function notifyRentalStatusChange(userId, rentalId, newStatus, rentalData = null) {
    // Отправить через вашу существующую систему уведомлений на вашем сервере
    // например, через HTTP запрос на ваш Яндекс.Облако сервер
    fetch('/api/notify-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId: userId,
            type: 'rental_status_change',
            data: {
                rentalId: rentalId,
                status: newStatus,
                rental: rentalData,
                timestamp: Date.now()
            }
        })
    }).catch(err => {
        console.error('Ошибка отправки уведомления:', err);
    });
}

// Пример: при обновлении баланса
function notifyBalanceUpdate(userId, newBalance) {
    fetch('/api/notify-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId: userId,
            type: 'balance_update',
            data: {
                balance: newBalance,
                timestamp: Date.now()
            }
        })
    }).catch(err => {
        console.error('Ошибка отправки уведомления:', err);
    });
}

// Пример: при создании или обновлении аренды
function notifyRentalUpdate(userId, rental) {
    fetch('/api/notify-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId: userId,
            type: 'rental_update',
            data: {
                rental: rental,
                timestamp: Date.now()
            }
        })
    }).catch(err => {
        console.error('Ошибка отправки уведомления:', err);
    });
}

// На вашем сервере на Яндекс.Облаке нужно реализовать endpoint /api/notify-user
// который будет отправлять сообщения в WebSocket клиентам

/*
Пример серверного кода (Node.js с WebSocket) на вашем Яндекс.Облаке сервере:

const WebSocket = require('ws');
const express = require('express');
const app = express();

app.use(express.json());

// WebSocket сервер
const wss = new WebSocket.Server({ port: 8080 });

// Хранилище соединений
const connections = new Map();

wss.on('connection', (ws, req) => {
    const userId = new URLSearchParams(req.url.split('?')[1]).get('userId');
    
    if (userId) {
        connections.set(userId, ws);
        console.log(`Клиент ${userId} подключился`);
        
        ws.on('close', () => {
            connections.delete(userId);
            console.log(`Клиент ${userId} отключился`);
        });
    }
});

// Endpoint для отправки уведомлений
app.post('/api/notify-user', (req, res) => {
    const { userId, type, data } = req.body;
    
    const client = connections.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, data, timestamp: Date.now() }));
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Client not connected' });
    }
});

app.listen(3001, '0.0.0.0', () => {
    console.log('Сервер уведомлений запущен на порту 3001');
});
*/

// Используйте эти функции в вашем существующем коде, например:
// - После обновления статуса аренды
// - После списания средств
// - После получения оплаты
// - После обновления документов и т.д.