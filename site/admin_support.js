/**
 * Admin support console without Supabase dependencies.
 */
document.addEventListener('DOMContentLoaded', () => {
    const chatListContainer = document.getElementById('chat-list-container');
    const chatWindowHeader = document.getElementById('chat-window-header');
    const chatHistoryContainer = document.getElementById('chat-history-container');
    const chatInput = document.getElementById('chat-input-admin');
    const sendBtn = document.getElementById('send-chat-admin-btn');
    const searchInput = document.getElementById('client-chat-search');
    const emptyState = document.getElementById('chat-empty-state');

    const state = {
        chats: [],
        filteredChats: [],
        activeChatId: null,
        activeChatIsAnonymous: false,
        isLoadingChats: false,
        isLoadingHistory: false,
        pollTimer: null,
    };

    const ADMIN_TOKEN_KEY = 'adminAuthToken';

    function getAdminToken() {
        try {
            return localStorage.getItem(ADMIN_TOKEN_KEY);
        } catch (error) {
            console.warn('[admin-support] Cannot read token from localStorage:', error);
            return null;
        }
    }

    function requireAuth() {
        const token = getAdminToken();
        if (!token) {
            if (emptyState) {
                emptyState.textContent = 'Сначала войдите в основную админку, чтобы получить доступ к чатам поддержки.';
                emptyState.classList.remove('hidden');
            } else {
                alert('Нет доступа. Авторизуйтесь в админке.');
            }
            return false;
        }
        return true;
    }

    async function adminApi(action, payload = {}) {
        const token = getAdminToken();
        if (!token) {
            throw new Error('Unauthorized');
        }

        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action, ...payload }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || `Request failed (${response.status})`);
        }
        return data;
    }

    function normalizeChats(raw) {
        const chats = Array.isArray(raw?.chats) ? raw.chats : [];
        const normalized = chats.map((chat) => ({
            id: chat.client_id || chat.anonymous_chat_id || chat.reference_id || chat.chat_id,
            isAnonymous: !chat.client_id,
            name: chat.clients?.name || (chat.anonymous_chat_id ? `Анонимный чат ${String(chat.anonymous_chat_id).slice(-4)}` : 'Без имени'),
            phone: chat.clients?.phone || null,
            lastMessageText: chat.last_message_text || '',
            lastMessageAt: chat.last_message_at || chat.updated_at || null,
            unreadCount: Number(chat.has_unread ? 1 : chat.unread_count || 0),
        }));

        normalized.sort((a, b) => {
            const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return timeB - timeA;
        });

        return normalized;
    }

    function renderChatList(filter = '') {
        if (!chatListContainer) return;
        chatListContainer.innerHTML = '';

        const lowerFilter = filter.trim().toLowerCase();
        const chatsToRender = lowerFilter
            ? state.chats.filter((chat) => {
                  const haystack = [chat.name, chat.phone, chat.lastMessageText].join(' ').toLowerCase();
                  return haystack.includes(lowerFilter);
              })
            : state.chats;

        state.filteredChats = chatsToRender;

        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        if (chatsToRender.length === 0) {
            const empty = document.createElement('p');
            empty.style.padding = '10px';
            empty.style.textAlign = 'center';
            empty.textContent = 'Чаты не найдены';
            chatListContainer.appendChild(empty);
            return;
        }

        chatsToRender.forEach((chat) => {
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            item.dataset.chatId = chat.id;
            item.dataset.type = chat.isAnonymous ? 'anonymous' : 'client';

            const avatarClass = chat.isAnonymous ? 'anonymous' : 'user';
            const avatarText = chat.isAnonymous
                ? '?'
                : (chat.name || 'К').trim().charAt(0).toUpperCase();
            const subtitle = chat.isAnonymous ? chat.lastMessageText || '...' : chat.phone || 'Нет номера';

            item.innerHTML = `
                <div class="chat-avatar ${avatarClass}">${avatarText}</div>
                <div class="chat-info">
                    <div class="chat-name">${chat.name}</div>
                    <div class="last-message">${subtitle}</div>
                </div>
            `;

            if (chat.unreadCount > 0) {
                const badge = document.createElement('span');
                badge.className = 'chat-unread-badge';
                badge.textContent = chat.unreadCount > 99 ? '99+' : chat.unreadCount;
                item.appendChild(badge);
            }

            item.addEventListener('click', () => openChat(chat));
            chatListContainer.appendChild(item);
        });
    }

    function setActiveChatStyles(chatId) {
        const items = chatListContainer?.querySelectorAll('.chat-list-item') || [];
        items.forEach((item) => {
            if (item.dataset.chatId === chatId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    function renderEmptyHistory(message) {
        if (!chatHistoryContainer) return;
        chatHistoryContainer.innerHTML = `<div class="chat-placeholder">${message}</div>`;
    }

    function appendMessageToHistory(message) {
        if (!chatHistoryContainer) return;
        const wrapper = document.createElement('div');
        wrapper.className = `chat-message ${message.sender === 'admin' ? 'admin-message' : 'user-message'}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = message.message_text || '';
        wrapper.appendChild(bubble);

        const meta = document.createElement('div');
        meta.className = 'message-meta';
        const timestamp = message.created_at ? new Date(message.created_at) : new Date();
        meta.textContent = timestamp.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
        wrapper.appendChild(meta);

        chatHistoryContainer.appendChild(wrapper);
    }

    async function loadChats() {
        if (state.isLoadingChats) return;
        state.isLoadingChats = true;
        try {
            const data = await adminApi('list-support-chats');
            state.chats = normalizeChats(data);
            renderChatList(searchInput?.value || '');

            if (state.chats.length === 0) {
                if (emptyState) {
                    emptyState.textContent = 'Пока нет сообщений пользователей.';
                    emptyState.classList.remove('hidden');
                }
                if (chatHistoryContainer) {
                    chatHistoryContainer.innerHTML = '';
                }
            }
        } catch (error) {
            console.error('[admin-support] Не удалось загрузить список чатов:', error);
            if (emptyState) {
                emptyState.textContent = 'Не удалось загрузить чаты. Попробуйте позже.';
                emptyState.classList.remove('hidden');
            }
        } finally {
            state.isLoadingChats = false;
        }
    }

    async function loadChatHistory(chat) {
        if (state.isLoadingHistory) return;
        state.isLoadingHistory = true;
        try {
            if (chatHistoryContainer) {
                chatHistoryContainer.innerHTML = '<div class="chat-placeholder">Загрузка...</div>';
            }

            const payload = chat.isAnonymous
                ? { anonymousChatId: chat.id }
                : { clientId: chat.id };

            const { messages = [] } = await adminApi('get-support-history', payload);
            if (!messages.length) {
                renderEmptyHistory('Сообщений пока нет.');
            } else {
                if (chatHistoryContainer) chatHistoryContainer.innerHTML = '';
                messages.forEach(appendMessageToHistory);
                chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
            }

            await adminApi('mark-support-user-read', payload).catch(() => {});
        } catch (error) {
            console.error('[admin-support] Не удалось загрузить историю:', error);
            renderEmptyHistory('Ошибка загрузки истории.');
        } finally {
            state.isLoadingHistory = false;
        }
    }

    async function openChat(chat) {
        state.activeChatId = chat.id;
        state.activeChatIsAnonymous = chat.isAnonymous;
        setActiveChatStyles(chat.id);

        if (chatWindowHeader) {
            chatWindowHeader.textContent = chat.name || 'Чат';
        }

        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        await loadChatHistory(chat);
    }

    async function sendMessage() {
        if (!state.activeChatId || !chatInput) return;
        const text = chatInput.value.trim();
        if (!text) return;

        const payload = state.activeChatIsAnonymous
            ? { anonymousChatId: state.activeChatId }
            : { clientId: state.activeChatId };

        chatInput.disabled = true;
        sendBtn.disabled = true;

        try {
            await adminApi('send-support-message-admin', {
                ...payload,
                messageText: text,
            });
            chatInput.value = '';
            await loadChatHistory({ id: state.activeChatId, isAnonymous: state.activeChatIsAnonymous });
            await loadChats();
        } catch (error) {
            alert('Не удалось отправить сообщение: ' + error.message);
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    function startPolling() {
        stopPolling();
        state.pollTimer = setInterval(() => {
            loadChats().catch(() => {});
            if (state.activeChatId) {
                loadChatHistory({ id: state.activeChatId, isAnonymous: state.activeChatIsAnonymous }).catch(() => {});
            }
        }, 10000);
    }

    function stopPolling() {
        if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
    }

    if (!requireAuth()) {
        return;
    }

    loadChats().then(() => {
        if (state.chats.length > 0) {
            openChat(state.chats[0]).catch(() => {});
        } else {
            renderEmptyHistory('Выберите чат слева, чтобы начать переписку.');
        }
    });
    startPolling();

    if (sendBtn) {
        sendBtn.addEventListener('click', (event) => {
            event.preventDefault();
            sendMessage();
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            renderChatList(event.target.value);
        });
    }

    window.addEventListener('beforeunload', stopPolling);
});
