/**
 * 🔧 Payment Helper - Открывает оплату БЕЗ выкидывания из приложения
 * Использует нативный PaymentBrowser для Android
 */

function log(message, data = null) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    if (data) {
        console.log(`[${timestamp}] [PaymentHelper] ${message}`, data);
    } else {
        console.log(`[${timestamp}] [PaymentHelper] ${message}`);
    }
}

function error(message, data = null) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    if (data) {
        console.error(`[${timestamp}] [PaymentHelper] ❌ ${message}`, data);
    } else {
        console.error(`[${timestamp}] [PaymentHelper] ❌ ${message}`);
    }
}

function isNativeApp() {
    const result = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    log(`isNativeApp check: ${result}`);
    return result;
}

function checkEnvironment() {
    const env = {
        hasWindow: typeof window !== 'undefined',
        hasCapacitor: !!window.Capacitor,
        isNativePlatform: window.Capacitor ? window.Capacitor.isNativePlatform() : false,
        hasPlugins: !!(window.Capacitor && window.Capacitor.Plugins),
        availablePlugins: window.Capacitor && window.Capacitor.Plugins ? Object.keys(window.Capacitor.Plugins) : [],
        hasPaymentBrowser: !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PaymentBrowser),
        userAgent: navigator.userAgent
    };
    
    log('🔍 Environment check:', env);
    return env;
}

export async function openPaymentUrl(url) {
    log('═══════════════════════════════════════');
    log('🚀 openPaymentUrl вызван');
    log('📍 URL:', url);
    
    if (!url) {
        error('URL не указан!');
        return;
    }

    // Проверяем окружение
    const env = checkEnvironment();

    try {
        if (isNativeApp()) {
            log('✅ Обнаружено нативное приложение');
            
            // Проверяем наличие Capacitor
            if (!window.Capacitor) {
                error('window.Capacitor не найден!');
                log('🔄 Fallback на window.location');
                window.location.href = url;
                return;
            }
            
            log('✅ window.Capacitor найден');
            
            // Проверяем наличие Plugins
            if (!window.Capacitor.Plugins) {
                error('window.Capacitor.Plugins не найден!');
                log('🔄 Fallback на window.location');
                window.location.href = url;
                return;
            }
            
            log('✅ window.Capacitor.Plugins найден');
            log('📦 Доступные плагины:', Object.keys(window.Capacitor.Plugins));
            
            // Проверяем наличие PaymentBrowser
            if (!window.Capacitor.Plugins.PaymentBrowser) {
                error('PaymentBrowser плагин не найден!');
                log('🔄 Fallback на window.location');
                window.location.href = url;
                return;
            }
            
            log('✅ PaymentBrowser плагин найден!');
            
            // Проверяем метод open
            if (typeof window.Capacitor.Plugins.PaymentBrowser.open !== 'function') {
                error('PaymentBrowser.open не является функцией!', {
                    type: typeof window.Capacitor.Plugins.PaymentBrowser.open,
                    value: window.Capacitor.Plugins.PaymentBrowser.open
                });
                log('🔄 Fallback на window.location');
                window.location.href = url;
                return;
            }
            
            log('✅ PaymentBrowser.open готов к вызову');
            log('🎯 Вызываем PaymentBrowser.open...');
            
            const result = await window.Capacitor.Plugins.PaymentBrowser.open({ url: url });
            
            log('✅ PaymentBrowser.open успешно вызван!', result);
            log('═══════════════════════════════════════');
            return;
            
        } else {
            log('ℹ️ Web окружение (не нативное приложение)');
            log('🔄 Используем window.location');
            window.location.href = url;
            log('═══════════════════════════════════════');
        }
        
    } catch (err) {
        error('Исключение при открытии платежа:', {
            message: err.message,
            stack: err.stack,
            name: err.name
        });
        log('🔄 Final fallback на window.location');
        window.location.href = url;
        log('═══════════════════════════════════════');
    }
}

export async function openSaveCardUrl(url) {
    log('💳 openSaveCardUrl вызван (перенаправление на openPaymentUrl)');
    return openPaymentUrl(url);
}

export async function closePaymentBrowser() {
    log('🔒 closePaymentBrowser вызван (Activity закроется автоматически)');
}

// Экспортируем для отладки
if (typeof window !== 'undefined') {
    window.PaymentHelper = {
        openPaymentUrl,
        openSaveCardUrl,
        closePaymentBrowser,
        isNativeApp,
        checkEnvironment,
        getDebugInfo: () => {
            const info = {
                isNativeApp: isNativeApp(),
                hasCapacitor: !!window.Capacitor,
                hasPlugins: !!(window.Capacitor && window.Capacitor.Plugins),
                hasPaymentBrowser: !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PaymentBrowser),
                availablePlugins: window.Capacitor && window.Capacitor.Plugins ? Object.keys(window.Capacitor.Plugins) : []
            };
            log('📊 Debug Info:', info);
            return info;
        }
    };
    
    // Выводим начальную информацию
    log('🎬 PaymentHelper инициализирован');
    checkEnvironment();
}
