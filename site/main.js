import { getClient, getActiveRental, getAvailableBikes, getTariffs, createPayment, chargeFromBalance, updateRentalStatus } from './api.js?v=13.5';
import {
    renderDefaultView,
    renderActiveRentalView,
    renderOverdueRentalView,
    renderPendingReturnView,
    renderAwaitingEquipmentView,
    renderAwaitingContractView,
    renderVerificationPendingView,
    renderVerificationRejectedView,
} from './ui.js?v=13.5';
import './sse-client.js?v=13.5';
import { createQrScanner } from './qr-scanner.js?v=13.5';
import { openPaymentUrl } from './payment-helper.js?v=14.0';

let qrScanner = null;

const state = {
    user: null,
    activeRental: null,
    tariffs: null,
    selectedTariff: null,
    selectedOption: null,
    detailTariff: null,
    detailOptions: [],
    detailOptionIndex: 0,
    extensionTariff: null,
    extensionOptions: [],
    extensionSelectedIndex: 0,
    extensionRental: null,
    processingTariff: false,
    processingTopup: false,
    processingExtension: false,
    rentalRefreshTimer: null,
};

const VERIFICATION_APPROVED_STATUS = 'approved';
const VERIFICATION_REJECTED_STATUSES = new Set(['rejected', 'ocr_failed']);

const optionCache = new Map();
const toastTimers = new Map();
const RENTAL_STATUS_POLL_INTERVAL = 6000;

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

function formatRub(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) {
        return '0 ₽';
    }
    return `${numeric.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽`;
}

function formatDuration(option) {
    if (!option) return '';
    const duration = Number(option.duration_days ?? option.days ?? option.duration ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) {
        return '';
    }
    return `${duration} дн.`;
}

function openModalByElement(modal) {
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModalByElement(modal) {
    if (modal) {
        modal.classList.add('hidden');
    }
}

function openModalById(id) {
    if (!id) return;
    openModalByElement(document.getElementById(id));
}

function closeModalById(id) {
    if (!id) return;
    closeModalByElement(document.getElementById(id));
}

function updateHeader(user) {
    const header = document.querySelector('.app-header h1');
    if (!header) return;
    // Убрали приветствие - просто показываем бренд или город
    if (user?.city) {
        header.textContent = user.city;
    } else {
        header.textContent = 'PRIZMATIC';
    }
}

function updateBalanceDisplay(balance) {
    const balanceEl = document.getElementById('balance-amount');
    if (balanceEl) {
        balanceEl.textContent = formatRub(balance);
    }
}

function clearRentalRefreshTimer() {
    if (state.rentalRefreshTimer) {
        clearTimeout(state.rentalRefreshTimer);
        state.rentalRefreshTimer = null;
    }
}

function scheduleRentalRefresh(delay = RENTAL_STATUS_POLL_INTERVAL) {
    clearRentalRefreshTimer();
    state.rentalRefreshTimer = setTimeout(async () => {
        try {
            await refreshRentalView();
        } catch (error) {
            console.warn('[Main] Не удалось обновить статус аренды:', error);
        }
    }, delay);
}

function updateTariffLabel() {
    const label = document.getElementById('bike-label');
    if (!label) return;

    if (!state.selectedTariff || !state.selectedOption) {
        label.textContent = '';
        label.classList.add('hidden');
        return;
    }

    const parts = [];
    parts.push(state.selectedTariff.title || 'Тариф');

    const durationText = formatDuration(state.selectedOption);
    if (durationText) parts.push(durationText);

    if (Number.isFinite(state.selectedOption.price_rub)) {
        parts.push(formatRub(state.selectedOption.price_rub));
    }

    label.textContent = parts.join(' • ');
    label.classList.remove('hidden');
}

function showToast(id, duration = 2600) {
    const toast = document.getElementById(id);
    if (!toast) return;

    toast.classList.remove('hidden');

    if (toastTimers.has(id)) {
        clearTimeout(toastTimers.get(id));
    }

    const timerId = setTimeout(() => {
        toast.classList.add('hidden');
        toastTimers.delete(id);
    }, duration);

    toastTimers.set(id, timerId);
}

async function fetchTariffs(force = false) {
    if (!force && Array.isArray(state.tariffs) && state.tariffs.length > 0) {
        return state.tariffs;
    }

    try {
        const data = await getTariffs(true);
        state.tariffs = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('[Main] Не удалось загрузить тарифы:', error);
        state.tariffs = [];
    }

    return state.tariffs;
}

function parseExtensions(rawExtensions) {
    if (!rawExtensions) return null;
    if (Array.isArray(rawExtensions)) return rawExtensions;
    if (typeof rawExtensions === 'string') {
        try {
            const parsed = JSON.parse(rawExtensions);
            return Array.isArray(parsed) ? parsed : null;
        } catch (error) {
            console.warn('[Main] Не удалось разобрать extensions тарифа:', error);
        }
    }
    return null;
}

function mapTariffOptions(tariff) {
    if (!tariff) return [];

    const cacheKey = tariff.id ?? tariff.slug ?? tariff.title ?? null;
    if (cacheKey && optionCache.has(cacheKey)) {
        return optionCache.get(cacheKey);
    }

    const baseOption = {
        title: tariff.title || 'Тариф',
        duration_days: Number(tariff.duration_days) || null,
        price_rub: Number(tariff.price_rub) || null,
        deposit_rub: Number(tariff.deposit_rub) || null,
        raw: null,
    };

    const extensions = parseExtensions(tariff.extensions);
    let options = [];

    if (extensions && extensions.length > 0) {
        options = extensions
            .map((ext) => ({
                title: ext.title ?? tariff.title ?? 'Тариф',
                duration_days: Number(ext.duration_days ?? ext.days ?? ext.duration ?? baseOption.duration_days) || baseOption.duration_days,
                price_rub: Number(ext.price_rub ?? ext.cost ?? ext.price ?? baseOption.price_rub),
                deposit_rub: Number(ext.deposit_rub ?? ext.deposit ?? baseOption.deposit_rub) || null,
                raw: ext,
                bikeCode: ext.bike_code ?? ext.bikeCode ?? null,
            }))
            .filter((opt) => Number.isFinite(opt.price_rub) && opt.price_rub > 0);
    }

    if (options.length === 0) {
        if (Number.isFinite(baseOption.price_rub) && baseOption.price_rub > 0) {
            options = [baseOption];
        } else {
            options = [];
        }
    }

    if (cacheKey) {
        optionCache.set(cacheKey, options);
    }
    return options;
}

function renderTariffList() {
    const list = document.querySelector('#tariff-modal .bike-list');
    if (!list) return;

    list.innerHTML = '';
    const tariffs = Array.isArray(state.tariffs) ? state.tariffs : [];

    if (!tariffs.length) {
        list.innerHTML = '<div class="bike-list-item">Тарифы временно недоступны</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    tariffs.forEach((tariff) => {
        const item = document.createElement('div');
        item.className = 'bike-list-item tariff-option';

        const options = mapTariffOptions(tariff);
        const firstOption = options[0] || null;

        const priceText = firstOption?.price_rub ? formatRub(firstOption.price_rub) : '';
        const durationText = firstOption ? formatDuration(firstOption) : '';
        const subtitle = tariff.short_description || tariff.description || '';
        const meta = [priceText, durationText].filter(Boolean).join(' • ') || subtitle;

        item.innerHTML = `
            <strong>${tariff.title || 'Тариф'}</strong>
            <span>${meta}</span>
        `;

        item.addEventListener('click', () => renderTariffDetail(tariff));
        fragment.appendChild(item);
    });

    list.appendChild(fragment);
}

