import {
    getClient,
    getPaymentMethodDetails,
    savePaymentMethod,
    updateUserCity,
    getPendingContracts,
    getContractDetails,
    confirmContractSignature,
    getSupportMessages,
    sendSupportMessage,
    markSupportMessagesRead,
} from './api.js?v=13.1';
import './sse-client.js?v=13.1';

const state = {
    userId: null,
    user: null,
    anonymousChatId: null,
    notifications: [],
    cardUpdating: false,
    supportInitialized: false,
    supportMessages: [],
};

const elements = {};
const toastTimers = new Map();

function $(selector, scope = document) {
    return scope.querySelector(selector);
}

function $all(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
}

function initElements() {
    elements.namePlaceholder = $('#user-name-placeholder');
    elements.userIdLabel = $('.user-id');
    elements.cardContainer = $('#card-view-container');
    elements.notificationsBadge = $('#notifications-count');
    elements.notificationsList = $('#notifications-list');
    elements.contractModal = $('#contract-modal');
    elements.contractContent = $('#contract-content');
    elements.signatureCanvas = $('#signature-canvas');
    elements.supportModal = $('#support-modal');
    elements.chatHistory = $('#chat-history');
    elements.chatInput = $('#chat-input');
    elements.sendChatBtn = $('#send-chat-btn');
    elements.chatAttachBtn = $('#chat-attach-btn');
    elements.chatAttachMenu = $('#chat-attach-menu');
    elements.attachPhotoBtn = $('#attach-photo-btn');
    elements.attachFileBtn = $('#attach-file-btn');
    elements.chatFileInput = $('#chat-file-input');
    elements.cityOptions = $all('.city-option');
    elements.cityModal = $('#payment-settings-modal');
    elements.cardSavedToast = $('#card-saved-toast');
}

function showToast(id, duration = 2800) {
    const toast = document.getElementById(id);
    if (!toast) return;

    toast.classList.remove('hidden');
    if (toastTimers.has(id)) {
        clearTimeout(toastTimers.get(id));
    }

    const timer = setTimeout(() => {
        toast.classList.add('hidden');
        toastTimers.delete(id);
    }, duration);

    toastTimers.set(id, timer);
}

function updateUserBanner(user) {
    if (elements.namePlaceholder && typeof user?.name === 'string') {
        const firstName = user.name.split(' ')[0];
        elements.namePlaceholder.textContent = firstName || user.name || 'Пользователь';
    }

    if (elements.userIdLabel && state.userId) {
        elements.userIdLabel.textContent = `ID: ${String(state.userId).slice(-8)}`;
    }
}

async function handleAddCardClick() {
    if (!state.userId || state.cardUpdating) return;

    state.cardUpdating = true;
    const addBtn = $('#add-card-btn');
    const originalText = addBtn?.textContent;
    if (addBtn) {
        addBtn.disabled = true;
        addBtn.textContent = 'Создаем ссылку...';
    }

    try {
        const response = await savePaymentMethod(state.userId);
        if (response?.confirmation_url) {
            window.location.href = response.confirmation_url;
            return;
        }
        throw new Error('Не удалось получить ссылку для привязки карты.');
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    } finally {
        state.cardUpdating = false;
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = originalText || 'Привязать карту';
        }
    }
}

function renderCardPlaceholder() {
    if (!elements.cardContainer) return;
    elements.cardContainer.innerHTML = `
        <div id="card-form-view">
            <p style="margin-bottom: 20px; color: var(--dark-green);">
                У вас еще нет привязанной карты. После первой успешной оплаты она появится здесь автоматически,
                либо вы можете привязать карту прямо сейчас.
            </p>
            <button class="btn btn-primary" id="add-card-btn" style="width: 100%;">Привязать карту</button>
        </div>
    `;
    $('#add-card-btn')?.addEventListener('click', handleAddCardClick);
}

