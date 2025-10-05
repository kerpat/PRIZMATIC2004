(function (global) {
    const state = {
        supabase: null,
        modal: null,
        chatHistory: null,
        chatInput: null,
        sendBtn: null,
        attachBtn: null,
        attachMenu: null,
        closeBtn: null,
        channel: null,
        channelKey: null,
        filterField: null,
        filterValue: null,
        lastRenderedDate: null,
        isInitialized: false,
        isHistoryLoaded: false,
        isLoadingHistory: false,
        anonymousChatId: null,
        userName: null
    };

    const STORAGE_KEYS = {
        anonymousChatId: 'supportChatAnonId'
    };

    function ensureSupabase(options) {
        if (options && options.supabaseClient) {
            state.supabase = options.supabaseClient;
        }
        if (!state.supabase && global.supabase && typeof global.supabase.createClient === 'function') {
            const url = global.SUPABASE_URL || global.localStorage?.getItem('supabaseUrl');
            const anonKey = global.SUPABASE_ANON_KEY || global.localStorage?.getItem('supabaseAnonKey');
            if (url && anonKey) {
                state.supabase = global.supabase.createClient(url, anonKey);
            }
        }
        if (!state.supabase) {
            console.warn('SupportChat: Supabase client is not configured.');
        }
    }

    function ensureIdentifiers(options = {}) {
        if (options.userId) {
            state.filterField = 'client_id';
            state.filterValue = options.userId;
            state.anonymousChatId = null;
            return;
        }

        let anonId = options.anonymousChatId || null;
        if (!anonId && global.localStorage) {
            try {
                anonId = global.localStorage.getItem(STORAGE_KEYS.anonymousChatId);
            } catch (err) {
                console.warn('SupportChat: failed to read anonymous id from storage', err);
            }
        }
        if (!anonId && global.crypto && typeof global.crypto.randomUUID === 'function') {
            anonId = `anon_${global.crypto.randomUUID()}`;
        }
        if (!anonId) {
            anonId = `anon_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
        }
        try {
            global.localStorage?.setItem(STORAGE_KEYS.anonymousChatId, anonId);
        } catch (err) {
            // ignore storage issues
        }
        state.filterField = 'anonymous_chat_id';
        state.filterValue = anonId;
        state.anonymousChatId = anonId;
    }

    function bindUI() {
        if (state.isInitialized) {
            return;
        }
        const modal = document.getElementById('support-modal');
        if (!modal) {
            return;
        }
        state.modal = modal;
        state.chatHistory = modal.querySelector('#chat-history');
        state.chatInput = modal.querySelector('#chat-input');
        state.sendBtn = modal.querySelector('#send-chat-btn');
        state.attachBtn = modal.querySelector('#chat-attach-btn');
        state.attachMenu = modal.querySelector('#chat-attach-menu');
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
            state.closeBtn.addEventListener('click', () => close());
        }
        if (state.attachBtn && state.attachMenu) {
            state.attachBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                state.attachMenu.classList.toggle('visible');
            });
            document.addEventListener('click', (event) => {
                if (!state.attachMenu) return;
                if (state.attachMenu.contains(event.target) || state.attachBtn.contains(event.target)) {
                    return;
                }
                state.attachMenu.classList.remove('visible');
            });
        }
        state.isInitialized = true;
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

    function appendMessage(message, meta = {}) {
        if (!state.chatHistory) return null;
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
        textEl.textContent = message.message_text || message.text || '';
        wrapper.appendChild(textEl);

        const timeEl = document.createElement('div');
        timeEl.className = 'message-timestamp';
        timeEl.textContent = formatTime(createdAt);
        wrapper.appendChild(timeEl);

        if (meta.failed) {
            wrapper.dataset.failed = 'true';
            wrapper.title = 'Не удалось отправить сообщение';
        }
        if (meta.isLocal) {
            wrapper.dataset.pending = 'true';
        }

        state.chatHistory.appendChild(wrapper);
        state.chatHistory.scrollTop = state.chatHistory.scrollHeight;
        return wrapper;
    }

    async function loadHistory() {
        if (!state.supabase || !state.filterField || !state.filterValue || state.isLoadingHistory) {
            return;
        }
        if (state.chatHistory) {
            state.chatHistory.innerHTML = '';
        }
        state.lastRenderedDate = null;
        state.isLoadingHistory = true;

        const { data, error } = await state.supabase
            .from('support_messages')
            .select('*')
            .eq(state.filterField, state.filterValue)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('SupportChat: failed to load history', error);
            if (state.chatHistory) {
                const errorEl = document.createElement('div');
                errorEl.className = 'chat-error';
                errorEl.textContent = 'Не удалось загрузить историю чата.';
                state.chatHistory.appendChild(errorEl);
            }
        } else if (data && data.length > 0) {
            data.forEach((msg) => appendMessage(msg));
        } else if (state.chatHistory) {
            appendMessage({
                sender: 'support',
                message_text: 'Здравствуйте! Чем могу помочь?',
                created_at: new Date().toISOString()
            });
        }

        state.isHistoryLoaded = true;
        state.isLoadingHistory = false;
        subscribe();
    }

    function subscribe() {
        if (!state.supabase || !state.filterField || !state.filterValue) {
            return;
        }
        const key = `${state.filterField}:${state.filterValue}`;
        if (state.channel && state.channelKey === key) {
            return;
        }
        if (state.channel) {
            try {
                state.supabase.removeChannel(state.channel);
            } catch (err) {
                console.warn('SupportChat: failed to remove previous channel', err);
            }
            state.channel = null;
            state.channelKey = null;
        }
        state.channel = state.supabase
            .channel(`support-chat-${key}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'support_messages',
                filter: `${state.filterField}=eq.${state.filterValue}`
            }, (payload) => {
                if (payload?.new) {
                    appendMessage(payload.new);
                }
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.warn('SupportChat: subscription error');
                }
            });
        state.channelKey = key;
    }

    async function handleSend() {
        if (!state.supabase || !state.chatInput) {
            return;
        }
        const text = state.chatInput.value.trim();
        if (!text) {
            return;
        }
        const pendingMessage = {
            sender: 'user',
            message_text: text,
            created_at: new Date().toISOString()
        };
        pendingMessage[state.filterField] = state.filterValue;
        const rendered = appendMessage(pendingMessage, { isLocal: true });
        state.chatInput.value = '';
        state.chatInput.focus();
        if (state.sendBtn) {
            state.sendBtn.disabled = true;
        }
        state.chatInput.disabled = true;

        try {
            const payload = {
                sender: 'user',
                message_text: text,
                is_read: false
            };
            payload[state.filterField] = state.filterValue;
            if (state.userName) {
                payload.sender_name = state.userName;
            }
            const { error } = await state.supabase.from('support_messages').insert(payload);
            if (error) {
                throw error;
            }
            if (rendered) {
                rendered.dataset.pending = 'false';
            }
        } catch (err) {
            console.error('SupportChat: failed to send message', err);
            if (rendered) {
                rendered.dataset.failed = 'true';
                rendered.dataset.pending = 'false';
            }
        } finally {
            if (state.sendBtn) {
                state.sendBtn.disabled = false;
            }
            state.chatInput.disabled = false;
        }
    }

    function open() {
        bindUI();
        if (!state.modal) {
            alert('Модальное окно поддержки недоступно.');
            return;
        }
        state.modal.classList.remove('hidden');
        if (!state.isHistoryLoaded) {
            loadHistory();
        }
        if (state.chatInput) {
            setTimeout(() => state.chatInput.focus(), 50);
        }
    }

    function close() {
        if (!state.modal) {
            return;
        }
        state.modal.classList.add('hidden');
        if (state.attachMenu) {
            state.attachMenu.classList.remove('visible');
        }
    }

    function resetChannelIfNeeded(prevField, prevValue) {
        if (prevField !== state.filterField || prevValue !== state.filterValue) {
            state.isHistoryLoaded = false;
            state.lastRenderedDate = null;
            if (state.channel) {
                try {
                    state.supabase.removeChannel(state.channel);
                } catch (err) {
                    console.warn('SupportChat: failed to reset channel', err);
                }
                state.channel = null;
                state.channelKey = null;
            }
            if (state.chatHistory) {
                state.chatHistory.innerHTML = '';
            }
        }
    }

    function init(options = {}) {
        ensureSupabase(options);
        if (!state.supabase) {
            return;
        }
        const prevField = state.filterField;
        const prevValue = state.filterValue;
        state.userName = options.userName || state.userName || null;
        ensureIdentifiers(options);
        bindUI();
        resetChannelIfNeeded(prevField, prevValue);
        if (state.modal && !state.isHistoryLoaded && !state.isLoadingHistory) {
            loadHistory();
        }
    }

    global.SupportChat = {
        init,
        open,
        close
    };
})(window);