function renderTariffDetail(tariff) {
    state.detailTariff = tariff;
    state.detailOptions = mapTariffOptions(tariff);
    state.detailOptionIndex = 0;

    const detailTitle = document.getElementById('tariff-detail-title');
    if (detailTitle) {
        detailTitle.textContent = tariff.title || 'Тариф';
    }

    const detailDescription = document.getElementById('tariff-detail-description');
    if (detailDescription) {
        detailDescription.textContent = tariff.short_description || tariff.description || '';
    }

    const optionsList = document.getElementById('tariff-options-list');
    if (optionsList) {
        optionsList.innerHTML = '';

        if (!state.detailOptions.length) {
            const fallback = document.createElement('div');
            fallback.className = 'tariff-option-item';
            fallback.textContent = 'Опции тарифа временно недоступны';
            optionsList.appendChild(fallback);
        } else {
            state.detailOptions.forEach((option, idx) => {
                const depositText = option.deposit_rub ? `Залог ${formatRub(option.deposit_rub)}` : '';
                const label = document.createElement('label');
                label.className = 'tariff-option-item' + (idx === 0 ? ' selected' : '');
                label.innerHTML = `
                    <input type="radio" name="tariff-duration-option" value="${idx}" ${idx === 0 ? 'checked' : ''}>
                    <div class="option-details">
                        <span class="option-title">${option.title || tariff.title || 'Тариф'}</span>
                        ${formatDuration(option) ? `<span class="option-duration">${formatDuration(option)}</span>` : ''}
                        ${depositText ? `<span class="option-deposit">${depositText}</span>` : ''}
                    </div>
                    <span class="option-price">${formatRub(option.price_rub)}</span>
                `;

                label.addEventListener('click', () => selectDetailOption(idx));
                label.addEventListener('change', () => selectDetailOption(idx));

                optionsList.appendChild(label);
            });
        }
    }

    closeModalById('tariff-modal');
    openModalById('tariff-detail-modal');
}

function selectDetailOption(index) {
    state.detailOptionIndex = index;
    const optionsList = document.getElementById('tariff-options-list');
    if (!optionsList) return;
    optionsList.querySelectorAll('.tariff-option-item').forEach((element, idx) => {
        if (idx === index) {
            element.classList.add('selected');
            const radio = element.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        } else {
            element.classList.remove('selected');
        }
    });
}

