// Файл: stats.js (ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ)

document.addEventListener('DOMContentLoaded', () => {
    // --- ИНИЦИАЛИЗАЦИЯ SUPABASE ---
    const SUPABASE_URL = window.CONFIG.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.CONFIG.SUPABASE_ANON_KEY;
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- ЭЛЕМЕНТЫ DOM ---
    const historyContainer = document.getElementById('history-list-container');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const periodDisplayText = document.getElementById('period-text');

    let allOperations = [];
    let currentFilter = 'all';

    // --- ИКОНКИ ТИПОВ ОПЕРАЦИЙ ---
    const icons = {
        'rental': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
        'renewal': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>`,
        'top-up': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
        'booking': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        'refund_to_balance': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 23 12 17 12"></polyline><polyline points="1 6 1 12 7 12"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>`,
        'adjustment': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        'balance_debit': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`,
        'invoice': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
        'other': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
    };
    
    const paymentTypeLabels = {
        'rental': 'Аренда',
        'renewal': 'Продление аренды',
        'top-up': 'Пополнение баланса',
        'booking': 'Бронирование',
        'refund_to_balance': 'Возврат на баланс',
        'adjustment': 'Корректировка баланса',
        'balance_debit': 'Списание с баланса',
        'invoice': 'Оплата по счету'
    };

    const paymentMethodLabels = {
        'card': 'Карта',
        'sbp': 'СБП',
        'balance': 'Баланс',
        'yoo_money': 'ЮMoney'
    };

    /**
     * Рендерит отфильтрованный список операций
     */
    function renderHistory() {
        let operationsToRender = allOperations;
        if (currentFilter === 'rent') { // Фильтр "расходы"
            operationsToRender = allOperations.filter(op => op.amount_rub <= 0);
        } else if (currentFilter === 'topup') { // Фильтр "пополнения"
            operationsToRender = allOperations.filter(op => op.amount_rub > 0);
        }
        
        historyContainer.innerHTML = '';
        if (operationsToRender.length === 0) {
            historyContainer.innerHTML = '<p class="empty-history">Операций за выбранный период нет.</p>';
            return;
        }

        const groupedByDate = operationsToRender.reduce((acc, op) => {
            const date = new Date(op.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!acc[date]) acc[date] = [];
            acc[date].push(op);
            return acc;
        }, {});

        for (const date in groupedByDate) {
            const dateHeader = document.createElement('h3');
            dateHeader.className = 'history-date-header';
            dateHeader.textContent = date;
            historyContainer.appendChild(dateHeader);

            groupedByDate[date].forEach(item => {
                const isTopup = item.amount_rub > 0;
                const type = item.payment_type || (isTopup ? 'top-up' : 'other');
                const title = paymentTypeLabels[type] || 'Операция';
                const iconHTML = icons[type] || icons['other'];
                
                // Формируем подзаголовок: способ оплаты + время
                const methodLabel = item.method ? paymentMethodLabels[item.method] : null;
                const timeStr = new Date(item.created_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
                const subtitle = methodLabel ? `${methodLabel} • ${timeStr}` : timeStr;

                const itemHTML = `
                    <div class="history-item">
                        <div class="history-item-left">
                            <div class="history-icon-wrapper ${type}">${iconHTML}</div>
                            <div class="history-details">
                                <span class="history-title">${title}</span>
                                <span class="history-subtitle">${subtitle}</span>
                            </div>
                        </div>
                        <div class="history-cost ${isTopup ? 'positive' : 'negative'}">${isTopup ? '+' : ''}${item.amount_rub.toLocaleString('ru-RU')} ₽</div>
                    </div>`;
                historyContainer.insertAdjacentHTML('beforeend', itemHTML);
            });
        }
    }

    /**
     * Загружает историю операций с сервера за указанный период
     */
    async function loadHistory(startDate, endDate) {
        historyContainer.innerHTML = '<p class="empty-history">Загрузка истории...</p>';
        const userId = localStorage.getItem('userId');
        if (!userId) {
            historyContainer.innerHTML = '<p class="empty-history">Не удалось определить пользователя.</p>';
            return;
        }

        try {
            let query = supabase
                .from('payments')
                .select('id, created_at, amount_rub, payment_type, method, description')
                .eq('client_id', userId)
                .order('created_at', { ascending: false });

            if (startDate) query = query.gte('created_at', startDate.toISOString());
            if (endDate) query = query.lte('created_at', endDate.toISOString());

            const { data, error } = await query;

            if (error) throw error;
            
            allOperations = data;
            renderHistory();
        } catch (err) {
            console.error('Ошибка загрузки истории:', err);
            historyContainer.innerHTML = '<p class="empty-history">Не удалось загрузить историю платежей.</p>';
        }
    }

    // --- ЛОГИКА ФИЛЬТРОВ (без изменений) ---
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            renderHistory();
        });
    });

    // --- ИНИЦИАЛИЗАЦИЯ КАЛЕНДАРЯ (без изменений) ---
    const fp = flatpickr("#period-display", {
        mode: "range",
        dateFormat: "d.m.Y",
        locale: "ru",
        onClose: function(selectedDates) {
            if (selectedDates.length === 2) {
                const [start, end] = selectedDates;
                end.setHours(23, 59, 59, 999); 
                
                const options = { day: 'numeric', month: 'short' };
                periodDisplayText.textContent = `${start.toLocaleDateString('ru-RU', options)} - ${end.toLocaleDateString('ru-RU', options)}`;
                loadHistory(start, end);
            }
        }
    });

    // --- НАЧАЛЬНАЯ ЗАГРУЗКА ДАННЫХ ЗА ТЕКУЩИЙ МЕСЯЦ (без изменений) ---
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    loadHistory(startOfMonth, endOfMonth);
});