/**
 * Lightweight support chat widget powered by the new REST API (без Supabase).
 */
(function (global) {
    const API_ENDPOINT = '/api/user';
    const STORAGE_KEYS = {
        anonymousChatId: 'supportChatAnonId',
    };

    const state = {
        modal: null,
        chatHistory: null,
        chatInput: null,
        sendBtn: null,
        attachBtn: null,
        closeBtn: null,
        filterField: null,
        filterValue: null,
        anonymousChatId: null,
        userName: null,
        lastRenderedDate: null,
        isInitialized: false,
        isLoadingHistory: false,
        pollTimer: null,
        disabled: false,
    };

    function safeLocalStorageGet(key) {
        try {
            return global.localStorage?.getItem(key) || null;
        } catch (error) {
            console.warn('[SupportChat] Failed to read localStorage:', error);
            return null;
        }
    }

    function safeLocalStorageSet(key, value) {
        try {
            if (!global.localStorage) return;
            if (value == null) {
                global.localStorage.removeItem(key);
            } else {
                global.localStorage.setItem(key, value);
            }
        } catch (error) {
            console.warn('[SupportChat] Failed to write localStorage:', error);
        }
    }

    async function apiRequest(action, payload = {}) {
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || `Request failed (${response.status})`);
            }
            return data;
        } catch (error) {
            console.error(`[SupportChat] ${action} failed:`, error);
            throw error;
        }
    }

    function ensureIdentifiers(options = {}) {
        if (options.userId) {
            state.filterField = 'userId';
            state.filterValue = options.userId;
            state.anonymousChatId = null;
            return;
        }

        let anonId = options.anonymousChatId || safeLocalStorageGet(STORAGE_KEYS.anonymousChatId);
        if (!anonId && global.crypto?.randomUUID) {
            anonId = `anon_${crypto.randomUUID()}`;
        }
        if (!anonId) {
            anonId = `anon_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
        }
        safeLocalStorageSet(STORAGE_KEYS.anonymousChatId, anonId);

        state.filterField = 'anonymousChatId';
        state.filterValue = anonId;
        state.anonymousChatId = anonId;
    }

    function bindUI() {
        if (state.isInitialized) return;

        const modal = document.getElementById('support-modal');
        if (!modal) {
            state.disabled = true;
            return;
        }

        state.modal = modal;
        state.chatHistory = modal.querySelector('#chat-history');
        state.chatInput = modal.querySelector('#chat-input');
        state.sendBtn = modal.querySelector('#send-chat-btn');
        state.attachBtn = modal.querySelector('#chat-attach-btn');
        state.closeBtn = modal.querySelector('.modal-close');

        if (state.sendBtn) {
            state.sendBtn.addEventListener('click', handleSend);
        }
        if (state.chatInput) {
            state.chatInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                }
            });
        }
        if (state.closeBtn) {
            state.closeBtn.addEventListener('click', closeModal);
        }
        if (state.attachBtn) {
            state.attachBtn.addEventListener('click', () => {
                alert('Отправка файлов появится после обновления хранилища.');
            });
        }

        state.isInitialized = true;
    }

    function showModal() {
        if (!state.modal) return;
        state.modal.classList.remove('hidden');
        setTimeout(() => state.modal.classList.add('visible'), 20);
    }

    function hideModal() {
        if (!state.modal) return;
        state.modal.classList.remove('visible');
        setTimeout(() => state.modal.classList.add('hidden'), 200);
    }

    function closeModal() {
        stopPolling();
        hideModal();
    }

    function addDateSeparator(dateLabel) {
        if (!state.chatHistory) return;
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        separator.textContent = dateLabel;
        state.chatHistory.appendChild(separator);
    }

    function formatDate(date) {
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }

    function formatTime(date) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    function appendMessage(message, options = {}) {
        if (!state.chatHistory) return;
        const createdAt = message.created_at ? new Date(message.created_at) : new Date();
        const dateLabel = formatDate(createdAt);
        if (state.lastRenderedDate !== dateLabel) {
            addDateSeparator(dateLabel);
            state.lastRenderedDate = dateLabel;
        }

        const wrapper = document.createElement('div');
        const senderClass = message.sender === 'user' ? 'user' : 'support';
        wrapper.className = `chat-message ${senderClass}-message`;

        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.textContent = message.message_text || '';
        wrapper.appendChild(textEl);

        const timeEl = document.createElement('div');
        timeEl.className = 'message-timestamp';
        timeEl.textContent = formatTime(createdAt);
        wrapper.appendChild(timeEl);

        if (options.isLocal) wrapper.dataset.pending = 'true';
        if (options.failed) wrapper.dataset.failed = 'true';

        state.chatHistory.appendChild(wrapper);
        state.chatHistory.scrollTop = state.chatHistory.scrollHeight;
        return wrapper;
    }

    async function loadHistory() {
        if (state.disabled || state.isLoadingHistory) return;
        if (!state.filterField || !state.filterValue) return;

        state.isLoadingHistory = true;
        state.lastRenderedDate = null;
        if (state.chatHistory) {
            state.chatHistory.innerHTML = '';
        }

        try {
            const payload =
                state.filterField === 'userId'
                    ? { userId: state.filterValue }
                    : { anonymousChatId: state.filterValue };

            const { messages } = await apiRequest('get-support-messages', payload);
            (messages || []).forEach((message) => appendMessage(message));
            markMessagesRead().catch((error) => console.warn('[SupportChat] mark read failed:', error));
        } catch (error) {
            if (state.chatHistory) {
                state.chatHistory.innerHTML = `<div class="chat-error">Не удалось загрузить сообщения. Попробуйте позже.</div>`;
            }
        } finally {
            state.isLoadingHistory = false;
        }
    }

    async function refreshHistory() {
        if (state.isLoadingHistory) return;
        const previousScroll = state.chatHistory?.scrollHeight || 0;
        await loadHistory();
        if (state.chatHistory) {
            const diff = state.chatHistory.scrollHeight - previousScroll;
            if (diff > 60) {
                state.chatHistory.scrollTop = state.chatHistory.scrollHeight;
            }
        }
    }

    async function handleSend() {
        if (state.disabled) return;
        if (!state.chatInput || !state.sendBtn) return;

        const text = state.chatInput.value.trim();
        if (!text) return;

        const localMessage = appendMessage(
            {
                sender: 'user',
                message_text: text,
                created_at: new Date().toISOString(),
            },
            { isLocal: true }
        );

        state.chatInput.value = '';
        state.sendBtn.disabled = true;
        state.chatInput.disabled = true;

        const payload =
            state.filterField === 'userId'
                ? { userId: state.filterValue }
                : { anonymousChatId: state.filterValue };

        try {
            await apiRequest('send-support-message', {
                ...payload,
                messageText: text,
                sender: 'user',
                senderName: state.userName || null,
            });
            if (localMessage) {
                delete localMessage.dataset.pending;
            }
            await refreshHistory();
        } catch (error) {
            console.error('[SupportChat] send failed:', error);
            if (localMessage) {
                localMessage.dataset.failed = 'true';
                delete localMessage.dataset.pending;
            }
        } finally {
            state.chatInput.disabled = false;
            state.sendBtn.disabled = false;
            state.chatInput.focus();
        }
    }

    async function markMessagesRead() {
        if (!state.filterField || !state.filterValue) return;
        const payload =
            state.filterField === 'userId'
                ? { userId: state.filterValue }
                : { anonymousChatId: state.filterValue };
        try {
            await apiRequest('mark-support-read', payload);
        } catch (error) {
            console.warn('[SupportChat] mark read failed:', error);
        }
    }

    function startPolling() {
        stopPolling();
        state.pollTimer = global.setInterval(() => {
            refreshHistory().catch((error) => console.warn('[SupportChat] poll error:', error));
        }, 10000);
    }

    function stopPolling() {
        if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
    }

    function open(options = {}) {
        ensureIdentifiers(options);
        state.userName = options.userName || null;
        bindUI();
        if (state.disabled) {
            alert('Чат поддержки временно недоступен. Попробуйте позже.');
            return;
        }
        showModal();
        refreshHistory().catch(() => {});
        startPolling();
    }

    global.SupportChat = {
        open,
        close: closeModal,
        isAvailable: () => !state.disabled,
        getAnonymousChatId: () => state.anonymousChatId,
    };
})(typeof window !== 'undefined' ? window : global);