function findTariffById(tariffId) {
    if (!tariffId) return null;
    const tariffs = Array.isArray(state.tariffs) ? state.tariffs : [];
    return tariffs.find((tariff) => Number(tariff.id) === Number(tariffId)) || null;
}

function resolveTariffForRental(rental) {
    if (!rental) return null;
    const knownTariff = findTariffById(rental.tariff_id);
    if (knownTariff) {
        return knownTariff;
    }

    const fallback = rental.tariffs || {};
    return {
        id: rental.tariff_id ?? fallback.id ?? null,
        title: fallback.title || 'Тариф',
        price_rub: fallback.price_rub ?? null,
        duration_days: fallback.duration_days ?? null,
        deposit_rub: fallback.deposit_rub ?? null,
        extensions: fallback.extensions ?? null,
    };
}

function getExtensionOptions(tariff, rental) {
    if (!tariff) return [];
    const options = mapTariffOptions(tariff);
    if (options.length > 0) {
        return options;
    }

    const fallbackPrice = Number(rental?.tariffs?.price_rub ?? tariff.price_rub ?? 0);
    const fallbackDays = Number(rental?.tariffs?.duration_days ?? tariff.duration_days ?? 0);
    if (fallbackPrice > 0 && fallbackDays > 0) {
        return [
            {
                title: tariff.title || rental?.tariffs?.title || 'Тариф',
                duration_days: fallbackDays,
                price_rub: fallbackPrice,
                deposit_rub: null,
                raw: null,
            },
        ];
    }

    return [];
}

function selectExtensionOption(index) {
    if (!Array.isArray(state.extensionOptions)) return;
    if (index < 0 || index >= state.extensionOptions.length) return;
    state.extensionSelectedIndex = index;

    const list = document.getElementById('extend-options');
    if (!list) return;

    list.querySelectorAll('input[name="extend-option"]').forEach((input, idx) => {
        input.checked = idx === index;
        const parent = input.closest('li');
        if (parent) {
            parent.classList.toggle('selected', idx === index);
        }
    });
}

function renderExtendOptionsList() {
    const list = document.getElementById('extend-options');
    if (!list) return;

    list.innerHTML = '';

    if (!Array.isArray(state.extensionOptions) || state.extensionOptions.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = 'Нет доступных вариантов.';
        list.appendChild(emptyItem);
        return;
    }

    state.extensionOptions.forEach((option, index) => {
        const item = document.createElement('li');
        item.className = 'extend-option-item';
        const durationText = formatDuration(option) || `${Number(option.duration_days || 0)} дн.`;
        item.innerHTML = `
            <label>
                <input type="radio" name="extend-option" value="${index}" ${index === state.extensionSelectedIndex ? 'checked' : ''}>
                <span>${durationText}</span>
                <span style="margin-left:auto;font-weight:600;">${formatRub(option.price_rub)}</span>
            </label>
        `;
        item.addEventListener('click', () => selectExtensionOption(index));
        const radio = item.querySelector('input[type="radio"]');
        if (radio) {
            radio.addEventListener('change', () => selectExtensionOption(index));
        }
        list.appendChild(item);
    });
}

async function openExtendModalForRental(rental) {
    if (!rental) return;
    await fetchTariffs().catch(() => {});

    const modal = document.getElementById('extend-modal');
    if (!modal) return;

    state.extensionRental = rental;
    state.extensionTariff = resolveTariffForRental(rental);
    state.extensionOptions = getExtensionOptions(state.extensionTariff, rental);
    state.extensionSelectedIndex = 0;

    renderExtendOptionsList();
    modal.classList.remove('hidden');
}

async function handleExtendConfirm(event) {
    event?.preventDefault();
    if (state.processingExtension) return;

    const rental = state.extensionRental;
    const tariff = state.extensionTariff;
    const option = Array.isArray(state.extensionOptions)
        ? state.extensionOptions[state.extensionSelectedIndex]
        : null;

    if (!state.user || !rental || !tariff || !option) {
        closeModalById('extend-modal');
        return;
    }

    const trigger = event?.currentTarget || document.getElementById('extend-select-btn');
    const originalText = trigger?.textContent;

    state.processingExtension = true;
    if (trigger) {
        trigger.disabled = true;
        trigger.textContent = 'Обработка...';
    }

    let amount = null;
    let normalizedDays;
    try {
        const amountValue = Number(option.price_rub);
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            throw new Error('Не удалось определить стоимость продления.');
        }
        amount = amountValue;

        const days = Number(option.duration_days);
        normalizedDays = Number.isFinite(days) && days > 0 ? days : undefined;

        const response = await createPayment(state.user.id, null, tariff.id, {
            amount,
            days: normalizedDays,
            type: 'renewal',
            rentalId: rental.id,
            extension: option.raw ?? null,
        });

        if (response?.confirmation_url) {
            await openPaymentUrl(response.confirmation_url);
            return;
        }

        if (response?.status === 'succeeded' || response?.status === 'pending') {
            closeModalById('extend-modal');
            
            // Ждем обработки webhook'ом
            await new Promise(resolve => setTimeout(resolve, 3000));
            await refreshUser();
            await refreshRentalView();
            alert('Продление выполнено успешно!');
            return;
        }

        alert('Продление не выполнено. Пополните баланс и попробуйте снова.');
        closeModalById('extend-modal');
        await refreshRentalView();
    } catch (error) {
        const message = String(error?.message || error);
        if (message.includes('Balance is sufficient') && amount !== null) {
            try {
                await chargeFromBalance(state.user.id, tariff.id, {
                    rentalId: rental.id,
                    amount,
                    days: normalizedDays,
                    extension: option.raw ?? null,
                });
                alert('Продление списано с баланса. Страница обновится автоматически.');
                closeModalById('extend-modal');
                await refreshUser();
                await refreshRentalView();
            } catch (balanceError) {
                alert(`Не удалось продлить с баланса: ${balanceError.message}`);
            }
        } else {
            alert(`Не удалось выполнить продление: ${message}`);
        }
    } finally {
        state.processingExtension = false;
        if (trigger) {
            trigger.disabled = false;
            trigger.textContent = originalText || 'Продлить';
        }
    }
}

