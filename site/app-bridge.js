// Мост для взаимодействия с нативным приложением
class AppBridge {
    constructor() {
        this.isAndroidApp = this.detectAndroidApp();
        this.isIOSApp = this.detectIOSApp();
        this.isTelegramApp = this.detectTelegramApp();
        this.isInApp = this.isTelegramApp;
        
        // Добавляем логирование для отладки
        console.log('AppBridge initialized:', {
            isAndroidApp: this.isAndroidApp,
            isIOSApp: this.isIOSApp,
            isTelegramApp: this.isTelegramApp,
            isInApp: this.isInApp,
            userAgent: navigator.userAgent,
            capacitor: typeof window.Capacitor !== 'undefined',
            capacitorPlugins: !!(window.Capacitor && window.Capacitor.Plugins)
        });
        
        if (this.isInApp) {
            this.setupAppNavigation();
            this.enforceInAppNavigation();
            this.registerDeepLinkHandler();
        }
    }

    // Определение Android приложения
    detectAndroidApp() {
        return false;
    }

    // Определение iOS приложения (на всякий случай)
    detectIOSApp() {
        return false;
    }

    detectTelegramApp() {
        return typeof window.Telegram !== 'undefined' && !!(window.Telegram.WebApp && window.Telegram.WebApp.initData);
    }

    // Настройка специальной навигации для приложений
    setupAppNavigation() {
        // Проверяем, возвращаемся ли мы из оплаты
        if (this.isReturnFromPayment()) {
            this.handleReturnFromPayment();
        }
        
        // Переопределяем поведение кнопки "назад"
        this.setupBackButtonHandler();
        
        // Настройка обработки кнопок возврата из оплаты
        this.setupPaymentReturnHandling();
    }

