// Мост для взаимодействия с нативным приложением
class AppBridge {
    constructor() {
        this.isAndroidApp = this.detectAndroidApp();
        this.isIOSApp = this.detectIOSApp();
        this.isInApp = this.isAndroidApp || this.isIOSApp;
        
        // Добавляем логирование для отладки
        console.log('AppBridge initialized:', {
            isAndroidApp: this.isAndroidApp,
            isIOSApp: this.isIOSApp,
            isInApp: this.isInApp,
            userAgent: navigator.userAgent,
            capacitor: typeof window.Capacitor !== 'undefined',
            capacitorPlugins: !!(window.Capacitor && window.Capacitor.Plugins)
        });
        
        if (this.isInApp) {
            this.setupAppNavigation();
        }
    }

    // Определение Android приложения
    detectAndroidApp() {
        // Проверяем наличие специфических признаков Android WebView в вашем приложении
        return typeof window.Capacitor !== 'undefined' || // Capacitor framework (используется в вашем приложении)
               (window.Capacitor && window.Capacitor.Plugins) || // Дополнительная проверка для Capacitor
               navigator.userAgent.includes('wv') || // WebView marker
               (navigator.userAgent.includes('Android') && navigator.userAgent.toLowerCase().includes('chrome') && navigator.userAgent.includes('safari')); // Android WebView
    }

    // Определение iOS приложения (на всякий случай)
    detectIOSApp() {
        return window.webkit && window.webkit.messageHandlers;
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

    // Проверяем, возвращаемся ли из оплаты
    isReturnFromPayment() {
        // Проверяем URL на признаки возврата из оплаты
        const searchParams = new URLSearchParams(window.location.search);
        const returnFromPaymentParams = [
            'payment_success', 'payment_id', 'payment_status', 'payment_complete', 'return_url',
            'success', 'result', 'status', 'token', 'payment_token', 'checkout', 'paid'
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
        const paymentSuccess = urlParams.get('payment_success') || 
                              urlParams.get('status') === 'success' ||
                              urlParams.get('payment_status') === 'success';
        
        // Если это возврат из оплаты, делаем задержку перед обработкой
        setTimeout(() => {
            if (paymentSuccess) {
                // Показываем пользователю сообщение об успешной оплате
                this.showPaymentSuccessNotification();
            }
            
            // Предотвращаем переход по внешним ссылкам, которые могут вывести из приложения
            this.preventExternalNavigation();
            
            // Если есть специфические параметры оплаты, очищаем URL, чтобы не было повторных действий
            if (paymentSuccess) {
                this.cleanPaymentParamsFromUrl();
            }
        }, 1000);
    }

    // Показываем уведомление об успешной оплате
    showPaymentSuccessNotification() {
        // Находим или создаем toast-уведомление
        let toast = document.getElementById('payment-success-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'payment-success-toast';
            toast.className = 'toast-container toast-success';
            toast.innerHTML = '<p class="toast-message">Платёж прошёл успешно!</p>';
            document.body.appendChild(toast);
        }
        
        // Показываем уведомление
        toast.classList.remove('hidden');
        
        // Скрываем через 3 секунды
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
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
        const paramsToClean = ['payment_success', 'payment_id', 'payment_status', 'status', 'return_url', 'token', 'payment_token'];
        
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
        if (this.isInApp) {
            // Для приложения используем внутреннюю навигацию
            window.location.href = path;
        } else {
            // Для веба используем стандартную навигацию
            window.location.href = path;
        }
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