async function handleReturnBike(rental) {
    if (!rental?.id) return;
    if (!confirm('Вы уверены, что хотите завершить аренду?')) return;

    try {
        await updateRentalStatus(rental.id, 'pending_return');
        alert('Заявка отправлена. Ожидайте подтверждения администратора.');
        await refreshRentalView();
    } catch (error) {
        alert(`Не удалось отправить запрос: ${error.message}`);
    }
}

function bindActiveRentalEvents(rental) {
    const extendBtn = document.getElementById('extend-active-rental-btn');
    if (extendBtn) {
        extendBtn.addEventListener('click', () => openExtendModalForRental(rental));
    }

    const reportBtn = document.getElementById('report-problem-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            window.location.href = 'profile.html#support';
        });
    }

    const returnBtn = document.getElementById('return-bike-btn');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => handleReturnBike(rental));
    }

    const balanceCard = document.getElementById('balance-card');
    if (balanceCard) {
        balanceCard.addEventListener('click', () => openModalById('topup-modal'));
    }
}

function bindOverdueRentalEvents(rental) {
    const retryBtn = document.getElementById('retry-payment-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => openModalById('topup-modal'));
    }

    const returnBtn = document.getElementById('return-bike-btn');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => handleReturnBike(rental));
    }
}

function bindPendingReturnEvents(rental) {
    const signReturnActBtn = document.getElementById('sign-return-act-btn');
    if (signReturnActBtn) {
        signReturnActBtn.addEventListener('click', () => openReturnActForSigning(rental.id));
    }
}

async function openReturnActForSigning(rentalId) {
    try {
        // Перенаправляем пользователя на страницу профиля с параметрами для открытия модального окна подписания акта возврата
        // Добавляем хэш #notifications, чтобы открылась вкладка уведомлений
        window.location.href = `profile.html?open=return_act&rental=${rentalId}#notifications`;
    } catch (error) {
        console.error('[Main] Error redirecting to return act signing:', error);
        alert(`Не удалось открыть страницу подписания акта: ${error.message}`);
    }
}

async function handleTariffSelection() {
    if (!state.detailTariff || !state.detailOptions.length || state.processingTariff) {
        return;
    }

    const option = state.detailOptions[state.detailOptionIndex] || state.detailOptions[0];
    state.selectedTariff = state.detailTariff;
    state.selectedOption = option;
    updateTariffLabel();

    const trigger = document.getElementById('select-tariff-btn');
    await checkoutTariff(state.detailTariff, option, { trigger });
}

async function checkoutTariff(tariff, option, { trigger } = {}) {
    if (!state.user || !tariff || !option || state.processingTariff) {
        return;
    }

    state.processingTariff = true;
    const originalText = trigger?.textContent;

    if (trigger) {
        trigger.disabled = true;
        trigger.textContent = 'Обработка...';
    }

    try {
        const amount = Number(option.price_rub);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Не удалось определить стоимость тарифа.');
        }

        const durationValue = Number(option.duration_days);
        const normalizedDays = Number.isFinite(durationValue) && durationValue > 0 ? durationValue : undefined;

        const freshUser = await refreshUser();
        if (!freshUser) {
            throw new Error('Клиент не найден.');
        }

        const bikeCode = option.bikeCode ?? null;
        const balance = Number(freshUser.balance_rub || 0);

        if (balance >= amount) {
            await chargeFromBalance(freshUser.id, tariff.id, {
                amount,
                days: normalizedDays,
                bikeCode,
                extension: option.raw ?? null,
            });

            showToast('rent-success-toast');
            closeModalById('tariff-detail-modal');
            closeModalById('tariff-modal');
            await refreshRentalView();
            return;
        }

        const response = await createPayment(freshUser.id, bikeCode, tariff.id, {
            amount,
            days: normalizedDays,
            extension: option.raw ?? null,
        });

        if (response?.confirmation_url) {
            await openPaymentUrl(response.confirmation_url);
            return;
        }
        
        // Если статус платежа "succeeded" или "pending", аренда может быть уже создана
        // Это происходит при оплате с привязанной карты
        if (response?.status === 'succeeded' || response?.status === 'pending') {
            closeModalById('tariff-detail-modal');
            closeModalById('tariff-modal');
            
            // Ждем создания аренды через webhook и SSE уведомление
            // Проверяем каждые 500ms в течение 10 секунд
            const maxAttempts = 20; // 10 секунд (20 * 500ms)
            let attempt = 0;
            
            while (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempt++;
                
                // Проверяем, появилась ли аренда
                const rental = await getActiveRental(state.user.id);
                if (rental && rental.status === 'awaiting_battery_assignment') {
                    console.log('[Main] Аренда создана webhook\'ом, обновляем UI');
                    showToast('rent-success-toast');
                    await refreshRentalView();
                    return;
                }
            }
            
            // Если не дождались, все равно обновляем
            console.warn('[Main] Не дождались создания аренды от webhook, обновляем UI');
            showToast('rent-success-toast');
            await refreshRentalView();
            return;
        }

        throw new Error(`Не удалось получить ссылку на оплату. Статус: ${response?.status || 'unknown'}`);
    } catch (error) {
        console.error('[Main] Ошибка оформления тарифа:', error);
        alert(`Ошибка оформления аренды: ${error.message}`);
    } finally {
        if (trigger) {
            trigger.disabled = false;
            trigger.textContent = originalText || 'Выбрать тариф';
        }
        state.processingTariff = false;
    }
}

