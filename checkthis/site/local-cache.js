/**
 * LocalCache - умное кэширование с TTL и fallback
 * Позволяет показывать данные мгновенно при повторном открытии
 */

class LocalCache {
    constructor(prefix = 'app_cache_') {
        this.prefix = prefix;
        this.defaultTTL = 5 * 60 * 1000; // 5 минут
    }

    /**
     * Сохранить данные в кэш
     */
    set(key, data, ttl = this.defaultTTL) {
        try {
            const item = {
                data,
                timestamp: Date.now(),
                ttl
            };
            localStorage.setItem(this.prefix + key, JSON.stringify(item));
            console.log(`[LocalCache] Saved: ${key}`);
        } catch (error) {
            console.error(`[LocalCache] Error saving ${key}:`, error);
        }
    }

    /**
     * Получить данные из кэша
     */
    get(key) {
        try {
            const itemStr = localStorage.getItem(this.prefix + key);
            if (!itemStr) return null;

            const item = JSON.parse(itemStr);
            const age = Date.now() - item.timestamp;

            // Если данные просрочены
            if (age > item.ttl) {
                console.log(`[LocalCache] Expired: ${key} (age: ${Math.round(age/1000)}s)`);
                this.delete(key);
                return null;
            }

            console.log(`[LocalCache] Hit: ${key} (age: ${Math.round(age/1000)}s)`);
            return item.data;

        } catch (error) {
            console.error(`[LocalCache] Error getting ${key}:`, error);
            return null;
        }
    }

    /**
     * Получить данные с fallback
     * Сначала пытается взять из кэша, если нет - загружает через callback
     */
    async getOrFetch(key, fetchCallback, ttl = this.defaultTTL) {
        // Пытаемся взять из кэша
        const cached = this.get(key);
        if (cached) {
            // Возвращаем кэшированные данные сразу
            // А в фоне обновляем кэш
            fetchCallback().then(freshData => {
                this.set(key, freshData, ttl);
            }).catch(err => {
                console.warn(`[LocalCache] Background refresh failed for ${key}:`, err);
            });

            return cached;
        }

        // Если кэша нет, загружаем
        try {
            const data = await fetchCallback();
            this.set(key, data, ttl);
            return data;
        } catch (error) {
            console.error(`[LocalCache] Fetch failed for ${key}:`, error);
            throw error;
        }
    }

    /**
     * Удалить из кэша
     */
    delete(key) {
        localStorage.removeItem(this.prefix + key);
        console.log(`[LocalCache] Deleted: ${key}`);
    }

    /**
     * Очистить весь кэш
     */
    clear() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
        console.log('[LocalCache] Cleared all cache');
    }

    /**
     * Получить размер кэша
     */
    getSize() {
        let size = 0;
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                size += localStorage.getItem(key).length;
            }
        });
        return Math.round(size / 1024); // KB
    }
}

// Создаём глобальный экземпляр
window.cache = new LocalCache();

console.log('[LocalCache] Initialized ✓ (Size:', window.cache.getSize(), 'KB)');
