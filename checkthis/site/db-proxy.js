/**
 * DB Proxy - замена Supabase SDK на фронте
 * Все запросы идут через наш API вместо прямых запросов к Supabase
 * Экономия: ~120KB + ~300-800ms времени загрузки
 */

class DBProxy {
    constructor(apiBaseUrl = '/api') {
        this.apiBaseUrl = apiBaseUrl;
        this.cache = new Map();
        this.cacheTTL = 30000; // 30 секунд
    }

    /**
     * Универсальный метод для запросов
     */
    async request(action, params = {}) {
        const cacheKey = `${action}:${JSON.stringify(params)}`;

        // Проверяем кэш
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                console.log(`[DBProxy] Cache HIT for ${action}`);
                return cached.data;
            }
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...params })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Сохраняем в кэш
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`[DBProxy] Error in ${action}:`, error);
            throw error;
        }
    }

    /**
     * Получить данные клиента
     */
    async getClient(userId) {
        return this.request('get-client', { userId });
    }

    /**
     * Получить активную аренду
     */
    async getActiveRental(userId) {
        return this.request('get-active-rental', { userId });
    }

    /**
     * Получить активное бронирование
     */
    async getActiveBooking(userId) {
        return this.request('get-active-booking', { userId });
    }

    /**
     * Получить доступные велосипеды по городу
     */
    async getAvailableBikes(city) {
        return this.request('get-available-bikes', { city });
    }

    /**
     * Получить список тарифов
     */
    async getTariffs(activeOnly = true) {
        return this.request('get-tariffs', { activeOnly });
    }

    async getPaymentsRange(params = {}) {
        return this.request('get-payments-range', params);
    }

    /**
     * Обновить баланс клиента (только для админки)
     */
    async updateBalance(userId, amount) {
        this.clearCache(); // Сбрасываем кэш после изменения
        return this.request('update-balance', { userId, amount });
    }

    /**
     * Очистить кэш
     */
    clearCache(pattern = null) {
        if (!pattern) {
            this.cache.clear();
            console.log('[DBProxy] Cache cleared');
        } else {
            const keys = Array.from(this.cache.keys());
            keys.forEach(key => {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            });
            console.log(`[DBProxy] Cache cleared for pattern: ${pattern}`);
        }
    }
}

// Создаём глобальный экземпляр
window.db = new DBProxy();

console.log('[DBProxy] Initialized ✓');