    // Принудительно оставляем навигацию внутри WebView
    enforceInAppNavigation() {
        if (!this.isInApp || this._navigationPatched) return;
        this._navigationPatched = true;

        const originalOpen = window.open?.bind(window);
        window.open = (url = '', name, specs) => {
            if (typeof url === 'string' && url && !/^javascript:/i.test(url) && url !== 'about:blank') {
                console.log('[AppBridge] window.open перехвачен:', { url, name, specs });
                this.navigateTo(url);
                return window;
            }
            return originalOpen ? originalOpen(url, name, specs) : null;
        };

        document.addEventListener('click', (event) => {
            const anchor = event.target?.closest?.('a[target="_blank"]');
            if (anchor && anchor.href) {
                event.preventDefault();
                console.log('[AppBridge] target=_blank click перехвачен:', anchor.href);
                this.navigateTo(anchor.href);
            }
        }, true);

        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (form?.target === '_blank') {
                console.log('[AppBridge] target=_blank submit перехвачен:', form.action || '(current)');
                form.target = '_self';
            }
        }, true);
    }

    registerDeepLinkHandler() {
        if (this._deepLinkRegistered) return;
        const appPlugin = window.Capacitor?.App || window.Capacitor?.Plugins?.App;
        if (!appPlugin || typeof appPlugin.addListener !== 'function') {
            return;
        }

        this._deepLinkRegistered = true;
        appPlugin.addListener('appUrlOpen', (event) => {
            try {
                const incomingUrl = event?.url;
                if (!incomingUrl) return;

                console.log('[AppBridge] appUrlOpen:', incomingUrl);
                const lower = incomingUrl.toLowerCase();
                const isPaymentReturn = lower.startsWith('prizmatic://return') || lower.includes('/payment-return');
                if (!isPaymentReturn) return;

                const parsed = new URL(incomingUrl);
                const status = (parsed.searchParams.get('status') ||
                                parsed.searchParams.get('payment_status') ||
                                parsed.searchParams.get('result') ||
                                'unknown').toLowerCase();
                const type = (parsed.searchParams.get('type') ||
                              parsed.searchParams.get('payment_type') ||
                              'payment').toLowerCase();

                sessionStorage.setItem('paymentReturnStatus', status);
                sessionStorage.setItem('paymentReturnType', type);

                const destination = `profile.html?payment_return=${encodeURIComponent(status)}&payment_type=${encodeURIComponent(type)}`;
                setTimeout(() => this.navigateTo(destination), 0);
            } catch (error) {
                console.warn('[AppBridge] Ошибка обработки deep-link:', error);
            }
        });
    }

    // Проверяем, возвращаемся ли из оплаты
    isReturnFromPayment() {
        // Проверяем URL на признаки возврата из оплаты
        const searchParams = new URLSearchParams(window.location.search);
        const returnFromPaymentParams = [
            'payment_success', 'payment_id', 'payment_status', 'payment_complete', 'return_url',
            'success', 'result', 'status', 'token', 'payment_token', 'checkout', 'paid', 'payment_return', 'payment_type'
        ];
        
        for (const param of returnFromPaymentParams) {
            if (searchParams.has(param)) {
                return true;
            }
        }
        
        // Проверяем хэш в URL, который может содержать параметры оплаты
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        for (const param of returnFromPaymentParams) {
            if (hashParams.has(param)) {
                return true;
            }
        }
        
        // Проверяем, содержит ли URL ключевые слова, связанные с оплатой
        const url = window.location.href.toLowerCase();
        return /payment|checkout|pay|success|return|callback|result|yookassa|sbp|sber|tinkoff/i.test(url);
    }

    // Обработка возврата из оплаты
    handleReturnFromPayment() {
        // Проверяем, есть ли в URL параметры, указывающие на успешную оплату
        const urlParams = new URLSearchParams(window.location.search);
        const storedStatus = (sessionStorage.getItem('paymentReturnStatus') || '').toLowerCase();
        const storedType = (sessionStorage.getItem('paymentReturnType') || '').toLowerCase();
        const urlStatus = (
            urlParams.get('payment_return') ||
            urlParams.get('payment_status') ||
            urlParams.get('status') ||
            urlParams.get('result') ||
            urlParams.get('payment_success')
        );
        const urlType = (
            urlParams.get('payment_type') ||
            urlParams.get('type')
        );

        const normalizedUrlStatus = typeof urlStatus === 'string' ? urlStatus.toLowerCase() : '';
        const normalizedUrlType = typeof urlType === 'string' ? urlType.toLowerCase() : '';
        const finalStatus = storedStatus || normalizedUrlStatus;
        const finalType = storedType || normalizedUrlType || 'payment';

        const isSuccess = ['success', 'succeeded', 'paid'].includes(finalStatus);
        const isFailed = ['canceled', 'cancelled', 'failed', 'rejected'].includes(finalStatus);
        
        // Если это возврат из оплаты, делаем задержку перед обработкой
        setTimeout(() => {
            if (isSuccess) {
                // Показываем пользователю сообщение об успешной оплате
                this.showPaymentSuccessNotification(finalType);
            } else if (isFailed) {
                this.showPaymentErrorNotification(finalType);
            }
            
            // Предотвращаем переход по внешним ссылкам, которые могут вывести из приложения
            this.preventExternalNavigation();
            
            // Если есть специфические параметры оплаты, очищаем URL, чтобы не было повторных действий
            if (finalStatus) {
                sessionStorage.removeItem('paymentReturnStatus');
                sessionStorage.removeItem('paymentReturnType');
                this.cleanPaymentParamsFromUrl();
            }
        }, 1000);
    }

    // Показываем уведомление об успешной оплате
    showPaymentSuccessNotification(type = 'payment') {
        const map = {
            top_up: 'Баланс пополнен!',
            rental: 'Аренда оформлена!',
            booking: 'Бронирование подтверждено!',
            renewal: 'Продление оформлено!',
            save_card: 'Карта сохранена!',
        };
        const message = map[type] || 'Платёж прошёл успешно!';

        // Находим или создаем toast-уведомление
        let toast = document.getElementById('payment-success-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'payment-success-toast';
            toast.className = 'toast-container toast-success';
            toast.innerHTML = '<p class="toast-message"></p>';
            document.body.appendChild(toast);
        }

        const textNode = toast.querySelector('.toast-message');
        if (textNode) {
            textNode.textContent = message;
        }
        
        // Показываем уведомление
        toast.classList.remove('hidden');
        
        // Скрываем через 3 секунды
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    showPaymentErrorNotification(type = 'payment') {
        const map = {
            top_up: 'Платёж не подтверждён. Попробуйте пополнить баланс позже.',
            rental: 'Аренда не подтверждена. Попробуйте ещё раз.',
            booking: 'Оплата бронирования не завершена.',
            renewal: 'Продление не прошло. Проверьте данные.',
            save_card: 'Не удалось сохранить карту.',
        };
        const message = map[type] || 'Платёж не подтверждён. Попробуйте ещё раз.';

        let toast = document.getElementById('payment-error-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'payment-error-toast';
            toast.className = 'toast-container toast-error';
            toast.innerHTML = '<p class="toast-message"></p>';
            document.body.appendChild(toast);
        }

        const textNode = toast.querySelector('.toast-message');
        if (textNode) {
            textNode.textContent = message;
        }
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3500);
    }

    // Предотвращаем внешнюю навигацию, которая может вывести из приложения
    preventExternalNavigation() {
        // Переопределяем все ссылки, которые могут вывести из приложения
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && (href.startsWith('http') && !href.includes(window.location.hostname))) {
                // Для внешних ссылок делаем специальную обработку
                link.addEventListener('click', (e) => {
                    if (this.isInApp) {
                        e.preventDefault();
                        // Вместо открытия внешней ссылки, можно использовать InAppBrowser или вернуться в приложение
                        this.handleExternalLink(href);
                    }
                });
            }
        });
    }

    // Обработка внешних ссылок
    handleExternalLink(url) {
        // В Android-приложении можно использовать Capacitor плагины для открытия ссылок безопасно
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
            // Открываем во внешнем браузере, но с возможностью вернуться
            window.Capacitor.Plugins.Browser.open({ url });
        } else {
            // Просто открываем в текущем окне (не идеально, но работает)
            window.location.href = url;
        }
    }

    // Очищаем параметры оплаты из URL, чтобы избежать повторных действий
    cleanPaymentParamsFromUrl() {
        const url = new URL(window.location);
        const paramsToClean = ['payment_success', 'payment_id', 'payment_status', 'status', 'payment_return', 'payment_type', 'type', 'return_url', 'token', 'payment_token'];
        
        let changed = false;
        paramsToClean.forEach(param => {
            if (url.searchParams.has(param)) {
                url.searchParams.delete(param);
                changed = true;
            }
        });
        
        if (changed) {
            // Заменяем URL без перезагрузки страницы
            window.history.replaceState({}, document.title, url.toString());
        }
    }

    // Настройка обработчика кнопки "назад"
    setupBackButtonHandler() {
        // Для Android WebView
        if (this.isAndroidApp) {
            // Обработка аппаратной кнопки "назад"
            document.addEventListener('backbutton', () => {
                this.handleBackButton();
            }, false);
        }
        
        // Обработка кнопки "назад" в браузере
        window.addEventListener('popstate', (event) => {
            if (this.isInApp) {
                // Предотвращаем стандартное поведение и управляеем навигацией вручную
                // В зависимости от текущего состояния решаем, куда направить пользователя
                this.handleBackNavigation();
            }
        });
    }

    // Обработка нажатия кнопки "назад"
    handleBackButton() {
        // Если мы на главной странице или в состоянии, где навигация завершена
        if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
            // Пытаемся закрыть приложение
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
            } else {
                // Альтернативный способ выхода для WebView
                navigator.app && navigator.app.exitApp ? navigator.app.exitApp() : window.close();
            }
        } else {
            // В противном случае возвращаемся на главную страницу
            window.location.href = 'index.html';
        }
    }

    // Обработка навигации "назад" в браузере
    handleBackNavigation() {
        // Проверяем, не возвращаемся ли мы из оплаты
        if (this.isReturnFromPayment()) {
            // Если возвращаемся из оплаты, перенаправляем на главную страницу, а не назад в историю
            window.location.href = 'index.html';
            return;
        }
        
        // Для остальных случаев используем стандартное поведение
        // или определяем нужную логику в зависимости от состояния приложения
    }

    // Метод для проверки, находимся ли мы в приложении
    isInMobileApp() {
        return this.isInApp;
    }

    // Метод для выполнения навигации внутри приложения
    navigateTo(path) {
        if (!path) return;
        const isIntent = /^intent:/i.test(path);
        const isSpecial = /^(mailto:|tel:)/i.test(path);

        if ((isIntent || isSpecial) && window.Capacitor?.Plugins?.App?.openUrl) {
            window.Capacitor.Plugins.App.openUrl({ url: path }).catch((error) => {
                console.warn('[AppBridge] Не удалось открыть спец-ссылку, пробуем стандартно:', error);
                window.location.href = path;
            });
            return;
        }

        window.location.href = path;
    }
    
    // Настройка обработки кнопок возврата из оплаты (только когда возвращаемся из оплаты)
    setupPaymentReturnHandling() {
        // Обрабатываем кнопки только если мы возвращаемся из оплаты
        if (this.isReturnFromPayment()) {
            // Ищем кнопки с текстом, связанным с возвратом в магазин
            const returnButtons = document.querySelectorAll('button, a, input[type="button"], input[type="submit"]');
            
            returnButtons.forEach(button => {
                const buttonText = (button.textContent || button.value || button.innerText || '').toLowerCase();
                const buttonId = (button.id || '').toLowerCase();
                const buttonClass = (button.className || '').toLowerCase();
                
                // Проверяем, содержит ли кнопка ключевые слова для возврата
                if (this.isReturnButton(buttonText, buttonId, buttonClass)) {
                    // Сохраняем оригинальное поведение, чтобы не сломать другие функции
                    const originalHandler = button.onclick;
                    if (originalHandler) {
                        button.dataset.originalClick = originalHandler.toString();
                    }
                    
                    button.addEventListener('click', (e) => {
                        // Если это кнопка возврата из оплаты, используем наше поведение
                        if (this.isReturnFromPayment()) {
                            e.preventDefault();
                            this.handlePaymentReturnButton();
                        } else if (originalHandler) {
                            // Иначе используем оригинальное поведение
                            originalHandler.call(button, e);
                        }
                    }, { once: false }); // Убираем once, чтобы обработчик работал постоянно
                }
            });
        }
    }
    
    // Проверяем, является ли кнопка кнопкой возврата из оплаты
    isReturnButton(text, id, className) {
        const returnKeywords = [
            'вернуться в магазин', 'вернуться в приложение', 'назад в магазин', 
            'вернуться', 'назад', 'магазин', 'shop', 'store', 'return', 'back', 'в магазин',
            'вернуться в', 'назад в', 'на главную', 'home', 'главная', 'ок', 'готово'
        ];
        
        const combinedText = `${text} ${id} ${className}`.toLowerCase();
        
        return returnKeywords.some(keyword => combinedText.includes(keyword));
    }
    
    // Обработка нажатия кнопки возврата из оплаты
    handlePaymentReturnButton() {
        console.log('Обработка кнопки возврата из оплаты');
        
        // Очищаем параметры оплаты из URL
        this.cleanPaymentParamsFromUrl();
        
        // Возвращаемся на главную страницу приложения
        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        } else {
            // Если уже на главной странице - обновляем, чтобы сбросить состояние
            window.location.reload();
        }
    }
}

// Инициализируем мост при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    window.appBridge = new AppBridge();
});

// Также инициализируем, если DOM уже загружен
if (document.readyState === 'loading') {
    // DOM еще загружается, событие уже обработается выше
} else {
    // DOM уже загружен, инициализируем сразу
    window.appBridge = new AppBridge();
}
