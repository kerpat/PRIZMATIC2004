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
} from './api.js?v=13.5';
import './sse-client.js?v=13.5';
import { openSaveCardUrl } from './payment-helper.js?v=14.0';

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

function normalizeNameToken(token = '') {
    return token
        .split('-')
        .map((hyphenPart) =>
            hyphenPart
                .split("'")
                .map((segment) => {
                    const lower = segment.toLowerCase();
                    if (!lower.length) return '';
                    return lower.charAt(0).toUpperCase() + lower.slice(1);
                })
                .join("'")
        )
        .join('-');
}

function formatPersonName(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed
        .split(/\s+/)
        .map(normalizeNameToken)
        .join(' ');
}

function formatPassportData(passport = {}) {
    const clone = { ...passport };
    if (clone.full_name) clone.full_name = formatPersonName(clone.full_name) || clone.full_name;
    if (clone.first_name) clone.first_name = formatPersonName(clone.first_name) || clone.first_name;
    if (clone.last_name) clone.last_name = formatPersonName(clone.last_name) || clone.last_name;
    if (clone.middle_name) clone.middle_name = formatPersonName(clone.middle_name) || clone.middle_name;
    return clone;
}

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
        const formatted = formatPersonName(user.name) || user.name;
        const firstName = formatted.split(' ')[1] || formatted.split(' ')[0];
        elements.namePlaceholder.textContent = firstName || formatted || 'Пользователь';
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
            await openSaveCardUrl(response.confirmation_url);
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
    const displayName = formatPersonName(client.name) || client.name || 'N/A';
    const bike = rental?.bikes || {};
    const passport = formatPassportData(client?.recognized_passport_data);

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
                <tr><th style="padding: 8px; width: 40%;">ФИО</th><td style="padding: 8px;">${passport.full_name || displayName}</td></tr>
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
    const displayName = formatPersonName(client.name) || client.name || 'N/A';
    const bike = rental?.bikes || {};
    const passport = formatPassportData(client?.recognized_passport_data);
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
                <tr><th style="padding: 8px; width: 40%;">ФИО</th><td style="padding: 8px;">${passport.full_name || displayName}</td></tr>
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

