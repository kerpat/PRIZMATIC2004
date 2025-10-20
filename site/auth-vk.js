/**
 * VK ID Authentication Module for PRIZMATIC
 * Handles VK ID OAuth authentication flow
 */

class VKAuthManager {
    constructor(config) {
        this.appId = config.appId;
        this.redirectUrl = config.redirectUrl;
        this.scope = config.scope || 'phone email';
        this.vkidInstance = null;
        this.initialized = false;
        this.onSuccessCallback = null;
        this.onErrorCallback = null;
    }

    /**
     * Initialize VK ID SDK
     */
    async init() {
        return new Promise((resolve, reject) => {
            // Wait for VK ID SDK to load
            const checkSDK = setInterval(() => {
                if ('VKIDSDK' in window) {
                    clearInterval(checkSDK);

                    try {
                        const VKID = window.VKIDSDK;

                        VKID.Config.init({
                            app: this.appId,
                            redirectUrl: this.redirectUrl,
                            responseMode: VKID.ConfigResponseMode.Callback,
                            source: VKID.ConfigSource.LOWCODE,
                            scope: this.scope,
                        });

                        this.vkidInstance = VKID;
                        this.initialized = true;
                        console.log('[VK Auth] SDK initialized successfully');
                        resolve(VKID);
                    } catch (error) {
                        console.error('[VK Auth] Initialization error:', error);
                        reject(error);
                    }
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkSDK);
                if (!this.initialized) {
                    reject(new Error('VK ID SDK loading timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Render VK One Tap button
     * @param {string} containerId - ID of container element
     * @param {object} options - Rendering options
     */
    async renderOneTap(containerId, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container #${containerId} not found`);
        }

        const defaultOptions = {
            showAlternativeLogin: true,
            styles: {
                borderRadius: 21,
                width: 340,
                height: 48
            }
        };

        const renderOptions = { ...defaultOptions, ...options, container };

        try {
            const oneTap = new this.vkidInstance.OneTap();

            // Сохраняем ссылку на виджет
            this.oneTapWidget = oneTap;

            oneTap.render(renderOptions)
                .on(this.vkidInstance.WidgetEvents.ERROR, (error) => {
                    console.warn('[VK Auth] Widget event:', error);
                    // Игнорируем timeout - это нормальное поведение виджета
                    // Он ждет пока пользователь нажмет кнопку
                    if (error.text !== 'timeout') {
                        console.error('[VK Auth] Widget error:', error);
                    }
                })
                .on(this.vkidInstance.OneTapInternalEvents.LOGIN_SUCCESS, async (payload) => {
                    console.log('[VK Auth] Login success, exchanging code...');
                    try {
                        const authData = await this.exchangeCode(payload.code, payload.device_id);

                        // Аутентификация с backend
                        const backendResponse = await this.authenticateWithBackend(authData);

                        // Сохраняем данные
                        if (backendResponse.success && backendResponse.user) {
                            localStorage.setItem('userId', backendResponse.user.id);
                            localStorage.setItem('userName', backendResponse.user.name);
                            localStorage.setItem('isRegistered', 'true');
                            localStorage.setItem('authProvider', 'vk');
                        }

                        // Вызываем колбэк успеха
                        if (this.onSuccessCallback) {
                            this.onSuccessCallback(backendResponse);
                        }
                    } catch (error) {
                        console.error('[VK Auth] Exchange error:', error);
                        if (this.onErrorCallback) {
                            this.onErrorCallback(error);
                        }
                    }
                });

            console.log('[VK Auth] One Tap button rendered successfully');
        } catch (error) {
            console.error('[VK Auth] Render error:', error);
            throw error;
        }
    }

    /**
     * Exchange authorization code for access token
     * @param {string} code - Authorization code
     * @param {string} deviceId - Device ID
     */
    async exchangeCode(code, deviceId) {
        if (!this.initialized) {
            throw new Error('VK ID SDK not initialized');
        }

        try {
            const authData = await this.vkidInstance.Auth.exchangeCode(code, deviceId);
            console.log('[VK Auth] Code exchanged successfully');
            return authData;
        } catch (error) {
            console.error('[VK Auth] Code exchange error:', error);
            throw error;
        }
    }

    /**
     * Get user info from VK API
     * @param {string} accessToken - VK access token
     * @param {string} userId - VK user ID
     */
    async getUserInfo(accessToken, userId) {
        try {
            const response = await fetch(
                `https://api.vk.com/method/users.get?user_ids=${userId}&fields=photo_200,city,bdate,contacts_phone&access_token=${accessToken}&v=5.131`
            );

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.error_msg);
            }

            return data.response[0];
        } catch (error) {
            console.error('[VK Auth] Failed to get user info:', error);
            throw error;
        }
    }

    /**
     * Authenticate user with backend
     * @param {object} vkAuthData - VK authentication data
     */
    async authenticateWithBackend(vkAuthData) {
        try {
            console.log('[VK Auth] Authenticating with backend...');

            // Get user info from token first
            const userInfo = await this.getUserInfo(vkAuthData.access_token, vkAuthData.user_id);

            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'vk-login',
                    authData: {
                        user_id: vkAuthData.user_id,
                        first_name: userInfo.first_name,
                        last_name: userInfo.last_name,
                        photo_url: userInfo.photo_200,
                        // Don't send access_token to avoid IP restrictions
                        // access_token: vkAuthData.access_token,
                        expires_in: vkAuthData.expires_in,
                        device_id: vkAuthData.device_id
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            console.log('[VK Auth] Backend authentication successful');
            return data;
        } catch (error) {
            console.error('[VK Auth] Backend authentication error:', error);
            throw error;
        }
    }

    /**
     * Complete login flow: render button -> wait for user click -> authenticate
     * @param {string} containerId - Container element ID
     * @param {function} onSuccess - Success callback
     * @param {function} onError - Error callback
     */
    async login(containerId, onSuccess, onError) {
        try {
            // Сохраняем колбэки
            this.onSuccessCallback = onSuccess;
            this.onErrorCallback = onError;

            // Рендерим кнопку - она будет ждать клика пользователя
            await this.renderOneTap(containerId);

            console.log('[VK Auth] Waiting for user to click VK ID button...');

        } catch (error) {
            console.error('[VK Auth] Login initialization error:', error);
            if (onError) {
                onError(error);
            }
            throw error;
        }
    }

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('isRegistered');
        localStorage.removeItem('authProvider');
        console.log('[VK Auth] User logged out');
    }
}

// Export for use in other scripts
window.VKAuthManager = VKAuthManager;
