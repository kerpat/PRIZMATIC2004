// SSE клиент для PRIZMATIC
class SSEClient {
  constructor(userId) {
    this.userId = userId;
    this.eventSource = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 3000;
    this.isConnected = false;
  }

  connect() {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      // Подключаемся к SSE endpoint с userId
      this.eventSource = new EventSource(`/api/realtime?userId=${this.userId}`);

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('SSE parse error:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.isConnected = false;
        
        // Пытаемся переподключиться
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Попытка переподключения SSE (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          
          setTimeout(() => {
            this.connect();
          }, this.reconnectInterval * this.reconnectAttempts);
        }
      };

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.dispatch('connected', { timestamp: Date.now() });
      };

    } catch (error) {
      console.error('Ошибка подключения SSE:', error);
      this.attemptReconnect();
    }
  }

  handleMessage(data) {
    console.log('Получено SSE сообщение:', data);
    
    // Обрабатываем различные типы сообщений
    switch (data.type) {
      case 'connected':
        this.dispatch('connected', data);
        break;
      case 'rental_update':
        this.dispatch('rental_update', data);
        break;
      case 'balance_update':
        this.dispatch('balance_update', data);
        break;
      case 'verification_update':
        this.dispatch('verification_update', data);
        break;
      case 'support_message':
        this.dispatch('support_message', data);
        break;
      case 'heartbeat':
        this.dispatch('heartbeat', data);
        break;
      default:
        this.dispatch('message', data);
    }
  }

  // Регистрация слушателя для определенного типа событий
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  // Удаление слушателя
  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const listeners = this.listeners.get(eventType);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Вызов всех слушателей для события
  dispatch(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Ошибка в обработчике события ${eventType}:`, error);
        }
      });
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Попытка переподключения SSE (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }

  isConnected() {
    return this.eventSource && this.eventSource.readyState === EventSource.OPEN;
  }
}

// Экспортируем для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SSEClient;
} else if (typeof window !== 'undefined') {
  window.SSEClient = SSEClient;
}