function isSupportFileUrl(value) {
    return typeof value === 'string' && (/^https?:\/\//i.test(value) || value.startsWith('/api/'));
}

function extractSupportFileExtension(value) {
    if (typeof value !== 'string' || !value) return '';
    const pathMatch = value.match(/path=([^&]+)/);
    const candidate = pathMatch ? decodeURIComponent(pathMatch[1]) : value;
    const clean = candidate.split('#')[0];
    const lastSegment = clean.split('/').pop() || '';
    const [namePart] = lastSegment.split('?');
    const ext = namePart.includes('.') ? namePart.split('.').pop() : '';
    return (ext || '').toLowerCase();
}

function extractSupportFileName(value) {
    if (typeof value !== 'string' || !value) return 'Файл';
    const pathMatch = value.match(/path=([^&]+)/);
    const candidate = pathMatch ? decodeURIComponent(pathMatch[1]) : value;
    const clean = candidate.split('#')[0];
    const lastSegment = clean.split('/').pop() || 'Файл';
    return lastSegment || 'Файл';
}

function addChatMessage(message) {
    if (!elements.chatHistory) return;

    const text = message.message_text ?? message.text ?? '';
    const createdAt = message.created_at ? new Date(message.created_at) : new Date();
    const timeLabel = createdAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const container = document.createElement('div');
    container.className = 'chat-message';
    container.dataset.messageId = message.id || '';
    container.classList.add(message.sender === 'admin' || message.isFromSupport ? 'support-message' : 'user-message');

    const isUrl = isSupportFileUrl(text);
    let contentHtml = '';

    if (isUrl) {
        const fileExt = extractSupportFileExtension(text);
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExt);
        const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(fileExt);

        if (isImage) {
            contentHtml = `
                <div class="chat-file-content">
                    <a href="${text}" target="_blank">
                        <img src="${text}" alt="Вложение" class="chat-image-preview">
                    </a>
                </div>
            `;
        } else if (isVideo) {
            contentHtml = `
                <div class="chat-file-content">
                    <video controls class="chat-video-preview">
                        <source src="${text}" type="video/${fileExt}">
                    </video>
                </div>
            `;
        } else {
            // Определяем тип файла для отображения
            let fileLabel = '📎 Файл';
            if (['pdf'].includes(fileExt)) {
                fileLabel = '📄 PDF';
            } else if (['doc', 'docx'].includes(fileExt)) {
                fileLabel = '📝 Документ';
            } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExt)) {
                fileLabel = '🎵 Аудио';
            } else if (['zip', 'rar', '7z'].includes(fileExt)) {
                fileLabel = '📦 Архив';
            }
            
            contentHtml = `
                <div class="chat-file-content">
                    <a href="${text}" target="_blank" class="chat-file-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>${fileLabel}</span>
                    </a>
                </div>
            `;
        }
    } else {
        contentHtml = `<div class="message-text">${text || ''}</div>`;
    }

    container.innerHTML = `
        ${contentHtml}
        <div class="message-meta">
            <span class="message-time">${timeLabel}</span>
            ${message.sender === 'user' || message.isFromUser ? `<span class="message-status ${message.is_read ? 'read' : ''}">${message.is_read ? '✓✓' : '✓'}</span>` : ''}
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
    if (!elements.supportModal || state.supportInitialized) return;
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
            event.target.value = '';
        });
    }

    loadSupportMessages();
}

// Функция сжатия изображений
async function compressImage(file, maxWidth = 1920, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Пропорциональное изменение размера
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    }));
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handleFileUpload(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
        try {
            let processedFile = file;
            
            // Сжимаем изображения
            if (file.type.startsWith('image/')) {
                processedFile = await compressImage(file);
            }
            
            const formData = new FormData();
            formData.append('file', processedFile);
            
            // Проверяем, что у нас есть либо userId, либо anonymousChatId
            if (state.userId) {
                formData.append('clientId', state.userId);
            } else if (state.anonymousChatId) {
                formData.append('anonymousChatId', state.anonymousChatId);
            } else {
                // Если ни один из идентификаторов не задан, генерируем анонимный чат
                const anonymousId = localStorage.getItem('anonymousChatId') || 
                                   sessionStorage.getItem('anonymousChatId') || 
                                   'anonymous-' + Date.now();
                
                // Сохраняем ID анонимного чата для последующего использования
                if (!localStorage.getItem('anonymousChatId') && !sessionStorage.getItem('anonymousChatId')) {
                    sessionStorage.setItem('anonymousChatId', anonymousId);
                }
                
                formData.append('anonymousChatId', anonymousId);
            }

            const response = await fetch('/api/upload-support-attachment', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Не удалось загрузить файл');
            }

            const result = await response.json();
            if (result?.publicUrl) {
                // Определяем тип файла и отправляем сразу без названия
                let fileType = 'Файл';
                if (file.type.startsWith('image/')) {
                    fileType = '📷 Фото';
                } else if (file.type.startsWith('video/')) {
                    fileType = '🎥 Видео';
                } else if (file.type.startsWith('audio/')) {
                    fileType = '🎵 Аудио';
                } else if (file.type === 'application/pdf') {
                    fileType = '📄 PDF';
                }
                
                // Отправляем URL как текст (будет отображаться как ссылка с типом файла)
                await sendChatMessage(result.publicUrl);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Ошибка загрузки файла: ' + error.message);
        }
    }
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
    try {
        if (localStorage.getItem('openSupportAfterRedirect') === '1') {
            localStorage.removeItem('openSupportAfterRedirect');
            setTimeout(() => window.openProfileModal?.('support-modal'), 250);
        }
    } catch (error) {
        console.warn('[Profile] Не удалось прочитать флаг поддержки:', error);
    }

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
        const formattedUserName = formatPersonName(state.user.name);
        if (formattedUserName) {
            state.user.name = formattedUserName;
            try {
                localStorage.setItem('userName', formattedUserName);
            } catch (error) {
                console.warn('[Profile] Не удалось обновить имя в localStorage:', error);
            }
        }
        state.user.recognized_passport_data = formatPassportData(state.user.recognized_passport_data);
        updateUserBanner(state.user);
    } catch (error) {
        console.error('[Profile] Failed to load user:', error);
        
        // Если пользователь не найден - очищаем и перенаправляем без alert
        if (error.message && error.message.includes('not found')) {
            console.warn('[Profile] Клиент не найден в базе, очищаем данные');
            localStorage.clear();
            window.location.replace('registration.html');
            return;
        }
        
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

// Функция обновления данных пользователя
async function refreshUserData() {
    if (!state.userId) return;
    
    try {
        console.log('[Profile] Refreshing user data...');
        const freshUser = await getClient(state.userId);
        
        if (!freshUser) {
            console.warn('[Profile] User not found during refresh');
            return;
        }
        
        state.user = freshUser;
        updateUserBanner(freshUser);
        
        console.log('[Profile] User data refreshed successfully');
    } catch (error) {
        console.error('[Profile] Failed to refresh user data:', error);
    }
}

// SSE клиент для профиля
let profileSSEClient = null;

// Функция для подключения к SSE в профиле
function connectProfileSSE(userId) {
    if (typeof window.SSEClient !== 'undefined') {
        profileSSEClient = new window.SSEClient(userId);
        
        // Обработчики SSE событий для профиля
        profileSSEClient.on('rental_update', async (data) => {
            console.log('[Profile SSE] Получено обновление аренды:', data);
            // Обновляем данные пользователя для отображения актуального статуса
            await refreshUserData();
            await updateNotifications();
        });
        
        profileSSEClient.on('balance_update', async (data) => {
            console.log('[Profile SSE] Получено обновление баланса:', data);
            // Обновляем данные пользователя для отображения актуального баланса
            await refreshUserData();
        });
        
        profileSSEClient.on('support_message', async (data) => {
            console.log('[Profile SSE] Получено новое сообщение поддержки:', data);
            
            // Проверяем, это сообщение для нас
            const isForMe = data.data && (
                (data.data.client_id && data.data.client_id === userId) ||
                (data.data.anonymous_chat_id && data.data.anonymous_chat_id === userId)
            );
            
            console.log('[Profile SSE] Message is for me:', isForMe, 'sender:', data.data?.sender);
            
            if (!isForMe) {
                console.log('[Profile SSE] Ignoring message not for this user');
                return;
            }
            
            // Обновляем чат только если это сообщение от админа
            if (data.data?.sender === 'admin') {
                console.log('[Profile SSE] Reloading support messages...');
                await loadSupportMessages();
            }
            
            // Обновляем счетчик уведомлений
            await updateNotifications();
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
