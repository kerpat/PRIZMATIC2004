function getProgressColor(progress) {
    if (progress > 50) return '#26b999'; // green
    if (progress > 20) return '#f5a623'; // orange
    return '#e53e3e'; // red
}

function formatBalance(balance) {
    return `${balance.toFixed(2)} ₽`;
}
import { supabase } from './api.js';
export function renderDefaultView(mainContent) {
    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike-delivery.png" alt="Electric bike" class="bike-image" id="main-bike-image">
        </div>
        <div class="progress-section">
            <div class="progress-bar-container"><div class="progress-bar" id="progress-bar-fill"></div></div>
            <div class="progress-labels"><span id="progress-start-label">0 дней</span><span id="progress-end-label">...</span></div>
        </div>
        <h2>Найти и арендовать электровелосипед рядом.</h2>
        <div class="info-cards">
            <div class="card"><div class="icon-wrapper"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div><div class="text-content"><span>Свободных</span><strong id="available-bikes-count">100</strong></div></div>
            <div class="card" id="balance-card"><div class="icon-wrapper dollar"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div><div class="text-content"><span>Баланс</span><strong id="balance-amount">0 ₽</strong></div></div>
        </div>
        <div class="action-buttons">
            <button class="btn btn-primary" id="scan-qr-btn">Сканировать QR-код</button>
            <div class="secondary-actions"><button class="btn btn-secondary" id="scan-icon-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg></button><button class="btn btn-secondary text-btn" id="id-input-btn">Ввести ID</button><button class="btn btn-secondary text-btn" id="booking-btn">Бронь</button></div>
        </div>
        <div id="extend-container" class="hidden extend-container"><button id="extend-rental-btn" class="btn btn-primary">Продлить аренду</button></div>
    `;
}

export async function renderActiveRentalView(mainContent, rental, userBalance) {
    const endsDate = new Date(rental.current_period_ends_at);
    const daysLeft = Math.ceil((endsDate - new Date()) / (1000 * 60 * 60 * 24));
    const durationDays = rental.tariffs?.duration_days || 7;
    const progress = Math.max(0, 100 - (daysLeft / durationDays * 100));
    const progressBarColor = getProgressColor(progress);

    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike-delivery.png" alt="Rented Electric bike" class="bike-image" width="1536" height="1024" decoding="async" fetchpriority="high">
        </div>

        <!-- НОВЫЙ БЛОК С АКБ -->
        <div class="rental-equipment-info">
            <div class="equipment-label">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <span>В комплекте:</span>
            </div>
            <div class="battery-chips" id="rental-batteries-list"></div>
        </div>

        <div class="progress-section">
            <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%; background-color: ${progressBarColor};"></div></div>
            <div class="progress-labels"><span>В аренде</span><span>Осталось ~${daysLeft > 0 ? daysLeft : 0} д.</span></div>
        </div>

        <h2>Ваша аренда активна</h2>

        <div class="info-cards">
            <div class="card">
                <div class="icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <div class="text-content">
                    <span>Свободных</span>
                    <strong id="available-bikes-count">...</strong>
                </div>
            </div>
            <div class="card" id="balance-card">
                <div class="icon-wrapper dollar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="text-content">
                    <span>Баланс</span>
                    <strong id="balance-amount">${formatBalance(userBalance)}</strong>
                </div>
            </div>
        </div>

        <div class="action-buttons">
            <button class="btn btn-primary" id="extend-active-rental-btn">Продлить аренду</button>
            <div class="secondary-actions-split">
                <button class="btn btn-secondary text-btn" id="report-problem-btn">Проблема?</button>
                <button class="btn btn-secondary text-btn" id="return-bike-btn" data-rental-id="${rental.id}">Сдать</button>
            </div>
        </div>
    `;

    // ЗАГРУЖАЕМ И ОТОБРАЖАЕМ АККУМУЛЯТОРЫ
    try {
        const { data: batteries, error } = await supabase
            .from('rental_batteries')
            .select('batteries(serial_number)')
            .eq('rental_id', rental.id);

        const batteryList = document.getElementById('rental-batteries-list');
        if (batteries && batteries.length > 0 && batteryList) {
            batteries.forEach(rb => {
                const chip = document.createElement('div');
                chip.className = 'battery-chip';
                chip.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    ${rb.batteries.serial_number}
                `;
                batteryList.appendChild(chip);
            });
        } else if (batteryList) {
            // Если АКБ нет, показываем placeholder
            batteryList.innerHTML = '<span style="color: #7a9a95; font-size: 0.85rem;">Информация недоступна</span>';
        }
    } catch (err) {
        console.error('Не удалось загрузить список аккумуляторов:', err);
    }
}

export function renderOverdueRentalView(mainContent, rental) {
    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike00001.png" alt="Rented Electric bike" class="bike-image" style="filter: grayscale(1);">
        </div>
        <h2 style="color: #e53e3e; text-align: center;">Аренда просрочена</h2>
        <p style="text-align: center; color: var(--dark-green);">Последний платеж не прошел. Пожалуйста, проверьте баланс карты.</p>
        <div class="action-buttons">
            <button class="btn btn-primary" id="retry-payment-btn">Повторить платеж</button>
            <button class="btn btn-secondary text-btn" id="return-bike-btn">Сдать велосипед</button>
        </div>`;
}

export function renderPendingReturnView(mainContent, rental) {
    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike00001.png" alt="Rented Electric bike" class="bike-image" style="opacity: 0.7;">
        </div>
        <h2 style="text-align: center;">Ожидание сдачи</h2>
        <p style="text-align: center; color: var(--dark-green);">Заявка на сдачу принята. Автосписания остановлены. Ожидайте подтверждения администратора.</p>`;
}
