import { getClient, getActiveRental, createPayment, getAvailableBikes } from './api.js';
import { renderDefaultView, renderActiveRentalView, renderOverdueRentalView, renderPendingReturnView } from './ui.js';

function initializeModals() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

async function updateAvailableBikesCount(city) {
    try {
        const bikes = await getAvailableBikes(city || 'Москва');
        const countEl = document.getElementById('available-bikes-count');
        if (countEl) {
            countEl.textContent = bikes.length.toString();
        }
    } catch (error) {
        console.warn('[Main] Failed to load available bikes count:', error.message);
    }
}

function initializeMainScreenEventListeners(currentUser) {
    const scanBtn = document.getElementById('scan-qr-btn');
    const balanceCard = document.getElementById('balance-card');
    const idInputBtn = document.getElementById('id-input-btn');
    const bookingBtn = document.getElementById('booking-btn');
    const rentBtn = document.getElementById('rent-btn');
    const topupModal = document.getElementById('topup-modal');
    const idInputModal = document.getElementById('id-input-modal');
    const bookingListModal = document.getElementById('booking-list-modal');
    const qrModal = document.getElementById('qr-modal');
    const balanceAmount = document.getElementById('balance-amount');

    if (balanceAmount) {
        const balanceValue = Number(currentUser?.balance_rub || 0);
        balanceAmount.textContent = `${balanceValue.toLocaleString('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        })} ₽`;
    }

    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            qrModal.classList.remove('hidden');
        });
    }

    if (balanceCard) {
        balanceCard.addEventListener('click', () => {
            topupModal.classList.remove('hidden');
        });
    }

    if (idInputBtn) {
        idInputBtn.addEventListener('click', () => {
            idInputModal.classList.remove('hidden');
        });
    }

    if (bookingBtn) {
        bookingBtn.addEventListener('click', () => {
            bookingListModal.classList.remove('hidden');
        });
    }

    if (rentBtn) {
        rentBtn.addEventListener('click', async () => {
            try {
                const data = await createPayment(currentUser.id, '00001', 1);
                if (data.confirmation_url) {
                    window.location.href = data.confirmation_url;
                }
            } catch (error) {
                alert('Ошибка: ' + error.message);
            }
        });
    }
}

function initializePostRentalPrompt() {
    const promptModal = document.getElementById('post-rental-prompt-modal');
    if (!promptModal) return;

    const closeBtn = document.getElementById('prompt-modal-close-btn');
    const goToProfileBtn = document.getElementById('go-to-profile-btn');

    const closeModal = () => promptModal.classList.add('hidden');

    promptModal.addEventListener('click', (event) => {
        if (event.target === promptModal) {
            closeModal();
        }
    });
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    if (goToProfileBtn) {
        goToProfileBtn.addEventListener('click', () => {
            window.location.href = 'profile.html#notifications';
            closeModal();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('isRegistered') !== 'true') {
        window.location.replace('registration.html');
        return;
    }

    async function initializeRentalSystem() {
        const mainContent = document.querySelector('.app-main');
        const appHeader = document.querySelector('.app-header h1');
        const userId = localStorage.getItem('userId');

        if (!userId) {
            localStorage.clear();
            window.location.replace('registration.html');
            return;
        }

        const currentUser = await getClient(userId);
        if (!currentUser) {
            localStorage.clear();
            window.location.replace('registration.html');
            return;
        }

        const firstName = typeof currentUser.name === 'string' ? currentUser.name.split(' ')[0] : null;
        if (appHeader) {
            if (firstName) {
                appHeader.textContent = `Привет, ${firstName}!`;
            } else if (currentUser.city) {
                appHeader.textContent = currentUser.city;
            } else {
                appHeader.textContent = 'PRIZMATIC';
            }
        }

        const activeRental = await getActiveRental(userId);

        if (activeRental) {
            switch(activeRental.status) {
                case 'active':
                    await renderActiveRentalView(mainContent, activeRental, currentUser.balance_rub);
                    break;
                case 'overdue': 
                    renderOverdueRentalView(mainContent, activeRental); 
                    break;
                case 'pending_return': 
                    renderPendingReturnView(mainContent, activeRental); 
                    break;
                default: 
                    renderDefaultView(mainContent);
                    initializeMainScreenEventListeners(currentUser);
            }
        } else {
            renderDefaultView(mainContent);
            initializeMainScreenEventListeners(currentUser);
            await updateAvailableBikesCount(currentUser.city);
        }
    }

    initializeRentalSystem();
    initializeModals();
    initializePostRentalPrompt();
});
