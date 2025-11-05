const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function post(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error || `Request to ${endpoint} failed`;
        throw new Error(message);
    }
    return data;
}

function logRequest(endpoint, payload, response) {
    if (typeof window === 'undefined') {
        return;
    }
    const stamp = new Date().toISOString();
    console.groupCollapsed(`[api.js][${stamp}] POST ${endpoint}`);
    console.log('Payload:', payload);
    console.log('Response:', response);
    console.groupEnd();
}

export async function getClient(userId) {
    if (!userId) return null;
    const payload = { action: 'get-client', userId };
    const data = await post('/api/data', payload);
    logRequest('/api/data', payload, data);
    return data || null;
}

export async function getActiveRental(userId) {
    if (!userId) return null;
    const payload = { action: 'get-active-rental', userId };
    const data = await post('/api/data', payload);
    logRequest('/api/data', payload, data);
    if (!data || data.error) {
        return null;
    }
    return data;
}

export async function createPayment(userId, bikeCode, tariffId, extra = {}) {
    const payload = {
        action: 'create-payment',
        userId,
        tariffId,
        ...extra,
    };

    if (bikeCode) {
        payload.bikeCode = bikeCode;
        payload.bikeId = bikeCode;
    }

    return post('/api/payments', payload);
}

export async function chargeFromBalance(userId, tariffId, extra = {}) {
    const payload = {
        action: 'charge-from-balance',
        userId,
        tariffId,
        ...extra,
    };

    if (payload.bikeCode && !payload.bikeId) {
        payload.bikeId = payload.bikeCode;
    }

    const result = await post('/api/payments', payload);
    
    // Отправляем уведомление об обновлении баланса
    if (result && result.new_balance !== undefined) {
        try {
            await fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'balance_update',
                    userId: userId,
                    newBalance: result.new_balance
                })
            });
        } catch (error) {
            console.error('Ошибка отправки уведомления об обновлении баланса:', error);
        }
    }
    
    return result;
}

export async function getRentalBatteries(rentalId) {
    if (!rentalId) return [];
    const data = await post('/api/data', { action: 'get-rental-batteries', rentalId });
    return Array.isArray(data) ? data : [];
}

export async function getAvailableBikes(city) {
    const payload = { action: 'get-available-bikes', city };
    const data = await post('/api/data', payload);
    logRequest('/api/data', payload, data);
    return Array.isArray(data) ? data : [];
}

export async function getTariffs(activeOnly = false) {
    const payload = { action: 'get-tariffs', activeOnly };
    const data = await post('/api/data', payload);
    logRequest('/api/data', payload, data);
    return Array.isArray(data) ? data : [];
}

export async function getDashboardStats() {
    const payload = { action: 'get-dashboard-stats' };
    const data = await post('/api/data', payload);
    logRequest('/api/data', payload, data);
    return data;
}

export async function getPaymentsHistory({ userId, startDate, endDate, paymentTypes, limit } = {}) {
    const payload = {
        action: 'get-payments-range',
        userId,
        startDate,
        endDate,
        paymentTypes,
        limit,
    };
    const response = await post('/api/data', payload);
    logRequest('/api/data', payload, response);
    return Array.isArray(response) ? response : response?.data ?? [];
}

export async function getPaymentMethodDetails(userId) {
    return post('/api/user', { action: 'get-payment-method', userId });
}

export async function unbindPaymentMethod(userId) {
    return post('/api/user', { action: 'unbind-payment-method', userId });
}

export async function updateUserCity(userId, city) {
    return post('/api/user', { action: 'update-city', userId, city });
}

export async function getSupportMessages({ userId, anonymousChatId }) {
    return post('/api/user', { action: 'get-support-messages', userId, anonymousChatId });
}

export async function sendSupportMessage(payload) {
    return post('/api/user', { action: 'send-support-message', ...payload });
}

export async function markSupportMessagesRead(payload) {
    return post('/api/user', { action: 'mark-support-read', ...payload });
}

export async function savePaymentMethod(userId) {
    return post('/api/payments', { action: 'save-card', userId });
}

export async function getPendingContracts(userId) {
    return post('/api/user', { action: 'get-pending-contracts', userId });
}

export async function getContractDetails(userId, rentalId) {
    return post('/api/user', { action: 'get-contract-details', userId, rentalId });
}

export async function confirmContractSignature({ userId, rentalId, signatureData, action = 'confirm-contract' }) {
    return post('/api/user', { action, userId, rentalId, signatureData });
}

export async function updateRentalStatus(rentalId, status) {
    if (!rentalId || !status) {
        throw new Error('Both rentalId and status are required to update rental status.');
    }

    const response = await post('/api/data', {
        action: 'update',
        table: 'rentals',
        data: { status },
        filters: [
            {
                field: 'id',
                operator: 'eq',
                value: rentalId,
            },
        ],
        returning: '*',
    });

    const rows = Array.isArray(response?.data) ? response.data : [];
    const updatedRental = rows.length > 0 ? rows[0] : null;
    
    // Отправляем уведомление о изменении статуса аренды
    if (updatedRental && updatedRental.user_id) {
        // Отправляем запрос на сервер для уведомления пользователя
        try {
            await fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'rental_status_change',
                    userId: updatedRental.user_id,
                    rentalId: updatedRental.id,
                    newStatus: status,
                    rentalData: updatedRental
                })
            });
        } catch (error) {
            console.error('Ошибка отправки уведомления о статусе аренды:', error);
        }
    }
    
    return updatedRental;
}
