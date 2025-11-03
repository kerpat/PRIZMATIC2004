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

export async function getClient(userId) {
    if (!userId) return null;
    const data = await post('/api/data', { action: 'get-client', userId });
    return data || null;
}

export async function getActiveRental(userId) {
    if (!userId) return null;
    const data = await post('/api/data', { action: 'get-active-rental', userId });
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

    return post('/api/payments', payload);
}

export async function getRentalBatteries(rentalId) {
    if (!rentalId) return [];
    const data = await post('/api/data', { action: 'get-rental-batteries', rentalId });
    return Array.isArray(data) ? data : [];
}

export async function getAvailableBikes(city) {
    const data = await post('/api/data', { action: 'get-available-bikes', city });
    return Array.isArray(data) ? data : [];
}

export async function getTariffs(activeOnly = false) {
    const data = await post('/api/data', { action: 'get-tariffs', activeOnly });
    return Array.isArray(data) ? data : [];
}

export async function getDashboardStats() {
    return post('/api/data', { action: 'get-dashboard-stats' });
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
    return post('/api/data', payload);
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
