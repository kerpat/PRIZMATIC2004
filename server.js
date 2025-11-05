const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();

// Инициализация WebSocket сервера
const { initializeWebSocketServer, notifyRentalStatusChange, notifyBalanceUpdate, notifyRentalUpdate } = require('./api/websocket');

// Импортируем обработчики API
const router = require('./api/router');

const app = express();
const server = http.createServer(app);

// Инициализируем WebSocket сервер
initializeWebSocketServer(server);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Обработка статических файлов из директории site
app.use(express.static(path.join(__dirname, 'site')));

// API маршруты
app.use('/api', (req, res) => {
    // Проксируем запрос в существующий роутер
    router(req, res);
});

// Обработка корневого маршрута
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'site', 'index.html'));
});

// Другие маршруты
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'site', 'profile.html'));
});

app.get('/stats', (req, res) => {
    res.sendFile(path.join(__dirname, 'site', 'stats.html'));
});

app.get('/map', (req, res) => {
    res.sendFile(path.join(__dirname, 'site', 'map.html'));
});

app.get('/registration', (req, res) => {
    res.sendFile(path.join(__dirname, 'site', 'registration.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`PRIZMATIC Real-time Server запущен на порту ${PORT}`);
    console.log(`WebSocket сервер активен`);
    console.log(`Доступные маршруты:`);
    console.log(`  - HTTP: http://localhost:${PORT}`);
    console.log(`  - WebSocket: ws://localhost:${PORT}/websocket?userId=XXX`);
});

// Экспортируем функции уведомлений для использования в других частях приложения
module.exports = {
    notifyRentalStatusChange,
    notifyBalanceUpdate,
    notifyRentalUpdate
};