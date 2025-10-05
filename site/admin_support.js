// ▼▼▼ ВСТАВЬТЕ ЭТОТ КОД В ПУСТОЙ ФАЙЛ admin_support.js ▼▼▼
document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = CONFIG.SUPABASE_URL;
    const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    const chatListContainer = document.getElementById('chat-list-container');
    const chatWindowHeader = document.getElementById('chat-window-header');
    const chatHistoryContainer = document.getElementById('chat-history-container');
    const chatInput = document.getElementById('chat-input-admin');
    const sendBtn = document.getElementById('send-chat-admin-btn');
    const searchInput = document.getElementById('client-chat-search');
    
    let allClients = [];
    let allChats = [];
    let activeChatId = null;

    async function loadAllData() {
        try {
            const [clientsRes, anonChatsRes, clientChatsRes] = await Promise.all([
                supabase.from('clients').select('id, name, phone'),
                supabase.rpc('get_anonymous_chats'),
                supabase.rpc('get_client_chats')
            ]);

            if (clientsRes.error) throw clientsRes.error;
            if (anonChatsRes.error) throw anonChatsRes.error;
            if (clientChatsRes.error) throw clientChatsRes.error;

            allClients = clientsRes.data || [];

            const anonymousChats = anonChatsRes.data.map(c => ({ ...c, is_anonymous: true, name: `Анонимный чат #${c.anonymous_chat_id.slice(5, 10)}`, id: c.anonymous_chat_id }));
            const clientChats = clientChatsRes.data.map(c => {
                const client = allClients.find(cli => cli.id === c.client_id);
                return { ...c, is_anonymous: false, name: client?.name || 'Неизвестный клиент', phone: client?.phone, id: c.client_id };
            });

            allChats = [...anonymousChats, ...clientChats];
            allChats.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
            renderChatList();
        } catch (err) { console.error('Ошибка загрузки данных:', err); }
    }

    function renderChatList(filter = '') {
        chatListContainer.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        const filteredChats = filter ? allChats.filter(c => c.name.toLowerCase().includes(lowerFilter) || (c.last_message_text && c.last_message_text.toLowerCase().includes(lowerFilter))) : allChats;
        if (filteredChats.length === 0) { chatListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">Чаты не найдены</p>'; return; }
        filteredChats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            item.dataset.chatId = chat.id;
            const avatarClass = chat.is_anonymous ? 'anonymous' : 'user';
            const avatarText = chat.is_anonymous ? '?' : (chat.name ? chat.name.charAt(0).toUpperCase() : '?');
            const subtitle = chat.is_anonymous ? (chat.last_message_text || '...') : (chat.phone || 'Нет номера');
            item.innerHTML = `<div class="chat-avatar ${avatarClass}">${avatarText}</div><div class="chat-info"><div class="chat-name">${chat.name}</div><div class="last-message">${subtitle}</div></div>`;
            item.addEventListener('click', () => openChat(chat.id));
            chatListContainer.appendChild(item);
        });
    }
    
    function handleMessageUpdate(payload) {
        const updatedMessage = payload.new;
        const messageElement = document.querySelector(`.chat-message[data-message-id="${updatedMessage.id}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement && updatedMessage.is_read) {
                statusElement.innerHTML = '✓✓';
                statusElement.classList.add('read');
            }
        }
    }

    async function openChat(chatId) {
        activeChatId = chatId;
        const chat = allChats.find(c => c.id === chatId);
        if (!chat) return;
        supabase.from('support_messages').update({ is_read: true }).eq(chat.is_anonymous ? 'anonymous_chat_id' : 'client_id', chatId).eq('sender', 'user').eq('is_read', false).then(({ error }) => { if (error) console.error("Ошибка пометки сообщений как прочитанных:", error); });
        chatWindowHeader.textContent = chat.name;
        document.querySelectorAll('.chat-list-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`.chat-list-item[data-chat-id="${chatId}"]`)?.classList.add('active');
        chatHistoryContainer.innerHTML = '<p style="text-align:center;">Загрузка...</p>';
        let query = supabase.from('support_messages').select('*').order('created_at');
        query = chat.is_anonymous ? query.eq('anonymous_chat_id', chatId) : query.eq('client_id', chatId);
        const { data, error } = await query;
        chatHistoryContainer.innerHTML = '';
        if (error) { chatHistoryContainer.textContent = 'Ошибка загрузки'; return; }
        data.forEach(msg => renderMessage(msg, false));
        chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
    }
    
    function renderMessage(message, doScroll = true) {
        const time = new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${message.sender === 'admin' ? 'admin-message' : 'client-message'}`;
        msgDiv.dataset.messageId = message.id;
        let contentHTML = '';
        if (message.file_url) {
            contentHTML = message.file_type?.startsWith('image/') ? `<img src="${message.file_url}" style="max-width: 100%; border-radius: 12px; cursor: pointer;" onclick="window.open('${message.file_url}', '_blank')">` : `<a href="${message.file_url}" target="_blank" style="color: inherit; text-decoration: underline;">Прикрепленный файл: ${message.message_text || 'файл'}</a>`;
        } else {
            contentHTML = `<div class="message-text">${message.message_text}</div>`;
        }
        let statusIcon = '';
        if (message.sender === 'admin') {
            const readClass = message.is_read ? 'read' : '';
            const checkmarks = message.is_read ? '✓✓' : '✓';
            statusIcon = `<span class="message-status ${readClass}">${checkmarks}</span>`;
        }
        msgDiv.innerHTML = `${contentHTML}<div class="message-meta">${time}${statusIcon}</div>`;
        chatHistoryContainer.appendChild(msgDiv);
        if (doScroll) chatHistoryContainer.scrollTo({ top: chatHistoryContainer.scrollHeight, behavior: 'smooth' });
    }
    
    async function sendMessage(text, file = null) {
        if ((!text && !file) || !activeChatId) return;
        const chat = allChats.find(c => c.id === activeChatId);
        if (!chat) return;
        chatInput.disabled = true; sendBtn.disabled = true;
        let fileUrl = null, fileType = null, messageText = text;
        if (file) {
            // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
            // 1. Вытаскиваем расширение файла (например, 'jpg')
            const fileExt = file.name.split('.').pop();
            // 2. Создаем НОВОЕ, БЕЗОПАСНОЕ имя файла из цифр и расширения
            const fileName = `${Date.now()}.${fileExt}`;
            // 3. Собираем путь к файлу с новым безопасным именем
            const filePath = `admin_uploads/${fileName}`;
            // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

            const { error: uploadError } = await supabase.storage.from('support_files').upload(filePath, file);
            if (uploadError) { alert('Не удалось загрузить файл: ' + uploadError.message); chatInput.disabled = false; sendBtn.disabled = false; return; }
            const { data: urlData } = supabase.storage.from('support_files').getPublicUrl(filePath);
            fileUrl = urlData.publicUrl; fileType = file.type;
            if (!messageText) messageText = file.name;
        }
        const payload = { sender: 'admin', message_text: messageText, file_url: fileUrl, file_type: fileType, client_id: chat.is_anonymous ? null : activeChatId, anonymous_chat_id: chat.is_anonymous ? activeChatId : null, is_read: false };
        const { error } = await supabase.from('support_messages').insert(payload);
        if (error) alert('Не удалось отправить сообщение: ' + error.message);
        else chatInput.value = '';
        chatInput.disabled = false; sendBtn.disabled = false; chatInput.focus();
    }

    searchInput.addEventListener('input', (e) => renderChatList(e.target.value));
    sendBtn.addEventListener('click', () => sendMessage(chatInput.value.trim()));
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(chatInput.value.trim()); } });
    const adminAttachBtn = document.getElementById('chat-attach-btn-admin');
    const adminFileInput = document.getElementById('chat-file-input-admin');
    if (adminAttachBtn && adminFileInput) {
        adminAttachBtn.addEventListener('click', () => adminFileInput.click());
        adminFileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) sendMessage(file.name, file); e.target.value = null; });
    }

    // --- ЕДИНАЯ ПОДПИСКА НА ВСЕ ИЗМЕНЕНИЯ В ЧАТЕ ---
    const supportChannel = supabase.channel('admin-support-channel'); // Уникальное имя для канала

    supportChannel
      .on('postgres_changes', {
        event: '*', // Слушаем ВСЁ: INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'support_messages'
      }, payload => {

        console.log('Пришло обновление из чата:', payload);

        // Действие 1: ВСЕГДА обновляем список чатов слева.
        // Это нужно, чтобы новые чаты появлялись и старые поднимались наверх.
        loadAllData();

        // Действие 2: Если событие - это вставка НОВОГО сообщения...
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new;
          const messageChatId = newMessage.client_id || newMessage.anonymous_chat_id;

          // ...и это сообщение для ТЕКУЩЕГО ОТКРЫТОГО чата...
          if (activeChatId && messageChatId === activeChatId) {
            // ...то мы рисуем его в окне.
            renderMessage(newMessage);
          }
        }

        // Действие 3: Если событие - это ОБНОВЛЕНИЕ сообщения (например, прочитали)...
        if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new;
            const messageChatId = updatedMessage.client_id || updatedMessage.anonymous_chat_id;

            // ...и это сообщение в ТЕКУЩЕМ ОТКРЫТОМ чате...
            if (activeChatId && messageChatId === activeChatId) {
                // ...то обновляем его статус (галочки).
                handleMessageUpdate(payload);
            }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('УСПЕШНО ПОДПИСАН НА ВСЕ ОБНОВЛЕНИЯ ЧАТА ПОДДЕРЖКИ!');
        }
      });

    loadAllData();

    // --- Page Transitions ---
    function handlePageTransitions() {
        // Add exit animation when navigating away
        document.querySelectorAll('a[href]').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && (href.includes('admin.html') || href.includes('admin_support.html'))) {
                    e.preventDefault();
                    const adminApp = document.getElementById('admin-app');
                    adminApp.classList.add('page-transition-exit');

                    setTimeout(() => {
                        window.location.href = href;
                    }, 300);
                }
            });
        });

        // Add enter animation on page load
        const adminApp = document.getElementById('admin-app');
        adminApp.classList.add('page-transition-enter');
    }

    handlePageTransitions();
});
