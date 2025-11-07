/**
 * 🔧 Payment Helper - Открывает оплату БЕЗ выкидывания из приложения
 * Использует InAppBrowser для полного контроля над всеми редиректами
 */

function isNativeApp() {
    return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
}

export async function openPaymentUrl(url) {
    if (!url) {
        console.error('[PaymentHelper] URL не указан');
        return;
    }

    console.log('[PaymentHelper] Открытие платежа:', { url, isNativeApp: isNativeApp() });

    try {
        if (isNativeApp()) {
            // Проверяем наличие InAppBrowser (Cordova)
            if (window.cordova && window.cordova.InAppBrowser) {
                console.log('[PaymentHelper] Используем InAppBrowser (полный контроль)');
                
                // InAppBrowser с полным контролем над редиректами
                const inAppBrowserRef = window.cordova.InAppBrowser.open(url, '_blank', 
                    'location=yes,hideurlbar=no,toolbarcolor=#2d6a4f,closebuttoncaption=Закрыть,hidenavigationbuttons=no,clearcache=yes,clearsessioncache=yes'
                );
                
                if (inAppBrowserRef) {
                    // Слушаем закрытие браузера
                    inAppBrowserRef.addEventListener('exit', () => {
                        console.log('[PaymentHelper] InAppBrowser закрыт, обновляем данные');
                        window.location.reload();
                    });
                    
                    // Слушаем загрузку страниц
                    inAppBrowserRef.addEventListener('loadstart', (event) => {
                        console.log('[PaymentHelper] Загрузка страницы:', event.url);
                        
                        // Проверяем возврат из оплаты
                        if (event.url && (event.url.includes('payment-return') || event.url.includes('prizmatic'))) {
                            console.log('[PaymentHelper] Обнаружен возврат из оплаты, закрываем браузер');
                            inAppBrowserRef.close();
                        }
                    });
                    
                    inAppBrowserRef.addEventListener('loaderror', (event) => {
                        console.error('[PaymentHelper] Ошибка загрузки:', event);
                    });
                }
            } 
            // Fallback на Capacitor Browser если InAppBrowser недоступен
            else if (window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
                console.log('[PaymentHelper] Используем Capacitor Browser (fallback)');
                const { Browser } = window.Capacitor.Plugins;
                
                await Browser.open({
                    url: url,
                    presentationStyle: 'fullscreen',
                    toolbarColor: '#2d6a4f',
                });
                
                await Browser.removeAllListeners();
                
                Browser.addListener('browserFinished', () => {
                    console.log('[PaymentHelper] Браузер закрыт, обновляем данные');
                    window.location.reload();
                });
            } else {
                // Если нет ни одного плагина - открываем в текущем окне
                console.warn('[PaymentHelper] Нет доступных InAppBrowser плагинов, fallback на window.location');
                window.location.href = url;
            }
        } else {
            // Web версия - обычный редирект
            window.location.href = url;
        }
    } catch (error) {
        console.error('[PaymentHelper] Ошибка открытия платежа:', error);
        window.location.href = url;
    }
}

export async function openSaveCardUrl(url) {
    return openPaymentUrl(url);
}

export async function closePaymentBrowser() {
    if (isNativeApp()) {
        try {
            // Закрываем InAppBrowser если используется
            // (обычно закрывается автоматически при возврате)
            console.log('[PaymentHelper] Попытка закрыть браузер');
        } catch (error) {
            console.warn('[PaymentHelper] Не удалось закрыть браузер:', error);
        }
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