function renderCardDetails(paymentMethod) {
    if (!elements.cardContainer) return;
    let title = 'Способ оплаты привязан';
    let subtitle = 'Карта для автосписаний';

    if (paymentMethod?.type === 'bank_card' && paymentMethod?.card) {
        const last4 = paymentMethod.card.last4 || '****';
        title = `**** **** **** ${last4}`;
        subtitle = paymentMethod.card.card_type || 'Банковская карта';
    } else if (paymentMethod?.type === 'sbp') {
        title = 'Система быстрых платежей';
        subtitle = 'Счет СБП';
    } else if (paymentMethod?.display_name) {
        title = paymentMethod.display_name;
    }

    elements.cardContainer.innerHTML = `
        <div id="card-display-view">
            <div class="card-preview">
                <div class="card-number">${title}</div>
                <div class="card-details">
                    <span>${subtitle}</span>
                    <span>Привязана</span>
                </div>
            </div>
        </div>
    `;
}

async function updateCardView(force = false) {
    if (!elements.cardContainer || !state.userId) return;
    if (state.cardUpdating && !force) return;

    try {
        const result = await getPaymentMethodDetails(state.userId);
        const method = result?.payment_method;
        if (method) {
            renderCardDetails(method);
        } else {
            renderCardPlaceholder();
        }
    } catch (error) {
        renderCardPlaceholder();
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.add('hidden');
    }
}