function showTopupSuccess(amount) {
    const amountEl = document.getElementById('success-amount');
    if (amountEl) {
        amountEl.textContent = formatRub(amount);
    }
    showToast('success-toast', 3200);
}

async function handleTopup(event) {
    event?.preventDefault();
    if (!state.user || state.processingTopup) {
        return;
    }

    const amountInput = document.getElementById('amount-input');
    const trigger = event?.currentTarget || document.getElementById('pay-sbp-btn');
    const rawValue = amountInput?.value?.replace(',', '.') ?? '';
    const parsedAmount = Number.parseFloat(rawValue);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        alert('Введите корректную сумму для пополнения.');
        amountInput?.focus();
        return;
    }

    state.processingTopup = true;
    const amount = Math.round(parsedAmount * 100) / 100;
    const originalText = trigger?.textContent;

    if (trigger) {
        trigger.disabled = true;
        trigger.textContent = 'Создаём платёж...';
    }

    try {
        const response = await createPayment(state.user.id, null, null, {
            amount,
            type: 'top-up',
            return_url: `${window.location.origin}/payment-return.html?status=pending&type=top_up`,
        });

        if (response?.confirmation_url) {
            await openPaymentUrl(response.confirmation_url);
            return;
        }

        if (response?.status) {
            const normalizedStatus = String(response.status).toLowerCase();

            if (normalizedStatus === 'succeeded') {
                showTopupSuccess(amount);
                closeModalById('topup-modal');
                if (amountInput) {
                    amountInput.value = '';
                }
                // Даем время webhook'у обработать платеж
                await new Promise(resolve => setTimeout(resolve, 1500));
                await refreshUser();
                return;
            }

            if (normalizedStatus === 'waiting_for_capture' || normalizedStatus === 'pending') {
                alert('Платёж отправлен на обработку. Пополнение появится на балансе в течение нескольких минут.');
                closeModalById('topup-modal');
                // Даем время webhook'у обработать платеж
                await new Promise(resolve => setTimeout(resolve, 1500));
                await refreshUser();
                return;
            }

            alert(`Платёж инициирован, текущий статус: ${response.status}. Проверьте историю операций позже.`);
            closeModalById('topup-modal');
            return;
        }

        alert('Платёж создан, но сервер не вернул статус. Проверьте баланс через пару минут.');
        closeModalById('topup-modal');
    } catch (error) {
        console.error('[Main] Ошибка при пополнении баланса:', error);
        alert(`Не удалось инициировать пополнение: ${error.message}`);
    } finally {
        if (trigger) {
            trigger.disabled = false;
            trigger.textContent = originalText || 'Пополнить';
        }
        state.processingTopup = false;
    }
}

async function refreshUser() {
    if (!state.user) return null;
    try {
        const fresh = await getClient(state.user.id);
        if (fresh) {
            state.user = fresh;
            updateHeader(fresh);
            updateBalanceDisplay(fresh.balance_rub);
        }
        return fresh;
    } catch (error) {
        console.warn('[Main] Не удалось обновить данные клиента:', error);
        return state.user;
    }
}

async function refreshAvailableBikes() {
    if (!state.user) return;
    try {
        const bikes = await getAvailableBikes(state.user.city || 'Москва');
        const countEl = document.getElementById('available-bikes-count');
        if (countEl) {
            const count = Array.isArray(bikes) ? bikes.length : 0;
            countEl.textContent = count.toString();
        }
    } catch (error) {
        console.warn('[Main] Не удалось загрузить свободные велосипеды:', error);
    }
}

