/**
 * 🔧 Payment Helper - Открывает оплату БЕЗ выкидывания из приложения
 * Использует InAppBrowser через Capacitor для полного контроля над всеми редиректами
 */

function isNativeApp() {
    return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
}

// Получаем InAppBrowser из правильного места
function getInAppBrowser() {
    // Вариант 1: Через глобальный cordova объект
    if (window.cordova && window.cordova.InAppBrowser) {
        return window.cordova.InAppBrowser;
    }
    
    // Вариант 2: Через Capacitor Plugins
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InAppBrowser) {
        return window.Capacitor.Plugins.InAppBrowser;
    }
    
    // Вариант 3: Глобальный window.open с InAppBrowser
    // После установки плагина window.open перезаписывается
    return null;
}

export async function openPaymentUrl(url) {
    if (!url) {
        console.error('[PaymentHelper] URL не указан');
        return;
    }

    console.log('[PaymentHelper] Открытие платежа:', { 
        url, 
        isNativeApp: isNativeApp(),
        hasCordova: !!window.cordova,
        hasInAppBrowser: !!getInAppBrowser()
    });

    try {
        if (isNativeApp()) {
            const InAppBrowser = getInAppBrowser();
            
            // Используем InAppBrowser если доступен
            if (InAppBrowser) {
                console.log('[PaymentHelper] Используем InAppBrowser');
                
                const options = 'location=yes,hideurlbar=no,toolbarcolor=#2d6a4f,closebuttoncaption=Закрыть,hidenavigationbuttons=no,clearcache=yes,clearsessioncache=yes,shouldPauseOnSuspend=no';
                
                const browserRef = InAppBrowser.open(url, '_blank', options);
                
                if (browserRef) {
                    browserRef.addEventListener('exit', () => {
                        console.log('[PaymentHelper] InAppBrowser закрыт');
                        window.location.reload();
                    });
                    
                    browserRef.addEventListener('loadstart', (event) => {
                        console.log('[PaymentHelper] Загрузка:', event.url);
                        
                        // Автозакрытие при возврате
                        if (event.url && (
                            event.url.includes('payment-return') || 
                            event.url.includes('prizmatic://') ||
                            event.url.includes('prizmatic-2004.vercel.app')
                        )) {
                            console.log('[PaymentHelper] Возврат обнаружен, закрываем');
                            setTimeout(() => browserRef.close(), 1000);
                        }
                    });
                }
                
                return;
            }
            
            // Fallback: используем перезаписанный window.open (если InAppBrowser установлен)
            // После установки плагина window.open автоматически становится InAppBrowser
            console.log('[PaymentHelper] Используем window.open (InAppBrowser fallback)');
            
            const browserRef = window.open(
                url, 
                '_blank', 
                'location=yes,hideurlbar=no,toolbarcolor=#2d6a4f,closebuttoncaption=Закрыть,hidenavigationbuttons=no,clearcache=yes,clearsessioncache=yes'
            );
            
            if (browserRef) {
                // Пытаемся добавить слушатели если доступны
                if (typeof browserRef.addEventListener === 'function') {
                    browserRef.addEventListener('exit', () => {
                        console.log('[PaymentHelper] Браузер закрыт');
                        window.location.reload();
                    });
                    
                    browserRef.addEventListener('loadstart', (event) => {
                        if (event.url && (event.url.includes('payment-return') || event.url.includes('prizmatic'))) {
                            setTimeout(() => browserRef.close(), 1000);
                        }
                    });
                }
            }
        } else {
            // Web версия
            window.location.href = url;
        }
    } catch (error) {
        console.error('[PaymentHelper] Ошибка открытия платежа:', error);
        // Последний fallback
        window.location.href = url;
    }
}

export async function openSaveCardUrl(url) {
    return openPaymentUrl(url);
}

export async function closePaymentBrowser() {
    if (isNativeApp()) {
        console.log('[PaymentHelper] Попытка закрыть браузер');
    }
}

if (typeof window !== 'undefined') {
    window.PaymentHelper = {
        openPaymentUrl,
        openSaveCardUrl,
        closePaymentBrowser,
        isNativeApp
    };
}