function setupSignatureCanvas(rentalId, action) {
    const canvas = elements.signatureCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let drawing = false;
    const getCoords = (e) => {
        const rect = canvas.getBoundingClientRect();
        const point = e.touches ? e.touches[0] : e;
        return {
            x: point.clientX - rect.left,
            y: point.clientY - rect.top,
        };
    };

    const startDrawing = (event) => {
        event.preventDefault();
        drawing = true;
        const { x, y } = getCoords(event);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const drawLine = (event) => {
        if (!drawing) return;
        event.preventDefault();
        const { x, y } = getCoords(event);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        drawing = false;
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', drawLine);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', drawLine, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    const clearBtn = $('#clear-signature-btn');
    const signBtn = $('#sign-contract-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height), { once: true });
    }
    if (signBtn) {
        signBtn.textContent = action === 'confirm-return-act' ? 'Подписал акт' : 'Подписал';
        signBtn.addEventListener('click', async () => {
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const hasSignature = pixels.some((value) => value !== 0);
            if (!hasSignature) {
                alert('Пожалуйста, оставьте подпись на холсте.');
                return;
            }

            try {
                signBtn.disabled = true;
                signBtn.textContent = 'Отправляем...';
                const signatureData = canvas.toDataURL('image/png');
                await confirmContractSignature({
                    userId: state.userId,
                    rentalId,
                    signatureData,
                    action,
                });
                alert(action === 'confirm-return-act' ? 'Акт сдачи подписан!' : 'Договор подписан!');
                closeModal(elements.contractModal);
                await updateNotifications();
                // Удаляем индикатор уведомлений после подписания
                const profileNav = document.querySelector('a[href="profile.html"]') || 
                                  document.querySelector('.nav-item a[href$="profile.html"]');
                if (profileNav) {
                    profileNav.classList.remove('has-notification');
                }
            } catch (error) {
                alert(`Ошибка: ${error.message}`);
            } finally {
                signBtn.disabled = false;
                signBtn.textContent = action === 'confirm-return-act' ? 'Подписал акт' : 'Подписал';
            }
        }, { once: true });
    }
}

function formatPassport(passport = {}) {
    if (!passport) return 'N/A';
    const series = passport.series?.replace(/\s/g, '') || '';
    const number = passport.number?.replace(/\s/g, '') || '';
    const formatted = series && number ? `${series} ${number}` : passport.full_number || 'N/A';
    return formatted;
}

function bicycleBatteryNumbers(rental) {
    const batteries = rental?.rental_batteries;
    if (Array.isArray(batteries) && batteries.length > 0) {
        return batteries.map((item) => item?.batteries?.serial_number).filter(Boolean).join(', ');
    }
    const bike = rental?.bikes;
    if (Array.isArray(bike?.battery_numbers)) {
        return bike.battery_numbers.join(', ');
    }
    return bike?.battery_numbers || 'N/A';
}

function generateContractHTML(rental) {
    const now = new Date();
    const client = rental?.clients || {};
    const bike = rental?.bikes || {};
    const passport = client?.recognized_passport_data || {};

    return `
        <div style="text-align: center; font-weight: bold; font-size: 1.2em; margin-bottom: 20px;">
            Акт приема-передачи<br>
            (Приложение №1 к Договору проката)
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9em;">
            <span>г. ${client.city || 'Москва'}</span>
            <span>${now.toLocaleDateString('ru-RU')}</span>
        </div>
        <h4 style="margin-bottom: 10px;">1. Оборудование</h4>
        <table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9em;">
            <tbody>
                <tr><th style="padding: 8px; width: 40%;">Наименование</th><td style="padding: 8px;">${bike.model_name || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номер рамы</th><td style="padding: 8px;">${bike.frame_number || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номера аккумуляторов</th><td style="padding: 8px;">${bicycleBatteryNumbers(rental)}</td></tr>
                <tr><th style="padding: 8px;">Рег. номер</th><td style="padding: 8px;">${bike.registration_number || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номер IOT</th><td style="padding: 8px;">${bike.iot_device_id || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Доп. оборудование</th><td style="padding: 8px;">${bike.additional_equipment || 'N/A'}</td></tr>
            </tbody>
        </table>
        <h4 style="margin-bottom: 10px;">2. Арендатор</h4>
        <table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9em;">
            <tbody>
                <tr><th style="padding: 8px; width: 40%;">ФИО</th><td style="padding: 8px;">${client.name || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Дата рождения</th><td style="padding: 8px;">${passport.birth_date || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Паспорт</th><td style="padding: 8px;">${formatPassport(passport)}</td></tr>
                <tr><th style="padding: 8px;">Кем выдан</th><td style="padding: 8px;">${passport.issuing_authority || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Дата выдачи</th><td style="padding: 8px;">${passport.issue_date || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Адрес регистрации</th><td style="padding: 8px;">${passport.registration_address || 'N/A'}</td></tr>
            </tbody>
        </table>
        <p style="font-size: 0.9em;">
            Инструктаж пройден, с условиями согласен, техника и оборудование комплектны, на момент передачи исправны, нареканий нет.
        </p>
    `;
}

function generateReturnActHTML(rental, defects = []) {
    const now = new Date();
    const client = rental?.clients || {};
    const bike = rental?.bikes || {};
    const passport = client?.recognized_passport_data || {};
    const extraData = rental?.extra_data || {};
    const defectsMarkup = Array.isArray(defects) && defects.length > 0
        ? `<h4 style="margin-top: 20px; margin-bottom: 10px;">Выявленные неисправности</h4>
           <ul style="padding-left: 18px; font-size: 0.9em;">${defects.map((item) => `<li>${item}</li>`).join('')}</ul>`
        : '<p style="font-size: 0.9em; margin-top: 20px;">Неисправности на момент сдачи не выявлены.</p>';

    // Проверяем, есть ли подпись в данных аренды
    const returnActSignatureData = extraData?.return_act_signature_data;
    const returnActSignedAt = extraData?.return_act_signed_at;
    
    let signatureSection = '';
    if (returnActSignatureData) {
        // Подпись уже была проставлена
        const signedAt = returnActSignedAt ? new Date(returnActSignedAt).toLocaleString('ru-RU') : now.toLocaleString('ru-RU');
        signatureSection = `
            <div style="margin-top: 20px; page-break-inside: avoid;">
                <h4>Подпись Арендатора:</h4>
                <div style="border: 1px solid #ddd; padding: 10px; max-width: 300px; margin: 10px auto;">
                    <img src="${returnActSignatureData}" alt="Подпись при возврате" style="max-width: 100%; height: auto; display: block;"/>
                </div>
                <p style="text-align: center; font-size: 0.9em; margin-top: 10px;">
                    <small>Дата подписания: ${signedAt}</small>
                </p>
            </div>
        `;
    } else {
        // Подпись еще не проставлена
        signatureSection = `
            <div style="margin-top: 20px;">
                <h4>Подпись Арендатора:</h4>
                <div style="border: 1px solid #ddd; padding: 20px; text-align: center; background-color: #f9f9f9; min-height: 80px; display: flex; align-items: center; justify-content: center;">
                    <p style="color: #888; margin: 0;">Подпись будет размещена здесь после подтверждения</p>
                </div>
            </div>
        `;
    }

    return `
        <div style="text-align: center; font-weight: bold; font-size: 1.2em; margin-bottom: 20px;">
            Акт приема-передачи (возврата)<br>
            (Приложение №2 к Договору проката)
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9em;">
            <span>г. ${client.city || 'Москва'}</span>
            <span>${now.toLocaleDateString('ru-RU')}</span>
        </div>
        <h4 style="margin-bottom: 10px;">1. Оборудование</h4>
        <table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9em;">
            <tbody>
                <tr><th style="padding: 8px; width: 40%;">Наименование</th><td style="padding: 8px;">${bike.model_name || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номер рамы</th><td style="padding: 8px;">${bike.frame_number || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номера аккумуляторов</th><td style="padding: 8px;">${bicycleBatteryNumbers(rental)}</td></tr>
                <tr><th style="padding: 8px;">Рег. номер</th><td style="padding: 8px;">${bike.registration_number || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Номер IOT</th><td style="padding: 8px;">${bike.iot_device_id || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Доп. оборудование</th><td style="padding: 8px;">${bike.additional_equipment || 'N/A'}</td></tr>
            </tbody>
        </table>
        <h4 style="margin-bottom: 10px;">2. Арендатор</h4>
        <table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9em;">
            <tbody>
                <tr><th style="padding: 8px; width: 40%;">ФИО</th><td style="padding: 8px;">${client.name || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Дата рождения</th><td style="padding: 8px;">${passport.birth_date || 'N/A'}</td></tr>
                <tr><th style="padding: 8px;">Паспорт</th><td style="padding: 8px;">${formatPassport(passport)}</td></tr>
                <tr><th style="padding: 8px;">Адрес регистрации</th><td style="padding: 8px;">${passport.registration_address || 'N/A'}</td></tr>
            </tbody>
        </table>
        ${defectsMarkup}
        ${signatureSection}
    `;
}

async function openContractModal(rentalId) {
    if (!elements.contractModal) return;
    try {
        const response = await getContractDetails(state.userId, rentalId);
        const rental = response?.rental;
        if (!rental) {
            throw new Error('Не удалось получить данные договора');
        }
        elements.contractContent.innerHTML = generateContractHTML(rental);
        elements.contractModal.classList.remove('hidden');
        setupSignatureCanvas(rentalId, 'confirm-contract');
    } catch (error) {
        alert(`Ошибка загрузки договора: ${error.message}`);
    }
}

async function openReturnActModal(rentalId) {
    if (!elements.contractModal) return;
    try {
        const response = await getContractDetails(state.userId, rentalId);
        const rental = response?.rental;
        if (!rental) {
            throw new Error('Не удалось получить данные акта');
        }
        const defects = rental?.extra_data?.defects || [];
        elements.contractContent.innerHTML = generateReturnActHTML(rental, defects);
        elements.contractModal.classList.remove('hidden');
        setupSignatureCanvas(rentalId, 'confirm-return-act');
    } catch (error) {
        alert(`Ошибка загрузки акта: ${error.message}`);
    }
}

function bindNotificationActions() {
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.matches('.sign-initial-contract-btn')) {
            const rentalId = target.dataset.rentalId;
            if (rentalId) {
                openContractModal(rentalId);
            }
        }
        if (target.matches('.sign-return-act-btn')) {
            const rentalId = target.dataset.rentalId;
            if (rentalId) {
                openReturnActModal(rentalId);
            }
        }
        if (target.matches('#contract-modal .modal-close')) {
            closeModal(elements.contractModal);
        }
    });
}