function bindDefaultViewEvents() {
    const tariffsBtn = document.getElementById('scan-qr-btn');
    if (tariffsBtn) {
        tariffsBtn.addEventListener('click', async () => {
            await openTariffModal();
        });
    }

    const balanceCard = document.getElementById('balance-card');
    if (balanceCard) {
        balanceCard.addEventListener('click', () => openModalById('topup-modal'));
    }

    const idInputBtn = document.getElementById('id-input-btn');
    if (idInputBtn) {
        idInputBtn.addEventListener('click', () => openModalById('id-input-modal'));
    }

    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            if (qrScanner) {
                qrScanner.startScan();
            }
        });
    }

    const rentBtn = document.getElementById('rent-btn');
    if (rentBtn) {
        rentBtn.addEventListener('click', async () => {
            if (state.selectedTariff && state.selectedOption) {
                await checkoutTariff(state.selectedTariff, state.selectedOption, { trigger: rentBtn });
            } else {
                await openTariffModal();
            }
        });
    }

    updateBalanceDisplay(state.user?.balance_rub || 0);
    updateTariffLabel();
}

function getVerificationStatus() {
    return (state.user?.verification_status || '').toLowerCase();
}

function isUserVerified() {
    return getVerificationStatus() === VERIFICATION_APPROVED_STATUS;
}

function showVerificationStatusToast(status) {
    const normalized = (status || '').toLowerCase();
    const toast = document.getElementById('notification-toast');
    if (!toast) return;

    const messageEl = toast.querySelector('.toast-message');
    if (!messageEl) return;

    let message = 'Статус обновлен.';
    if (normalized === 'approved') {
        message = '✅ Аккаунт подтвержден! Приятных поездок 🚲';
    } else if (normalized === 'rejected') {
        message = '❌ Верификация не пройдена. Свяжитесь с поддержкой.';
    } else if (normalized === 'ocr_failed') {
        message = '⚠️ Не удалось распознать документы. Попробуйте загрузить их снова.';
    }

    messageEl.innerHTML = message;
    showToast('notification-toast', normalized === 'approved' ? 2600 : 3200);
}

function bindVerificationViewEvents({ allowRetry = false } = {}) {
    const refreshBtn = document.getElementById('verification-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const originalText = refreshBtn.textContent;
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Обновляем...';
            try {
                await refreshUser();
                await refreshRentalView();
            } finally {
                refreshBtn.disabled = false;
                refreshBtn.textContent = originalText || 'Обновить статус';
            }
        });
    }

    const supportBtn = document.getElementById('verification-support-btn');
    if (supportBtn) {
        supportBtn.addEventListener('click', () => {
            const telegramUrl = 'https://t.me/PRIZMATIC_wello';
            try {
                if (window.Telegram?.WebApp) {
                    window.Telegram.WebApp.openTelegramLink(telegramUrl);
                } else {
                    window.open(telegramUrl, '_blank', 'noopener');
                }
            } catch (error) {
                console.warn('[Main] Не удалось открыть Telegram, fallback на переход:', error);
                window.location.href = telegramUrl;
            }
        });
    }

    if (allowRetry) {
        const retryBtn = document.getElementById('verification-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', async () => {
                const originalText = retryBtn.textContent;
                retryBtn.disabled = true;
                retryBtn.textContent = 'Перезагружаем...';
                try {
                    await refreshUser();
                    await refreshRentalView();
                } finally {
                    retryBtn.disabled = false;
                    retryBtn.textContent = originalText || 'Перезагрузить данные';
                }
            });
        }
    }
}

function renderVerificationFlow(mainContent) {
    const status = getVerificationStatus();
    if (!status || status === VERIFICATION_APPROVED_STATUS) {
        return false;
    }

    const updatedAt = state.user?.updated_at || state.user?.verification_updated_at || state.user?.modified_at;

    if (VERIFICATION_REJECTED_STATUSES.has(status)) {
        renderVerificationRejectedView(mainContent, {
            status,
            reason: state.user?.extra?.verification_reason
        });
        bindVerificationViewEvents({ allowRetry: true });
        return true;
    }

    renderVerificationPendingView(mainContent, {
        status,
        city: state.user?.city,
        updatedAt
    });
    bindVerificationViewEvents();
    return true;
}

async function openTariffModal() {
    await fetchTariffs();
    renderTariffList();
    openModalById('tariff-modal');
}

if (typeof window !== 'undefined') {
    window.openTariffModal = openTariffModal;
}

function setupModalClose(modal, handler) {
    if (!modal || modal.dataset.bound) return;
    modal.dataset.bound = 'true';

    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => handler(modal));
    }

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            handler(modal);
        }
    });
}

