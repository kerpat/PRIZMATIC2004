/**
 * Multi-Platform Authentication Initializer for PRIZMATIC
 * Supports: Telegram Mini App, VK ID, and Web Browser
 */

(async function initializeAuth() {
    console.log('[Auth Init] Starting authentication initialization...');

    // Detect platform
    const isAndroidApp = typeof AndroidInterface !== 'undefined';
    const isTelegramMiniApp = window.Telegram?.WebApp?.initData;
    const isWebBrowser = !isAndroidApp && !isTelegramMiniApp;

    console.log('[Auth Init] Platform detected:', {
        isAndroidApp,
        isTelegramMiniApp,
        isWebBrowser
    });

    // Check if user is already logged in
    const userId = localStorage.getItem('userId');
    const authProvider = localStorage.getItem('authProvider');

    if (userId) {
        console.log(`[Auth Init] User already logged in via ${authProvider || 'unknown'}`);
        // User is logged in, show app
        const appScreen = document.querySelector('.app-screen');
        if (appScreen) {
            appScreen.style.display = 'flex';
        }
        return;
    }

    // Hide app screen during auth
    const appScreen = document.querySelector('.app-screen');
    if (appScreen) appScreen.style.display = 'none';

    // Route to appropriate authentication method
    if (isTelegramMiniApp) {
        console.log('[Auth Init] Initializing Telegram authentication...');
        await initializeTelegramAuth();
    } else if (isAndroidApp || isWebBrowser) {
        console.log('[Auth Init] Redirecting to registration page for VK ID...');
        // Redirect to registration page for VK ID login
        window.location.href = 'registration.html';
    }
})();

/**
 * Initialize Telegram Mini App authentication
 */
async function initializeTelegramAuth() {
    // Wait for Telegram WebApp API to load
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max

    while (attempts < maxAttempts) {
        if (window.Telegram?.WebApp?.initData) {
            console.log('[Telegram Auth] Telegram WebApp API loaded');
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    const isInTelegram = window.Telegram?.WebApp?.initData;
    const userId = localStorage.getItem('userId');

    if (!isInTelegram) {
        console.log('[Telegram Auth] Not in Telegram WebApp, redirecting...');
        window.location.href = 'registration.html';
        return;
    }

    if (userId) {
        console.log('[Telegram Auth] User already logged in');
        const appScreen = document.querySelector('.app-screen');
        if (appScreen) appScreen.style.display = 'flex';
        return;
    }

    // Show loading screen
    showLoadingScreen('Авторизация...', 'Проверяем ваши данные в Telegram');

    try {
        const tg = window.Telegram.WebApp;
        tg.expand();

        const initData = tg.initData;
        console.log('[Telegram Auth] Sending auth request...');

        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'login',
                initData: initData || '',
                platform: tg.platform || 'unknown'
            })
        });

        const data = await response.json();
        console.log('[Telegram Auth] Server response:', data.success ? 'Success' : 'Failed');

        if (response.ok && data.success) {
            // Login successful
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('userName', data.user.name);
            localStorage.setItem('isRegistered', 'true');
            localStorage.setItem('authProvider', 'telegram');

            // Reload to load the app
            window.location.reload();
        } else {
            // Login failed, show registration prompt
            showRegistrationPrompt(tg);
        }
    } catch (error) {
        console.error('[Telegram Auth] Error:', error);
        showRegistrationPrompt(window.Telegram.WebApp);
    }
}

/**
 * Show loading screen
 */
function showLoadingScreen(title, message) {
    const loadingHTML = `
        <div class="app-screen loading-container" style="display: flex; text-align: center; justify-content: center; align-items: center; height: 100vh; width: 100vw; position: fixed; top: 0; left: 0; background: white; z-index: 1000;">
            <div class="app-content" style="justify-content: center;">
                <header class="app-header"><h1></h1></header>
                <main class="app-main">
                    <h2>${title}</h2>
                    <p style="color: var(--text-secondary); margin: 20px 0;">${message}</p>
                    <div class="loading-spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto;"></div>
                </main>
            </div>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>`;

    // Remove existing loading screen if present
    const existing = document.querySelector('.loading-container');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('afterbegin', loadingHTML);
}

/**
 * Show registration prompt for unregistered Telegram users
 */
function showRegistrationPrompt(tg) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'app-screen';
    messageDiv.style.display = 'flex';
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '0';
    messageDiv.style.left = '0';
    messageDiv.style.width = '100vw';
    messageDiv.style.height = '100vh';
    messageDiv.style.zIndex = '10000';

    messageDiv.innerHTML = `
        <div class="app-content" style="justify-content: center;">
            <header class="app-header" style="text-align: center;"><h1>PRIZMATIC</h1></header>
            <main class="app-main" style="text-align: center;">
                <h2>Вы не зарегистрированы</h2>
                <p style="color: var(--text-secondary); margin: 20px 0;">Пройдите быструю регистрацию для доступа к приложению.</p>
                <p id="countdown" style="color: var(--text-secondary); margin: 10px 0;">Перенаправление через 5 секунд...</p>
                <button class="btn btn-primary" id="redirect-btn">Зарегистрироваться</button>
            </main>
        </div>
    `;

    // Remove loading screen
    const loadingContainer = document.querySelector('.loading-container');
    if (loadingContainer) loadingContainer.remove();

    document.body.appendChild(messageDiv);

    // Countdown and redirect
    let countdown = 5;
    const countdownEl = document.getElementById('countdown');

    const redirect = () => {
        const botUsername = 'pr1zmaticbot';
        const registrationLink = `https://t.me/${botUsername}?start=register`;
        tg.openTelegramLink(registrationLink);
        setTimeout(() => tg.close(), 100);
    };

    const interval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = `Перенаправление через ${countdown} секунд...`;
        if (countdown <= 0) {
            clearInterval(interval);
            redirect();
        }
    }, 1000);

    const redirectBtn = document.getElementById('redirect-btn');
    if (redirectBtn) {
        redirectBtn.addEventListener('click', () => {
            clearInterval(interval);
            redirect();
        });
    }
}
