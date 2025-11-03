import { getClient, getActiveRental, createPayment, getAvailableBikes, getTariffs } from './api.js';
import { renderDefaultView, renderActiveRentalView, renderOverdueRentalView, renderPendingReturnView } from './ui.js';

let cachedTariffs = null;
async function fetchTariffs() {
    if (cachedTariffs) {
        return cachedTariffs;
    }
    try {
        const tariffs = await getTariffs(true);
        cachedTariffs = Array.isArray(tariffs) ? tariffs : [];
    } catch (error) {
        console.error('[Main] Failed to load tariffs:', error);
        cachedTariffs = [];
    }
    return cachedTariffs;
}

let selectedTariffForCheckout = null;
let selectedTariffOption = null;

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
    const tariffModal = document.getElementById('tariff-modal');
    const tariffModalCloseBtn = document.getElementById('tariff-modal-close-btn');
    const tariffList = tariffModal ? tariffModal.querySelector('.bike-list') : null;
    const tariffDetailModal = document.getElementById('tariff-detail-modal');
    const tariffDetailCloseBtn = document.getElementById('tariff-detail-close-btn');
    const tariffOptionsList = document.getElementById('tariff-options-list');
    const selectTariffBtn = document.getElementById('select-tariff-btn');
    const bikeLabelElement = document.getElementById('bike-label');
    const balanceAmount = document.getElementById('balance-amount');

    let activeTariff = null;
    let activeTariffExtensions = [];
    let activeExtensionIndex = 0;

    const formatRub = (value) => {
        const numeric = Number(value || 0);
        return `${numeric.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽`;
    };

    const formatDuration = (extension) => {
        if (!extension) return '';
        const duration = extension.duration_days ?? extension.days ?? extension.duration ?? null;
        return duration ? `${duration} дн.` : '';
    };

    const closeModal = (modal) => {
        if (modal) {
            modal.classList.add('hidden');
        }
    };

    const openModal = (modal) => {
        if (modal) {
            modal.classList.remove('hidden');
        }
    };

    const updateTariffLabel = () => {
        if (!bikeLabelElement) {
            return;
        }
        if (!selectedTariffForCheckout) {
            bikeLabelElement.textContent = '';
            bikeLabelElement.classList.add('hidden');
            return;
        }
        const parts = [selectedTariffForCheckout.title || 'Тариф'];
        const extension = selectedTariffOption;
        if (extension) {
            const durationText = formatDuration(extension);
            if (durationText) parts.push(durationText);
            const priceText = formatRub(extension.price_rub ?? extension.cost);
            if (priceText) parts.push(priceText);
        } else {
            if (selectedTariffForCheckout.duration_days) {
                parts.push(`${selectedTariffForCheckout.duration_days} дн.`);
            }
            if (selectedTariffForCheckout.price_rub) {
                parts.push(formatRub(selectedTariffForCheckout.price_rub));
            }
        }
        bikeLabelElement.textContent = parts.join(' • ');
        bikeLabelElement.classList.remove('hidden');
    };

    const renderTariffDetail = (tariff) => {
        if (!tariffDetailModal) {
            return;
        }
        activeTariff = tariff;
        const detailTitle = document.getElementById('tariff-detail-title');
        const detailDescription = document.getElementById('tariff-detail-description');
        if (detailTitle) {
            detailTitle.textContent = tariff.title || 'Тариф';
        }
        if (detailDescription) {
            detailDescription.textContent = tariff.short_description || tariff.description || '';
        }

        activeTariffExtensions = Array.isArray(tariff.extensions) && tariff.extensions.length > 0
            ? tariff.extensions.map((ext) => ({
                  title: ext.title ?? tariff.title,
                  duration_days: ext.duration_days ?? ext.days ?? ext.duration ?? null,
                  price_rub: ext.price_rub ?? ext.cost ?? ext.price ?? null,
                  deposit_rub: ext.deposit_rub ?? ext.deposit ?? null,
                  raw: ext,
              }))
            : [{
                  title: tariff.title,
                  duration_days: tariff.duration_days,
                  price_rub: tariff.price_rub,
                  deposit_rub: tariff.deposit_rub ?? null,
                  raw: null,
              }];

        activeExtensionIndex = 0;

        if (tariffOptionsList) {
            tariffOptionsList.innerHTML = '';
            activeTariffExtensions.forEach((ext, idx) => {
                const option = document.createElement('label');
                option.className = 'tariff-option-item' + (idx === 0 ? ' selected' : '');
                const depositText = ext.deposit_rub ? `Залог ${formatRub(ext.deposit_rub)}` : '';
                option.innerHTML = `
                    <input type=\"radio\" name=\"tariff-duration-option\" value=\"${idx}\" ${idx === 0 ? 'checked' : ''}>
                    <div class=\"option-details\">
                        <span class=\"option-title\">${ext.title || tariff.title}</span>
                        ${formatDuration(ext) ? `<span class=\"option-duration\">${formatDuration(ext)}</span>` : ''}
                        ${depositText ? `<span class=\"option-deposit\">${depositText}</span>` : ''}
                    </div>
                    <span class=\"option-price\">${formatRub(ext.price_rub)}</span>
                `;
                const input = option.querySelector('input');
                if (input) {
                    input.addEventListener('change', () => {
                        activeExtensionIndex = idx;
                        tariffOptionsList.querySelectorAll('.tariff-option-item').forEach((el) => el.classList.remove('selected'));
                        option.classList.add('selected');
                    });
                }
                tariffOptionsList.appendChild(option);
            });
        }

        closeModal(tariffModal);
        openModal(tariffDetailModal);
    };

    const renderTariffList = async () => {
        if (!tariffList) {
            return;
        }
        const tariffs = await fetchTariffs();
        if (!tariffs.length) {
            tariffList.innerHTML = '<div class="bike-list-item">Тарифы временно недоступны</div>';
            return;
        }
        tariffList.innerHTML = '';
        tariffs.forEach((tariff) => {
            const item = document.createElement('div');
            item.className = 'bike-list-item tariff-option';
            const subtitle = tariff.short_description || tariff.description || '';
            const priceText = tariff.price_rub ? formatRub(tariff.price_rub) : '';
            const durationText = tariff.duration_days ? `${tariff.duration_days} дн.` : '';
            const meta = [priceText, durationText].filter(Boolean).join(' • ');
            item.innerHTML = `
                <strong>${tariff.title || 'Тариф'}</strong>
                <span>${meta || subtitle}</span>
            `;
            item.addEventListener('click', () => renderTariffDetail(tariff));
            tariffList.appendChild(item);
        });
    };

    const openTariffModal = async () => {
        await renderTariffList();
        openModal(tariffModal);
    };

    if (balanceAmount) {
        const balanceValue = Number(currentUser?.balance_rub || 0);
        balanceAmount.textContent = formatRub(balanceValue);
    }

    if (scanBtn) {
        scanBtn.addEventListener('click', openTariffModal);
    }

    if (balanceCard) {
        balanceCard.addEventListener('click', () => {
            openModal(topupModal);
        });
    }

    if (idInputBtn) {
        idInputBtn.addEventListener('click', () => {
            openModal(idInputModal);
        });
    }

    if (bookingBtn) {
        bookingBtn.addEventListener('click', () => {
            openModal(bookingListModal);
        });
    }

    if (rentBtn) {
        rentBtn.addEventListener('click', async () => {
            try {
                if (!selectedTariffForCheckout) {
                    alert('Пожалуйста, выберите тариф перед оплатой.');
                    return;
                }

                const tariffId = selectedTariffForCheckout.id;
                const extension = selectedTariffOption;
                const amount = Number(extension?.price_rub ?? selectedTariffForCheckout.price_rub);
                const days = Number(extension?.duration_days ?? selectedTariffForCheckout.duration_days);

                if (!Number.isFinite(amount) || amount <= 0) {
                    alert('Не удалось определить стоимость тарифа. Повторите выбор тарифа.');
                    return;
                }

                const response = await createPayment(currentUser.id, '00001', tariffId, {
                    amount,
                    days: Number.isFinite(days) && days > 0 ? days : undefined,
                    extension: extension?.raw ?? null,
                });
                if (response.confirmation_url) {
                    window.location.href = response.confirmation_url;
                }
            } catch (error) {
                alert('Ошибка: ' + error.message);
            }
        });
    }

    if (tariffModalCloseBtn) {
        tariffModalCloseBtn.addEventListener('click', () => closeModal(tariffModal));
    }

    if (tariffModal) {
        tariffModal.addEventListener('click', (event) => {
            if (event.target === tariffModal) {
                closeModal(tariffModal);
            }
        });
    }

    if (tariffDetailCloseBtn) {
        tariffDetailCloseBtn.addEventListener('click', () => {
            closeModal(tariffDetailModal);
            openModal(tariffModal);
        });
    }

    if (tariffDetailModal) {
        tariffDetailModal.addEventListener('click', (event) => {
            if (event.target === tariffDetailModal) {
                closeModal(tariffDetailModal);
                openModal(tariffModal);
            }
        });
    }

    if (selectTariffBtn) {
        selectTariffBtn.addEventListener('click', () => {
            if (!activeTariff) {
                closeModal(tariffDetailModal);
                openModal(tariffModal);
                return;
            }
            selectedTariffForCheckout = activeTariff;
            selectedTariffOption = activeTariffExtensions[activeExtensionIndex] || null;
            closeModal(tariffDetailModal);
            updateTariffLabel();
        });
    }

    updateTariffLabel();
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
