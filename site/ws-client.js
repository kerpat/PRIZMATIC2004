// Клиентский WebSocket модуль для PRIZMATIC

class WebSocketClient {
    constructor(userId, serverUrl = null) {
        this.userId = userId;
        this.serverUrl = serverUrl || this.getDefaultServerUrl();
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectInterval = 3000; // 3 секунды
        this.listeners = new Map();
        
        // Привязываем методы к экземпляру
        this.onMessage = this.onMessage.bind(this);
        this.onOpen = this.onOpen.bind(this);
        this.onClose = this.onClose.bind(this);
        this.onError = this.onError.bind(this);
    }
    
    getDefaultServerUrl() {
        // Подключаемся к VPS серверу на порту 8081, используя wss для HTTPS сайтов
        const url = new URL(window.location.href);
        const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//51.250.17.150:8081/websocket?userId=${this.userId}`;
    }
    
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return; // Уже подключено
        }
        
        try {
            console.log(`Попытка подключения к WebSocket: ${this.serverUrl}`);
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = this.onOpen;
            this.ws.onmessage = this.onMessage;
            this.ws.onclose = this.onClose;
            this.ws.onerror = this.onError;
        } catch (error) {
            console.error('Ошибка подключения к WebSocket:', error);
            this.attemptReconnect();
        }
    }
    
    onOpen(event) {
        console.log('WebSocket соединение установлено');
        this.reconnectAttempts = 0;
        this.dispatch('connected', { event });
    }
    
    onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('Получено сообщение от WebSocket:', data);
            
            // Обрабатываем различные типы сообщений
            switch (data.type) {
                case 'rental_status_change':
                    this.handleRentalStatusChange(data);
                    break;
                case 'balance_update':
                    this.handleBalanceUpdate(data);
                    break;
                case 'rental_update':
                    this.handleRentalUpdate(data);
                    break;
                case 'notification':
                    this.handleNotification(data);
                    break;
                case 'pong':
                    // Ответ на ping
                    break;
                case 'connected':
                    // Подтверждение подключения
                    break;
                default:
                    console.log('Неизвестный тип сообщения:', data.type);
            }
            
            // Вызываем все слушатели для этого типа
            if (this.listeners.has(data.type)) {
                this.listeners.get(data.type).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Ошибка в обработчике сообщения типа ${data.type}:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Ошибка обработки WebSocket сообщения:', error);
        }
    }
    
    onClose(event) {
        console.log('WebSocket соединение закрыто:', event.code, event.reason);
        this.dispatch('disconnected', { event });
        
        // Пытаемся переподключиться, если это не было намеренное отключение
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
        }
    }
    
    onError(event) {
        console.error('WebSocket ошибка:', event);
        this.dispatch('error', { event });
    }
    
    attemptReconnect() {
        this.reconnectAttempts++;
        console.log(`Попытка переподключения (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectInterval * this.reconnectAttempts); // экспоненциальная задержка
    }
    
    // Отправка ping для проверки соединения
    ping() {
        this.send({ type: 'ping', id: Date.now() });
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('Попытка отправить сообщение в закрытое WebSocket соединение');
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect'); // нормальное закрытие
        }
    }
    
    // Регистрация слушателя для определённого типа сообщений
    on(messageType, callback) {
        if (!this.listeners.has(messageType)) {
            this.listeners.set(messageType, []);
        }
        this.listeners.get(messageType).push(callback);
    }
    
    // Удаление слушателя
    off(messageType, callback) {
        if (this.listeners.has(messageType)) {
            const listeners = this.listeners.get(messageType);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    // Внутренний метод для отправки событий
    dispatch(eventType, data) {
        const event = new CustomEvent(`ws-${eventType}`, { detail: data });
        window.dispatchEvent(event);
    }
    
    // Обработчики специфических сообщений
    handleRentalStatusChange(data) {
        console.log('Обновление статуса аренды:', data);
        this.dispatch('rental-status-change', data);
    }
    
    handleBalanceUpdate(data) {
        console.log('Обновление баланса:', data);
        this.dispatch('balance-update', data);
    }
    
    handleRentalUpdate(data) {
        console.log('Обновление аренды:', data);
        this.dispatch('rental-update', data);
    }
    
    handleNotification(data) {
        console.log('Получено уведомление:', data);
        this.dispatch('notification', data);
    }
    
    // Методы для удобства
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    getConnectionStatus() {
        if (!this.ws) return 'disconnected';
        const status = this.ws.readyState;
        switch (status) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'open';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'closed';
            default: return 'unknown';
        }
    }
}

// Экспортируем WebSocketClient для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketClient;
} else if (typeof window !== 'undefined') {
    window.WebSocketClient = WebSocketClient;
}

// Пример использования:
/*
const wsClient = new WebSocketClient(userId);
wsClient.on('rental_status_change', (data) => {
    console.log('Статус аренды изменился:', data);
    // Обновляем UI
});
wsClient.connect();
*/