function renderNotifications(rentals) {
    if (!elements.notificationsList) return;

    if (!Array.isArray(rentals) || rentals.length === 0) {
        elements.notificationsList.innerHTML = '<p>У вас нет новых уведомлений.</p>';
        elements.notificationsBadge?.classList.add('hidden');
        return;
    }

    if (elements.notificationsBadge) {
        elements.notificationsBadge.textContent = String(rentals.length);
        elements.notificationsBadge.classList.remove('hidden');
    }

    elements.notificationsList.innerHTML = '';
    rentals.forEach((rental) => {
        const item = document.createElement('div');
        if (rental.status === 'awaiting_contract_signing') {
            item.className = 'notification-item';
            item.innerHTML = `
                <svg class="notification-bell-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <div class="notification-content">
                    <p>Необходимо подписать договор аренды для велосипеда.</p>
                    <button class="btn btn-primary sign-initial-contract-btn" data-rental-id="${rental.id}">
                        Подписать
                    </button>
                </div>
            `;
        } else if (rental.status === 'awaiting_return_signature') {
            item.className = 'notification-item'; // Для элементов с анимацией
            item.innerHTML = `
                <svg class="notification-bell-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <div class="notification-content">
                    <p>Необходимо подписать акт сдачи велосипеда.</p>
                    <button class="btn btn-primary sign-return-act-btn" data-rental-id="${rental.id}">
                        Подписать акт
                    </button>
                </div>
            `;
        } else {
            item.className = 'notification-item-alt'; // Для элементов без анимации
            item.innerHTML = `
                <svg class="notification-bell-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <div class="notification-content">
                    <p>Ожидается действие по аренде #${rental.id}.</p>
                </div>
            `;
        }
        elements.notificationsList.appendChild(item);
    });
}

