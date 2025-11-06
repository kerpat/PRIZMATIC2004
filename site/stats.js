import { getPaymentsHistory } from './api.js?v=13.4';

const PAYMENT_ICONS = {
    rental: 'rental',
    renewal: 'renewal',
    'top-up': 'top-up',
    booking: 'booking',
    invoice: 'invoice',
    adjustment: 'adjustment',
    'refund_to_balance': 'refund_to_balance',
    balance_debit: 'balance_debit',
};

const PAYMENT_LABELS = {
    rental: 'Аренда',
    renewal: 'Продление',
    'top-up': 'Пополнение',
    booking: 'Бронирование',
    invoice: 'Счет',
    adjustment: 'Корректировка',
    'refund_to_balance': 'Возврат',
    balance_debit: 'Списание',
};

const METHOD_LABELS = {
    card: 'Карта',
    sbp: 'СБП',
    yoo_money: 'ЮMoney',
    balance: 'Баланс',
};

const state = {
    userId: null,
    payments: [],
};

const elements = {};

function toDateInputValue(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

function initElements() {
    elements.historyContainer = document.getElementById('history-list-container');
    elements.totalTopups = document.getElementById('total-topups');
    elements.totalExpenses = document.getElementById('total-expenses');
    elements.bars = Array.from({ length: 7 }, (_, index) => document.getElementById(`day-${index}`)).filter(Boolean);
    elements.paymentDetailModal = document.getElementById('payment-detail-modal');
    elements.paymentDetailContent = document.getElementById('payment-detail-content');
    elements.paymentDetailCloseBtn = document.getElementById('payment-detail-close-btn');
}

function formatCurrency(value) {
    const amount = Number(value) || 0;
    return `${amount.toLocaleString('ru-RU')} ₽`;
}

function normalizeType(type) {
    if (!type) return 'other';
    return PAYMENT_LABELS[type] ? type : 'other';
}

function getIconClass(type) {
    const normalized = normalizeType(type);
    return PAYMENT_ICONS[normalized] || 'other';
}

function getPaymentLabel(type) {
    const normalized = normalizeType(type);
    return PAYMENT_LABELS[normalized] || 'Операция';
}

function getMethodLabel(method) {
    if (!method) return '—';
    return METHOD_LABELS[method] || method;
}

function isIncome(payment) {
    const type = normalizeType(payment.payment_type);
    if (type === 'top-up' || type === 'refund_to_balance') {
        return true;
    }
    if (type === 'adjustment' && Number(payment.amount_rub) > 0) {
        return true;
    }
    return Number(payment.amount_rub) > 0 && type !== 'invoice';
}

function renderHistory() {
    const container = elements.historyContainer;
    if (!container) return;

    container.innerHTML = '';

    if (!state.payments.length) {
        container.innerHTML = '<p class="empty-history">Нет операций за выбранный период.</p>';
        return;
    }

    state.payments.forEach((payment) => {
        const type = normalizeType(payment.payment_type);
        const isPositive = isIncome(payment);
        const amount = Number(payment.amount_rub) || 0;
        const date = new Date(payment.created_at);

        const item = document.createElement('div');
        item.className = 'history-item';
        if (payment.status && payment.status !== 'succeeded') {
            item.classList.add('history-item--pending');
        }
        item.dataset.paymentId = payment.id;

        item.innerHTML = `
            <div class="history-info">
                <div class="history-icon-wrapper ${getIconClass(type)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <div class="history-details">
                    <span class="history-title">${getPaymentLabel(type)}</span>
                    <span class="history-subtitle">${getMethodLabel(payment.method)}</span>
                </div>
            </div>
            <div class="history-cost ${isPositive ? 'positive' : 'negative'}">
                ${isPositive ? '+' : '-'}${Math.abs(amount).toLocaleString('ru-RU')} ₽
            </div>
        `;

        container.appendChild(item);
    });
}

function updateTotals() {
    let income = 0;
    let expenses = 0;

    state.payments.forEach((payment) => {
        const value = Number(payment.amount_rub) || 0;
        if (isIncome(payment)) {
            income += value;
        } else {
            expenses += Math.abs(value);
        }
    });

    if (elements.totalTopups) {
        elements.totalTopups.textContent = formatCurrency(income);
    }
    if (elements.totalExpenses) {
        elements.totalExpenses.textContent = formatCurrency(expenses);
    }
}

function updateWeeklyGraph() {
    if (!elements.bars.length) return;

    const totals = Array(7).fill(0);
    state.payments.forEach((payment) => {
        const value = Math.abs(Number(payment.amount_rub) || 0);
        const createdAt = new Date(payment.created_at);
        if (Number.isNaN(createdAt.getTime())) {
            return;
        }
        // Convert Sunday-based index to Monday-based (0 = Monday)
        const jsDay = createdAt.getDay(); // 0 (Sun) - 6 (Sat)
        const mondayIndex = (jsDay + 6) % 7;
        totals[mondayIndex] += value;
    });

    const maxValue = Math.max(...totals, 1);
    elements.bars.forEach((bar, index) => {
        const value = totals[index];
        const percent = Math.round((value / maxValue) * 100);
        
        bar.style.setProperty('height', `${Math.max(percent, 5)}%`);
        bar.title = `${value.toLocaleString('ru-RU')} ₽`;

        if (value === 0) {
            bar.classList.add('zero-value');
        } else {
            bar.classList.remove('zero-value');
        }
    });
}

function renderPaymentDetails(payment) {
    if (!elements.paymentDetailContent) return;
    const amount = Number(payment.amount_rub) || 0;
    const createdAt = new Date(payment.created_at);

    const detailsHTML = `
        <div class="payment-details">
            <div class="detail-row">
                <span class="detail-label">Тип</span>
                <span class="detail-value">${getPaymentLabel(payment.payment_type)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Сумма</span>
                <span class="detail-value">${formatCurrency(amount)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Статус</span>
                <span class="detail-value">${payment.status || 'succeeded'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Метод</span>
                <span class="detail-value">${getMethodLabel(payment.method)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Дата</span>
                <span class="detail-value">${createdAt.toLocaleString('ru-RU')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Описание</span>
                <span class="detail-value">${payment.description || '—'}</span>
            </div>
        </div>
    `;

    elements.paymentDetailContent.innerHTML = detailsHTML;
    elements.paymentDetailModal?.classList.remove('hidden');
}

function bindHistoryClick() {
    if (!elements.historyContainer) return;
    elements.historyContainer.addEventListener('click', (event) => {
        const item = event.target.closest('.history-item');
        if (!item) return;
        const payment = state.payments.find((entry) => String(entry.id) === item.dataset.paymentId);
        if (payment) {
            renderPaymentDetails(payment);
        }
    });
}

function bindModal() {
    if (!elements.paymentDetailModal) return;

    const close = () => elements.paymentDetailModal.classList.add('hidden');

    if (elements.paymentDetailCloseBtn) {
        elements.paymentDetailCloseBtn.addEventListener('click', close);
    }

    elements.paymentDetailModal.addEventListener('click', (event) => {
        if (event.target === elements.paymentDetailModal) {
            close();
        }
    });
}

function attachPeriodPicker(defaultStart, defaultEnd) {
    const startInput = document.getElementById('period-start');
    const endInput = document.getElementById('period-end');
    if (!startInput || !endInput) return;

    startInput.value = toDateInputValue(defaultStart);
    endInput.value = toDateInputValue(defaultEnd);

    const applyRange = () => {
        if (!startInput.value || !endInput.value) return;
        const start = new Date(startInput.value);
        const end = new Date(endInput.value);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
        if (end < start) {
            alert('Дата окончания не может быть раньше даты начала.');
            return;
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        loadHistory(start, end);
    };

    startInput.addEventListener('change', applyRange);
    endInput.addEventListener('change', applyRange);
}

async function loadHistory(startDate, endDate) {
    if (!elements.historyContainer) return;

    elements.historyContainer.innerHTML = '<p class="empty-history">Загрузка истории...</p>';

    try {
        const data = await getPaymentsHistory({
            userId: state.userId,
            startDate: startDate?.toISOString(),
            endDate: endDate?.toISOString(),
        });

        state.payments = Array.isArray(data)
            ? data.map((payment) => ({
                ...payment,
                created_at: payment.created_at,
            })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            : [];

        renderHistory();
        updateTotals();
        updateWeeklyGraph();
        const startInput = document.getElementById('period-start');
        const endInput = document.getElementById('period-end');
        if (startInput && startDate) {
            startInput.value = toDateInputValue(new Date(startDate));
        }
        if (endInput && endDate) {
            endInput.value = toDateInputValue(new Date(endDate));
        }
    } catch (error) {
        console.error('[Stats] Failed to load payments:', error);
        elements.historyContainer.innerHTML = '<p class="empty-history">Не удалось загрузить историю платежей.</p>';
    }
}

async function init() {
    state.userId = localStorage.getItem('userId');
    if (!state.userId) {
        if (elements.historyContainer) {
            elements.historyContainer.innerHTML = '<p class="empty-history">Пользователь не найден. Авторизуйтесь заново.</p>';
        }
        return;
    }

    bindHistoryClick();
    bindModal();

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    attachPeriodPicker(startDate, endDate);
    await loadHistory(startDate, endDate);
}

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    init();
});