function attachStaticHandlers() {
    setupModalClose(document.getElementById('tariff-modal'), () => closeModalById('tariff-modal'));
    setupModalClose(document.getElementById('tariff-detail-modal'), () => {
        closeModalById('tariff-detail-modal');
        if (!state.processingTariff) {
            openModalById('tariff-modal');
        }
    });
    setupModalClose(document.getElementById('extend-modal'), () => closeModalById('extend-modal'));

    ['topup-modal', 'id-input-modal', 'booking-list-modal', 'post-rental-prompt-modal'].forEach((id) => {
        setupModalClose(document.getElementById(id), () => closeModalById(id));
    });

    const extendCancelBtn = document.getElementById('extend-cancel-btn');
    if (extendCancelBtn && !extendCancelBtn.dataset.bound) {
        extendCancelBtn.dataset.bound = 'true';
        extendCancelBtn.addEventListener('click', () => closeModalById('extend-modal'));
    }

    const extendCloseBtn = document.getElementById('extend-close-btn');
    if (extendCloseBtn && !extendCloseBtn.dataset.bound) {
        extendCloseBtn.dataset.bound = 'true';
        extendCloseBtn.addEventListener('click', () => closeModalById('extend-modal'));
    }

    const selectBtn = document.getElementById('select-tariff-btn');
    if (selectBtn && !selectBtn.dataset.bound) {
        selectBtn.dataset.bound = 'true';
        selectBtn.addEventListener('click', handleTariffSelection);
    }

    const payBtn = document.getElementById('pay-sbp-btn');
    if (payBtn && !payBtn.dataset.bound) {
        payBtn.dataset.bound = 'true';
        payBtn.addEventListener('click', handleTopup);
    }

    const extendSelectBtn = document.getElementById('extend-select-btn');
    if (extendSelectBtn && !extendSelectBtn.dataset.bound) {
        extendSelectBtn.dataset.bound = 'true';
        extendSelectBtn.addEventListener('click', handleExtendConfirm);
    }
}

async function refreshRentalView() {
    if (!state.user) return;
    const mainContent = document.querySelector('.app-main');
    if (!mainContent) return;

    clearRentalRefreshTimer();

    if (!isUserVerified()) {
        if (renderVerificationFlow(mainContent)) {
            return;
        }
    }

    try {
        const rental = await getActiveRental(state.user.id);
        state.activeRental = rental;

        if (rental) {
            state.selectedTariff = null;
            state.selectedOption = null;
            updateTariffLabel();
            switch (rental.status) {
                case 'active':
                    // Скрываем индикатор уведомления, если аренда активна
                    hideNotificationIndicator();
                    await renderActiveRentalView(mainContent, rental, state.user.balance_rub);
                    bindActiveRentalEvents(rental);
                    break;
                case 'awaiting_battery_assignment':
                    // Скрываем индикатор уведомления
                    hideNotificationIndicator();
                    renderAwaitingEquipmentView(mainContent);
                    scheduleRentalRefresh();
                    break;
                case 'awaiting_contract_signing':
                    // Показываем индикатор уведомления в профиле
                    showNotificationIndicator();
                    renderAwaitingContractView(mainContent);
                    scheduleRentalRefresh(10000);
                    break;
                case 'overdue':
                    // Скрываем индикатор уведомления
                    hideNotificationIndicator();
                    renderOverdueRentalView(mainContent, rental);
                    bindOverdueRentalEvents(rental);
                    break;
                case 'pending_return':
                    // Скрываем индикатор уведомления
                    hideNotificationIndicator();
                    renderPendingReturnView(mainContent, rental);
                    break;
                case 'awaiting_return_signature':
                    // Показываем индикатор уведомления в профиле при ожидании подписания акта возврата
                    showNotificationIndicator();
                    renderPendingReturnView(mainContent, rental);
                    bindPendingReturnEvents(rental);
                    break;
                default:
                    // Скрываем индикатор уведомления для других статусов
                    hideNotificationIndicator();
                    renderDefaultView(mainContent);
                    bindDefaultViewEvents();
            }
            await refreshAvailableBikes();
            updateBalanceDisplay(state.user.balance_rub);
        } else {
            // Скрываем индикатор уведомления, если нет активной аренды, требующей подписания
            hideNotificationIndicator();
            renderDefaultView(mainContent);
            bindDefaultViewEvents();
            await refreshAvailableBikes();
            updateBalanceDisplay(state.user.balance_rub);
            updateTariffLabel();
        }
    } catch (error) {
        console.error('[Main] Не удалось обновить состояние аренды:', error);
        // Скрываем индикатор уведомлений при ошибке
        hideNotificationIndicator();
        renderDefaultView(mainContent);
        bindDefaultViewEvents();
        updateBalanceDisplay(state.user.balance_rub);
        updateTariffLabel();
    }
}

function handleScannedQrCode(data) {
    console.log('Scanned QR Code:', data);
    alert(`Scanned QR Code: ${data}`);
    // TODO: Implement logic to handle the bike ID, e.g., open tariff modal
}