async function updateNotifications() {
    if (!state.userId) return;
    try {
        const result = await getPendingContracts(state.userId);
        state.notifications = Array.isArray(result?.rentals) ? result.rentals : [];
        renderNotifications(state.notifications);
    } catch (error) {
        console.error('[Profile] Failed to fetch notifications:', error);
    }
}

function addChatMessage(message) {
    if (!elements.chatHistory) return;

    const container = document.createElement('div');
    container.className = 'chat-message';
    container.dataset.messageId = message.id || '';

    if (message.sender === 'admin') {
        container.classList.add('support-message');
    } else {
        container.classList.add('user-message');
    }

    const createdAt = new Date(message.created_at);
    const timeLabel = createdAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    container.innerHTML = `
        <div class="message-text">${message.message_text || ''}</div>
        <div class="message-meta">
            <span class="message-time">${timeLabel}</span>
            ${message.sender === 'user' ? `<span class="message-status ${message.is_read ? 'read' : ''}">${message.is_read ? '✓✓' : '✓'}</span>` : ''}
        </div>
    `;

    elements.chatHistory.appendChild(container);
    elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
}

async function loadSupportMessages() {
    if (!state.userId && !state.anonymousChatId) return;
    if (!elements.chatHistory) return;

    try {
        const response = await getSupportMessages({
            userId: state.userId,
            anonymousChatId: state.userId ? null : state.anonymousChatId,
        });
        const messages = Array.isArray(response?.messages) ? response.messages : [];
        state.supportMessages = messages;
        elements.chatHistory.innerHTML = '';
        messages.forEach(addChatMessage);
        if (messages.some((msg) => msg.sender === 'admin')) {
            await markSupportMessagesRead({
                userId: state.userId,
                anonymousChatId: state.userId ? null : state.anonymousChatId,
            }).catch(() => {});
        }
    } catch (error) {
        console.error('[Profile] Failed to load support messages:', error);
        elements.chatHistory.innerHTML = '<p style="color: #e53e3e; text-align:center;">Не удалось загрузить чат.</p>';
    }
}

async function sendChatMessage(text) {
    if (!text) return;
    if (!elements.chatHistory || !state.userId) return;

    const tempMessage = {
        id: `temp-${Date.now()}`,
        sender: 'user',
        message_text: text,
        created_at: new Date().toISOString(),
        is_read: false,
    };

    addChatMessage(tempMessage);
    try {
        const response = await sendSupportMessage({
            userId: state.userId,
            messageText: text,
        });
        if (response?.message) {
            // replace temp message with actual (simplify by reloading)
            await loadSupportMessages();
        }
    } catch (error) {
        alert(`Не удалось отправить сообщение: ${error.message}`);
    }
}

