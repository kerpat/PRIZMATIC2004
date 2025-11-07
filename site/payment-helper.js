/**
 * 🔧 Payment Helper - Открывает оплату БЕЗ выкидывания из приложения
 */
import { Browser } from '@capacitor/browser';

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
            // Открываем внутри приложения!
            await Browser.open({
                url: url,
                presentationStyle: 'popover',
                toolbarColor: '#2d6a4f',
            });

            Browser.addListener('browserFinished', () => {
                console.log('[PaymentHelper] Браузер закрыт, обновляем данные');
                window.location.reload();
            });

            Browser.addListener('browserPageLoaded', () => {
                console.log('[PaymentHelper] Страница оплаты загружена');
            });
        } else {
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
            await Browser.close();
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

