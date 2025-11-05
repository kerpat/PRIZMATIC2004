import { getRentalBatteries } from './api.js';

function getProgressColor(progress) {
    if (progress > 50) return '#40A4DF'; // azure
    if (progress > 20) return '#f5a623'; // orange
    return '#e53e3e'; // red
}

function formatBalance(balance) {
    const amount = Number(balance ?? 0);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return `${safeAmount.toFixed(2)} ₽`;
}

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
            <button class="btn btn-primary" id="scan-qr-btn">Тарифы</button>
            <div class="secondary-actions">
                <button class="btn btn-secondary text-btn" id="id-input-btn">Ввести ID</button>
                <button class="btn btn-secondary text-btn" id="booking-btn">Бронь</button>
            </div>
        </div>
        <div id="extend-container" class="hidden extend-container"><button id="extend-rental-btn" class="btn btn-primary">Продлить аренду</button></div>
    `;
}

export async function renderActiveRentalView(mainContent, rental, userBalance) {
    const startDate = new Date(rental.starts_at);
    const endsDate = new Date(rental.current_period_ends_at);
    const now = new Date();
    
    // Общая продолжительность аренды в днях
    const totalDurationMs = endsDate.getTime() - startDate.getTime();
    const totalDurationDays = totalDurationMs / (1000 * 60 * 60 * 24);
    
    // Прошедшее время с начала аренды в днях
    const elapsedMs = now.getTime() - startDate.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    
    // Процент выполнения (от 0 до 100)
    let progress = 0;
    if (totalDurationDays > 0) {
        progress = Math.min(100, Math.max(0, (elapsedDays / totalDurationDays) * 100));
    }
    
    // Если аренда истекла, показываем 100%
    if (now > endsDate) {
        progress = 100;
    }
    
    const daysLeft = Math.ceil((endsDate - now) / (1000 * 60 * 60 * 24));
    const progressBarColor = getProgressColor(progress);

    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike-delivery.png" alt="Rented Electric bike" class="bike-image" width="1536" height="1024" decoding="async" fetchpriority="high">
        </div>

        <!-- БЛОК С АКБ -->
        <div class="battery-chips" id="rental-batteries-list"></div>

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
        const batteries = await getRentalBatteries(rental.id);
        const batteryList = document.getElementById('rental-batteries-list');
        if (batteryList) {
            if (batteries.length > 0) {
                batteries.forEach(({ serial_number }) => {
                    const chip = document.createElement('div');
                    chip.className = 'battery-chip';
                    chip.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                        <span>АКБ: ${serial_number}</span>
                    `;
                    batteryList.appendChild(chip);
                });
            } else {
                batteryList.innerHTML = '<span class="empty-message">Информация недоступна</span>';
            }
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
            <img src="bike-delivery.png" alt="Rented Electric bike" class="bike-image" style="opacity: 0.7;">
        </div>
        <h2 style="text-align: center;">Ожидание сдачи</h2>
        <p style="text-align: center; color: var(--dark-green);">Заявка на сдачу принята. Автосписания остановлены. Ожидайте подтверждения администратора.</p>`;
}

export function renderAwaitingEquipmentView(mainContent) {
    mainContent.innerHTML = `
        <div class="pending-screen">
            <div class="pending-content">
                <div class="pending-spinner"></div>
                <h2>Ожидаем оборудование</h2>
                <p>Администратор подбирает велосипед и аккумуляторы. Мы обновим экран автоматически.</p>
            </div>
        </div>
        <style>
            .pending-screen {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                padding: 24px;
                text-align: center;
            }
            .pending-content h2 {
                margin-top: 18px;
                margin-bottom: 8px;
                font-size: 1.5rem;
                color: var(--dark-green);
            }
            .pending-content p {
                color: #3f4d49;
                line-height: 1.5;
                max-width: 320px;
                margin: 0 auto;
            }
            .pending-spinner {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                border: 4px solid rgba(64, 164, 223, 0.2);
                border-top-color: var(--icon-green);
                animation: pending-spin 1.2s linear infinite;
                margin: 0 auto;
            }
            @keyframes pending-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        </style>
    `;
}

export function renderAwaitingContractView(mainContent) {
    mainContent.innerHTML = `
        <div class="contract-signing-screen">
            <div class="contract-content">
                <div class="contract-animation">
                    <div class="contract-document"></div>
                    <div class="signature-animation">
                        <div class="signature-line"></div>
                    </div>
                </div>
                <h2>Необходимо подписать договор аренды для велосипеда.</h2>
                <p>Администратор уже подготовил оборудование. Подпишите договор, чтобы начать поездку.</p>
                <button class="btn btn-primary" id="go-to-contract-btn">Перейти к подписанию</button>
            </div>
        </div>
    `;

    const button = document.getElementById('go-to-contract-btn');
    if (button) {
        button.addEventListener('click', () => {
            window.location.href = 'profile.html?open=notifications#notifications';
        });
    }
}