function initializeSupportChat() {
    if (!elements.supportModal) return;
    if (!state.supportInitialized) {
        state.supportInitialized = true;

        if (elements.sendChatBtn && elements.chatInput) {
            elements.sendChatBtn.addEventListener('click', () => {
                const text = elements.chatInput.value.trim();
                if (!text) return;
                elements.chatInput.value = '';
                sendChatMessage(text);
            });
            elements.chatInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    const text = elements.chatInput.value.trim();
                    if (!text) return;
                    elements.chatInput.value = '';
                    sendChatMessage(text);
                }
                        });
                    }
            
                    if (elements.chatAttachBtn && elements.chatFileInput) {
                        elements.chatAttachBtn.addEventListener('click', () => {
                            elements.chatFileInput.click();
                        });
            
                        elements.chatFileInput.addEventListener('change', (event) => {
                            handleFileUpload(event.target.files);
                            event.target.value = ''; // Allow re-selecting the same file
                        });
                    }
                }
            
                loadSupportMessages();
}

async function handleFileUpload(files) {
    if (!files || files.length === 0) return;
    
    for (const file of files) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (state.userId) {
                formData.append('clientId', state.userId);
            } else {
                formData.append('anonymousChatId', state.anonymousChatId);
            }
            
            const response = await fetch('/api/upload-support-attachment', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to upload file');
            }
            
            const result = await response.json();
            // Send the file URL as a message
            await sendChatMessage(result.publicUrl);
        } catch (error) {
            console.error('Error uploading file:', error);
            showNotification('Ошибка загрузки файла: ' + error.message);
        }
    }
}