async function bootstrap() {
    qrScanner = createQrScanner(handleScannedQrCode);

    if (localStorage.getItem('isRegistered') !== 'true') {
        window.location.replace('registration.html');
        return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
        localStorage.clear();
        window.location.replace('registration.html');
        return;
    }

    try {
        const user = await getClient(userId);
        if (!user) {
            console.warn('[Main] Пользователь не найден, очищаем localStorage');
            localStorage.clear();
            window.location.replace('registration.html');
            return;
        }

        if (user?.name) {
            const formattedName = formatPersonName(user.name);
            if (formattedName) {
                user.name = formattedName;
                try {
                    localStorage.setItem('userName', formattedName);
                } catch (error) {
                    console.warn('[Main] Не удалось обновить имя в localStorage:', error);
                }
            }
        }

        state.user = user;
        updateHeader(user);

        attachStaticHandlers();
        initializePostRentalPrompt();

        // Подключаемся к SSE
        connectSSE(userId);

        // Прогреваем список тарифов для мгновенного открытия модалки
        fetchTariffs().catch((error) => {
            console.warn('[Main] Предзагрузка тарифов не удалась:', error);
        });

        await refreshRentalView();
    } catch (error) {
        console.error('[Main] Критическая ошибка инициализации:', error);
        
        // Если пользователь не найден - очищаем и перенаправляем
        if (error.message && error.message.includes('not found')) {
            console.warn('[Main] Клиент не найден в базе, очищаем данные');
            localStorage.clear();
            window.location.replace('registration.html');
            return;
        }
        
        alert('Не удалось загрузить данные. Попробуйте обновить страницу.');
    }
}

function initializePostRentalPrompt() {
    const promptModal = document.getElementById('post-rental-prompt-modal');
    if (!promptModal) return;

    const closeBtn = document.getElementById('prompt-modal-close-btn');
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = 'true';
        closeBtn.addEventListener('click', () => closeModalByElement(promptModal));
    }

    const goToProfileBtn = document.getElementById('go-to-profile-btn');
    if (goToProfileBtn && !goToProfileBtn.dataset.bound) {
        goToProfileBtn.dataset.bound = 'true';
        goToProfileBtn.addEventListener('click', () => {
            window.location.href = 'profile.html#notifications';
            closeModalByElement(promptModal);
        });
    }
}

// Функция для показа индикатора уведомлений в профиле
function showNotificationIndicator() {
    // Добавляем класс для анимации колокольчика в навигации
    const profileNav = document.querySelector('a[href="profile.html"]');
    if (profileNav) {
        // Проверяем, есть ли уже класс уведомлений
        if (!profileNav.classList.contains('has-notification')) {
            profileNav.classList.add('has-notification');
            // Запускаем анимацию колокольчика
            profileNav.classList.add('bell-animation');
            // Убираем класс анимации через короткое время
            setTimeout(() => {
                profileNav.classList.remove('bell-animation');
            }, 500);
        }
    }
}

// SSE клиент
let sseClient = null;

// Функция для подключения к SSE
function connectSSE(userId) {
    if (typeof window.SSEClient !== 'undefined') {
        sseClient = new window.SSEClient(userId);
        
        // Обработчики SSE событий
        sseClient.on('rental_update', async (data) => {
            console.log('[Main SSE] Получено обновление аренды:', data);
            // Обновляем данные пользователя для отображения актуального статуса аренды
            await refreshUser();
            await refreshRentalView();
        });
        
        sseClient.on('balance_update', async (data) => {
            console.log('[Main SSE] Получено обновление баланса:', data);
            // Обновляем все данные пользователя включая баланс
            await refreshUser();
        });

        sseClient.on('verification_update', async (data) => {
            const incomingStatus = data?.data?.status || data?.status;
            if (!incomingStatus || !state.user) return;

            const normalized = String(incomingStatus).toLowerCase();
            if (normalized === getVerificationStatus()) {
                return;
            }

            console.log('Получено обновление верификации:', normalized);
            const updatedUser = await refreshUser();
            const updatedStatus = (updatedUser?.verification_status || normalized).toLowerCase();
            showVerificationStatusToast(updatedStatus);
            await refreshRentalView();
        });
        
        sseClient.on('connected', (data) => {
            console.log('SSE соединение установлено:', data);
        });
        
        sseClient.connect();
    } else {
        console.warn('SSEClient не доступен');
    }
}

// Функция для отключения от SSE
function disconnectSSE() {
    if (sseClient) {
        sseClient.disconnect();
        sseClient = null;
    }
}

// Функция для скрытия индикатора уведомлений
function hideNotificationIndicator() {
    const profileNav = document.querySelector('a[href="profile.html"]');
    if (profileNav) {
        profileNav.classList.remove('has-notification');
    }
}

// Проверяем, возвращаемся ли из оплаты, и обрабатываем соответствующим образом
async function handlePaymentReturn() {
    if (window.appBridge && window.appBridge.isInApp) {
        // Если мы возвращаемся из оплаты, предотвращаем стандартную загрузку
        if (window.appBridge.isReturnFromPayment()) {
            console.log('Обнаружен возврат из оплаты в приложении');
            // Устанавливаем небольшую задержку, чтобы обработать возврат
            setTimeout(async () => {
                // Загружаем состояние пользователя и обновляем интерфейс
                await bootstrap();
            }, 1000);
            return;
        }
    }
    // Стандартная загрузка приложения
    await bootstrap();
}

document.addEventListener('DOMContentLoaded', handlePaymentReturn);