// Modified sendChatMessage to handle file URLs
async function sendChatMessage(text) {
    if (!text.trim() && !text.startsWith('http')) return; // Allow file URLs to be sent even if they appear empty
    
    const timestamp = new Date().toISOString();
    const messageData = {
        text: text,
        timestamp: timestamp,
        isFromUser: true
    };
    
    // Add to UI immediately for better UX
    addChatMessage(messageData);
    
    try {
        // Send to support backend
        const response = await fetch('/api/send-support-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: state.userId || null,
                anonymousChatId: state.anonymousChatId || null,
                message: text,
                timestamp: timestamp
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send message');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        // TODO: Handle error (remove sent message or mark as failed)
    }
}

// Modified addChatMessage to handle different file types
function addChatMessage(messageData) {
    if (!elements.chatMessagesContainer) return;
    
    const isFromUser = messageData.isFromUser;
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isFromUser ? 'user-message' : 'support-message'}`;
    
    // Check if the message is a file URL
    if (messageData.text.startsWith('http')) {
        const fileUrl = messageData.text;
        const fileExtension = fileUrl.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
        const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(fileExtension);
        
        if (isImage) {
            messageElement.innerHTML = `
                <div class="chat-file-content">
                    <a href="${fileUrl}" target="_blank">
                        <img src="${fileUrl}" alt="Вложение" class="chat-image-preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
                    </a>
                    <div class="chat-file-name">Изображение</div>
                </div>
            `;
        } else if (isVideo) {
            messageElement.innerHTML = `
                <div class="chat-file-content">
                    <video controls class="chat-video-preview" style="max-width: 200px; border-radius: 8px;">
                        <source src="${fileUrl}" type="video/${fileExtension}">
                        Ваш браузер не поддерживает видео.
                    </video>
                    <div class="chat-file-name">Видео</div>
                </div>
            `;
        } else {
            // For other file types, show a download link
            const fileName = fileUrl.split('/').pop() || 'Файл';
            messageElement.innerHTML = `
                <div class="chat-file-content">
                    <a href="${fileUrl}" target="_blank" class="chat-file-link" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f0f9fd; border-radius: 8px; text-decoration: none; color: #1CB5E0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>${fileName}</span>
                    </a>
                </div>
            `;
        }
    } else {
        // Regular text message
        messageElement.textContent = messageData.text;
    }
    
    // Add timestamp
    const timestampElement = document.createElement('div');
    timestampElement.className = 'chat-timestamp';
    timestampElement.textContent = formatTime(messageData.timestamp);
    messageElement.appendChild(timestampElement);
    
    elements.chatMessagesContainer.appendChild(messageElement);
    elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
}

async function updatePaymentSettingsView() {
    if (!elements.cityOptions.length) return;
    let activeCity = localStorage.getItem('selectedCity') || 'Москва';

    if (state.user?.city) {
        activeCity = state.user.city;
        localStorage.setItem('selectedCity', activeCity);
    }

    elements.cityOptions.forEach((option) => {
        const city = option.dataset.city;
        const checkIcon = $('.city-check', option);
        if (city === activeCity) {
            option.classList.add('selected');
            checkIcon?.classList.remove('hidden');
        } else {
            option.classList.remove('selected');
            checkIcon?.classList.add('hidden');
        }
    });
}

function bindCitySelection() {
    if (!elements.cityOptions.length) return;
    elements.cityOptions.forEach((option) => {
        option.addEventListener('click', async () => {
            const selectedCity = option.dataset.city;
            if (!selectedCity || !state.userId) return;

            try {
                await updateUserCity(state.userId, selectedCity);
                state.user = { ...state.user, city: selectedCity };
                localStorage.setItem('selectedCity', selectedCity);
                updatePaymentSettingsView();
                setTimeout(() => closeModal(elements.cityModal), 300);
            } catch (error) {
                console.error('[Profile] Failed to update city:', error);
                alert('Не удалось сохранить город. Попробуйте позже.');
            }
        });
    });
}

function setupModals() {
    const modals = $all('.modal-overlay');
    const triggers = $all('[data-modal-target]');
    const closeButtons = $all('.modal-close');

    const openModal = (id) => {
        const modal = document.getElementById(id);
        if (!modal) return;

        switch (id) {
            case 'card-modal':
                updateCardView();
                break;
            case 'payment-settings-modal':
                updatePaymentSettingsView();
                break;
            case 'notifications-modal':
                // При открытии модального окна уведомлений удаляем индикатор с навигации
                // Сначала проверяем локальный элемент, затем обновляем в родительской странице
                const profileNav = document.querySelector('nav .nav-item.active');
                if (profileNav) {
                    profileNav.classList.remove('has-notification');
                }
                // Также пробуем обновить в родительском окне (на главной странице)
                if (window.parent && window.parent !== window) {
                    try {
                        const parentProfileNav = window.parent.document.querySelector('a[href="profile.html"]');
                        if (parentProfileNav) {
                            parentProfileNav.classList.remove('has-notification');
                        }
                    } catch(e) {
                        // Если доступ к родительскому окну запрещен, игнорируем
                    }
                } else {
                    // В обычном контексте (не в iframe)
                    const mainProfileNav = document.querySelector('a[href="profile.html"]') || 
                                          document.querySelector('.nav-item a[href$="profile.html"]');
                    if (mainProfileNav) {
                        mainProfileNav.classList.remove('has-notification');
                    }
                }
                updateNotifications();
                break;
            case 'support-modal':
                initializeSupportChat();
                break;
            default:
                break;
        }

        modal.classList.remove('hidden');
    };

    triggers.forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = trigger.dataset.modalTarget;
            if (targetId) {
                openModal(targetId);
            }
        });
    });

    closeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            closeModal(button.closest('.modal-overlay'));
        });
    });

    modals.forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal(modal);
            }
        });
    });

    // Expose for external links (hash navigation)
    window.openProfileModal = openModal;
}

function handleDeepLinks() {
    if (window.location.hash === '#support') {
        setTimeout(() => window.openProfileModal?.('support-modal'), 250);
    }
    if (window.location.hash === '#card-modal') {
        setTimeout(() => window.openProfileModal?.('card-modal'), 250);
    }
    if (window.location.hash === '#notifications') {
        setTimeout(() => window.openProfileModal?.('notifications-modal'), 250);
    }

    const query = new URLSearchParams(window.location.search);
    if (query.get('open') === 'notifications') {
        setTimeout(() => window.openProfileModal?.('notifications-modal'), 250);
    }
    if (query.get('open') === 'return_act') {
        // Открытие акта возврата с указанным rentalId
        const rentalId = query.get('rental');
        if (rentalId) {
            setTimeout(() => openReturnActModal(rentalId), 250);
        }
    }
    if (query.get('card_saved') === 'true') {
        showToast('card-saved-toast');
        query.delete('card_saved');
        const newUrl = `${window.location.pathname}?${query.toString()}`.replace(/\?$/, '');
        window.history.replaceState({}, document.title, newUrl);
    }
}

function bindLogout() {
    const logoutBtn = $('#logout-btn');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', () => {
        if (confirm('Выйти из аккаунта?')) {
            localStorage.clear();
            window.location.replace('registration.html');
        }
    });
}

async function bootstrap() {
    const storedId = localStorage.getItem('userId');
    state.userId = storedId && !Number.isNaN(Number(storedId)) ? Number(storedId) : storedId;

    if (localStorage.getItem('isRegistered') !== 'true' || !state.userId) {
        localStorage.clear();
        window.location.replace('registration.html');
        return;
    }

    state.anonymousChatId = localStorage.getItem('anonymousChatId');
    if (!state.anonymousChatId) {
        state.anonymousChatId = `anon_${crypto.randomUUID()}`;
        localStorage.setItem('anonymousChatId', state.anonymousChatId);
    }

    try {
        state.user = await getClient(state.userId);
        if (!state.user) {
            localStorage.clear();
            window.location.replace('registration.html');
            return;
        }
        updateUserBanner(state.user);
    } catch (error) {
        console.error('[Profile] Failed to load user:', error);
        alert('Не удалось загрузить профиль. Авторизуйтесь заново.');
        localStorage.clear();
        window.location.replace('registration.html');
        return;
    }

    // Подключаемся к SSE
    connectProfileSSE(state.userId);
    
    updateCardView();
    bindCitySelection();
    bindNotificationActions();
    bindLogout();
    handleDeepLinks();
    updateNotifications();
}

// SSE клиент для профиля
let profileSSEClient = null;

// Функция для подключения к SSE в профиле
function connectProfileSSE(userId) {
    if (typeof window.SSEClient !== 'undefined') {
        profileSSEClient = new window.SSEClient(userId);
        
        // Обработчики SSE событий для профиля
        profileSSEClient.on('rental_update', async (data) => {
            console.log('Получено обновление аренды в профиле:', data);
            await updateNotifications();
        });
        
        profileSSEClient.on('balance_update', (data) => {
            console.log('Получено обновление баланса в профиле:', data);
            // Обновление баланса на странице профиля может реализоваться позже
        });
        
        profileSSEClient.on('connected', (data) => {
            console.log('SSE соединение установлено в профиле:', data);
        });
        
        profileSSEClient.connect();
    } else {
        console.warn('SSEClient не доступен в профиле');
    }
}

// Функция для отключения от SSE в профиле
function disconnectProfileSSE() {
    if (profileSSEClient) {
        profileSSEClient.disconnect();
        profileSSEClient = null;
    }
}

// Проверяем, возвращаемся ли из оплаты, и обрабатываем соответствующим образом
document.addEventListener('DOMContentLoaded', async () => {
    if (window.appBridge && window.appBridge.isInApp) {
        // Если мы возвращаемся из оплаты, предотвращаем стандартную загрузку
        if (window.appBridge.isReturnFromPayment()) {
            console.log('Обнаружен возврат из оплаты в профиле');
            // Устанавливаем небольшую задержку, чтобы обработать возврат
            setTimeout(() => {
                // Загружаем страницу профиля
                initElements();
                setupModals();
                bootstrap();
            }, 1000);
            return;
        }
    }
    // Стандартная загрузка страницы профиля
    initElements();
    setupModals();
    await bootstrap();
});
