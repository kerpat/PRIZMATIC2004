// Скрипт для админ‑панели.
//
// В этом файле реализована простая аутентификация и базовые операции
// CRUD для тарифов, а также каркас для отображения клиентов, аренд и
// платежей. Для работы с реальной базой требуется Supabase.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const adminNav = document.getElementById('admin-nav');

    const dashboardMainSection = document.getElementById('dashboard-main-section');

    const tariffsSection = document.getElementById('tariffs-section');
    const clientsSection = document.getElementById('clients-section');
    const rentalsSection = document.getElementById('rentals-section');
    const paymentsSection = document.getElementById('payments-section');
    const bikesSection = document.getElementById('bikes-section');
    const assignmentsSection = document.getElementById('assignments-section');
    const templatesSection = document.getElementById('templates-section');

    // Rentals elements
    const rentalsTableBody = document.querySelector('#rentals-table tbody');

    // Tariff elements
    const tariffTableBody = document.querySelector('#tariffs-table tbody');
    const tariffAddBtn = document.getElementById('tariff-add-btn');
    const tariffModal = document.getElementById('tariff-modal');
    const tariffModalTitle = document.getElementById('tariff-modal-title');
    const tariffModalCloseBtn = document.getElementById('tariff-modal-close-btn');
    const tariffIdInput = document.getElementById('tariff-id');
    const tariffTitleInput = document.getElementById('tariff-title');
    const tariffShortDescriptionInput = document.getElementById('tariff-short-description');
    const tariffDescriptionInput = document.getElementById('tariff-description');
    const tariffActiveCheckbox = document.getElementById('tariff-active');
    const extensionsList = document.getElementById('extensions-list');
    const addExtensionBtn = document.getElementById('add-extension-btn');
    const contractTemplateSelect = document.getElementById('contract-template-select');

    // Tariff modal step navigation
    const tariffPrevBtn = document.getElementById('tariff-prev-btn');
    const tariffNextBtn = document.getElementById('tariff-next-btn');
    const tariffSaveBtn = document.getElementById('tariff-save-btn');
    const tariffStep1 = document.getElementById('tariff-step-1');
    const tariffStep2 = document.getElementById('tariff-step-2');
    const tariffStep3 = document.getElementById('tariff-step-3');

    // Client elements
    const clientsTableBody = document.querySelector('#clients-table tbody');
    const clientEditOverlay = document.getElementById('client-edit-overlay');
    const clientEditForm = document.getElementById('client-edit-form');
    const clientEditCancelBtn = document.getElementById('client-edit-cancel');
    const clientEditSaveBtn = document.getElementById('client-edit-save');
    const clientInfoOverlay = document.getElementById('client-info-overlay');
    const clientInfoContent = document.getElementById('client-info-content');
    const clientInfoCloseBtn = document.getElementById('client-info-close');
    const clientInfoCloseBtn2 = document.getElementById('client-info-close-2');
    const clientInfoEditToggle = document.getElementById('client-info-edit-toggle');
    const clientInfoSaveBtn = document.getElementById('client-info-save');
    const recognizedDisplay = document.getElementById('recognized-display');
    const recognizedEditForm = document.getElementById('recognized-edit-form');
    const imageViewerOverlay = document.getElementById('image-viewer-overlay');
    const imageViewerImg = document.getElementById('image-viewer-img');
    const imageViewerClose = document.getElementById('image-viewer-close');
    const imageViewerPrev = document.getElementById('image-viewer-prev');
    const imageViewerNext = document.getElementById('image-viewer-next');
    let viewerImages = [];
    let viewerIndex = 0;
    // keep last caret position inside template editor
    let lastSelRange = null;
    const exportBtn = document.getElementById('export-clients-btn');

    // Bike elements
    const bikesTableBody = document.querySelector('#bikes-table tbody');
    const bikeAddBtn = document.getElementById('bike-add-btn');
    const bikeModal = document.getElementById('bike-modal');
    const bikeModalTitle = document.getElementById('bike-modal-title');
    const bikeModalCloseBtn = document.getElementById('bike-modal-close-btn');
    const bikeIdInput = document.getElementById('bike-id');
    const bikeCodeInput = document.getElementById('bike-code');
    const bikeModelInput = document.getElementById('bike-model');
    const bikeCitySelect = document.getElementById('bike-city');
    const bikeStatusSelect = document.getElementById('bike-status');
    const bikeFrameNumberInput = document.getElementById('bike-frame-number');
    const bikeBatteryNumbersInput = document.getElementById('bike-battery-numbers');
    const bikeRegistrationNumberInput = document.getElementById('bike-registration-number');
    const bikeIotDeviceIdInput = document.getElementById('bike-iot-device-id');
    const bikeAdditionalEquipmentInput = document.getElementById('bike-additional-equipment');
    const bikeTariffSelect = document.getElementById('bike-tariff-select');

    // Bike modal step navigation
    const bikePrevBtn = document.getElementById('bike-prev-btn');
    const bikeNextBtn = document.getElementById('bike-next-btn');
    const bikeSaveBtn = document.getElementById('bike-save-btn');
    const bikeStep1 = document.getElementById('bike-step-1');
    const bikeStep2 = document.getElementById('bike-step-2');
    const bikeStep3 = document.getElementById('bike-step-3');

    // Battery elements (НОВЫЙ БЛОК)
    const batteriesSection = document.getElementById('batteries-section');
    const batteriesTableBody = document.querySelector('#batteries-table tbody');
    const batteryAddBtn = document.getElementById('battery-add-btn');
    const batteryModal = document.getElementById('battery-modal');
    const batteryModalTitle = document.getElementById('battery-modal-title');
    const batteryModalCloseBtn = document.getElementById('battery-modal-close-btn');
    const batteryIdInput = document.getElementById('battery-id');
    const batterySerialNumberInput = document.getElementById('battery-serial-number');
    const batteryCapacityInput = document.getElementById('battery-capacity');
    const batteryDescriptionInput = document.getElementById('battery-description');
    const batteryStatusSelect = document.getElementById('battery-status');
    const batteryPrevBtn = document.getElementById('battery-prev-btn');
    const batteryNextBtn = document.getElementById('battery-next-btn');
    const batterySaveBtn = document.getElementById('battery-save-btn');
    const batteryStep1 = document.getElementById('battery-step-1');
    const batteryStep2 = document.getElementById('battery-step-2');
    const batteryStep3 = document.getElementById('battery-step-3');

    // Battery Assignment Modal elements (НОВЫЙ БЛОК)
    const assignBatteriesModal = document.getElementById('assign-batteries-modal');
    const assignBatteriesRentalIdInput = document.getElementById('assign-batteries-rental-id');
    const batteryModalBikeSelect = document.getElementById('battery-modal-bike-select');
    const batterySearchInModal = document.getElementById('battery-search-in-modal');
    const batterySelectList = document.getElementById('battery-select-list');
    const assignBatteriesCancelBtn = document.getElementById('assign-batteries-cancel-btn');
    const assignBatteriesSubmitBtn = document.getElementById('assign-batteries-submit-btn');

    // Booking Cost Setup elements (НОВЫЙ БЛОК)
    const setupBookingCostBtn = document.getElementById('setup-booking-cost-btn');
    const bookingCostModal = document.getElementById('booking-cost-modal');
    const bookingCostCancelBtn = document.getElementById('booking-cost-cancel-btn');
    const bookingCostSaveBtn = document.getElementById('booking-cost-save-btn');
    const bookingCostInput = document.getElementById('booking-cost-input');

    // Отладка: проверяем что все элементы найдены
    console.log('DOM элементы для АКБ:');
    console.log('assignBatteriesModal:', assignBatteriesModal);
    console.log('assignBatteriesRentalIdInput:', assignBatteriesRentalIdInput);
    console.log('batterySelectList:', batterySelectList);

    // Assignment elements
    const assignmentsTableBody = document.querySelector('#assignments-table tbody');
    const assignBikeModal = document.getElementById('assign-bike-modal');
    const assignRentalIdInput = document.getElementById('assign-rental-id');
    const bikeSelect = document.getElementById('bike-select');
    const assignBikeCancelBtn = document.getElementById('assign-bike-cancel-btn');
    const assignBikeSubmitBtn = document.getElementById('assign-bike-submit-btn');
    const assignBikeFrameNumberInput = document.getElementById('assign-bike-frame-number');
    const assignBikeBatteryNumbersInput = document.getElementById('assign-bike-battery-numbers');
    const assignBikeRegistrationNumberInput = document.getElementById('assign-bike-registration-number');
    const assignBikeIotDeviceIdInput = document.getElementById('assign-bike-iot-device-id');
    const assignBikeAdditionalEquipmentInput = document.getElementById('assign-bike-additional-equipment');
    const bikeDetailsDiv = document.getElementById('bike-details');

    // Invoice elements
    const invoiceCreateBtn = document.getElementById('invoice-create-btn');
    const invoiceModal = document.getElementById('invoice-modal');
    const invoiceCancelBtn = document.getElementById('invoice-cancel-btn');
    const invoiceSubmitBtn = document.getElementById('invoice-submit-btn');
    const invoiceClientIdInput = document.getElementById('invoice-client-id');
    const invoiceAmountInput = document.getElementById('invoice-amount');
    const invoiceDescriptionInput = document.getElementById('invoice-description');

    // Templates elements
    const templatesTableBody = document.querySelector('#templates-table tbody');
    const templateNewBtn = document.getElementById('template-new-btn');
    const templateSaveBtn = document.getElementById('template-save-btn');
    const templateIdInput = document.getElementById('template-id');
    const templateNameInput = document.getElementById('template-name');
    const templateActiveCheckbox = document.getElementById('template-active');
    const templateEditor = document.getElementById('template-editor');
    const chipsClient = document.getElementById('chips-client');
    const chipsTariff = document.getElementById('chips-tariff');
    const chipsRental = document.getElementById('chips-rental');
    const chipsAux = document.getElementById('chips-aux');
    const editorToolbar = document.querySelector('.editor-toolbar');

    // --- State Variables ---
    let clientsData = []; // Кэш данных клиентов для просмотра/редактирования
    let currentEditingId = null;
    let currentEditingExtra = null;
    let bookingUpdateInterval = null; // Таймер для обновления броней
    let templateEditorInstance = null; // TipTap editor instance

    // --- Map Logic (НОВЫЙ БЛОК) ---
    const adminMapSection = document.getElementById('admin-map-section');
    let myMap = null;
    let objectManager = null;
    let mapInitialized = false;
    let mapClientsData = []; // Храним данные клиентов для поиска на карте

    // Инициализация карты (вызывается один раз)
    function initAdminMap() {
        if (mapInitialized || !document.getElementById('admin-map-container')) {
            return;
        }
        mapInitialized = true; // Ставим флаг, что карта создана

        ymaps.ready(() => {
            myMap = new ymaps.Map("admin-map-container", {
                center: [55.76, 37.64], // Москва
                zoom: 10,
                controls: [] // Отключаем все стандартные элементы управления
            });

            objectManager = new ymaps.ObjectManager({ clusterize: true, gridSize: 64 });
            myMap.geoObjects.add(objectManager);

            // Загружаем данные сразу после инициализации
            loadAndDrawMapData();
            // Устанавливаем интервал обновления
            setInterval(loadAndDrawMapData, 20000);

            // Вешаем обработчики на поле поиска курьеров
            const courierSearchInput = document.getElementById('courier-search-input');
            const searchResults = document.getElementById('courier-search-results');

            if (courierSearchInput && searchResults) {
                let selectedIndex = -1;

                courierSearchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase().trim();
                    selectedIndex = -1;

                    if (query.length === 0) {
                        searchResults.style.display = 'none';
                        return;
                    }

                    const filteredClients = mapClientsData.filter(client =>
                        client.name.toLowerCase().includes(query)
                    );

                    if (filteredClients.length === 0) {
                        searchResults.style.display = 'none';
                        return;
                    }

                    searchResults.innerHTML = '';
                    filteredClients.forEach((client, index) => {
                        const resultItem = document.createElement('div');
                        resultItem.className = 'search-result-item';
                        resultItem.textContent = client.name;
                        resultItem.dataset.clientId = client.id;
                        resultItem.dataset.coords = `${client.location_geojson.coordinates[1]},${client.location_geojson.coordinates[0]}`;
                        resultItem.addEventListener('click', () => selectCourier(client));
                        searchResults.appendChild(resultItem);
                    });

                    searchResults.style.display = 'block';
                });

                courierSearchInput.addEventListener('keydown', (e) => {
                    const items = searchResults.querySelectorAll('.search-result-item');

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                        updateSelection(items);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        selectedIndex = Math.max(selectedIndex - 1, -1);
                        updateSelection(items);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedIndex >= 0 && items[selectedIndex]) {
                            const client = mapClientsData.find(c => c.id == items[selectedIndex].dataset.clientId);
                            if (client) selectCourier(client);
                        }
                    } else if (e.key === 'Escape') {
                        searchResults.style.display = 'none';
                        courierSearchInput.blur();
                    }
                });

                // Скрываем результаты при клике вне поля поиска
                document.addEventListener('click', (e) => {
                    if (!courierSearchInput.contains(e.target) && !searchResults.contains(e.target)) {
                        searchResults.style.display = 'none';
                    }
                });

                function updateSelection(items) {
                    items.forEach((item, index) => {
                        item.classList.toggle('active', index === selectedIndex);
                    });
                }

                function selectCourier(client) {
                    if (!myMap) return;

                    const coords = [client.location_geojson.coordinates[1], client.location_geojson.coordinates[0]];
                    myMap.panTo(coords, { flying: true, duration: 1500 }).then(() => {
                        myMap.setZoom(15, { duration: 500 });
                    });

                    courierSearchInput.value = client.name;
                    searchResults.style.display = 'none';
                    courierSearchInput.blur();
                }
            }
        });
    }

    // Загрузка и отрисовка данных на карте
    async function loadAndDrawMapData() {
        if (!objectManager) {
            console.warn("ObjectManager не инициализирован. Загрузка данных отложена.");
            return;
        }

        try {
            const [bikesRes, clientsRes] = await Promise.all([
                supabase.rpc('get_bikes_with_locations'),
                supabase.rpc('get_clients_with_locations')
            ]);

            if (bikesRes.error) throw bikesRes.error;
            if (clientsRes.error) throw clientsRes.error;

            // Сохраняем данные клиентов для поиска
            mapClientsData = clientsRes.data.filter(c => c.location_geojson && c.location_geojson.coordinates);

            // Формирование объектов для карты
            const bikeFeatures = bikesRes.data.filter(b => b.location_geojson).map(bike => ({
                type: 'Feature',
                id: `bike_${bike.id}`,
                geometry: { type: 'Point', coordinates: [bike.location_geojson.coordinates[1], bike.location_geojson.coordinates[0]] },
                properties: {
                    hintContent: `${bike.model_name || 'Велосипед'} (${bike.bike_code})`,
                    balloonContent: `<strong>${bike.model_name}</strong><br>Код: ${bike.bike_code}<br>Статус: ${bike.status}`
                },
                options: { preset: 'islands#dotIcon', iconColor: getBikeIconColor(bike.status) }
            }));

            const clientFeatures = clientsRes.data.filter(c => c.location_geojson).map(client => ({
                type: 'Feature',
                id: `client_${client.id}`,
                geometry: { type: 'Point', coordinates: [client.location_geojson.coordinates[1], client.location_geojson.coordinates[0]] },
                properties: {
                    hintContent: `Курьер: ${client.name}`,
                    balloonContent: `<strong>${client.name}</strong><br>ID: ${client.id}`
                },
                options: { preset: 'islands#userIcon', iconColor: '#ff0000' }
            }));

            objectManager.removeAll();
            objectManager.add({ type: 'FeatureCollection', features: [...bikeFeatures, ...clientFeatures] });

        } catch (err) {
            console.error("Ошибка загрузки данных для карты:", err);
        }
    }

    function getBikeIconColor(status) {
        switch (status) {
            case 'available': return '#40A4DF';
            case 'rented': return '#1e98ff';
            case 'in_service': return '#f5a623';
            default: return '#777777';
        }
    }
    // --- Конец блока для карты ---

    // --- Supabase Initialization ---
    // Check if CONFIG is loaded
    if (typeof window.CONFIG === 'undefined') {
        console.error('CONFIG is not loaded! Make sure config.js is loaded before admin.js');
        alert('Configuration error. Please check console.');
        return;
    }

    const SUPABASE_URL = window.CONFIG.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.CONFIG.SUPABASE_ANON_KEY;
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Вспомогательная функция для выполнения fetch-запросов с аутентификацией
    async function authedFetch(url, options = {}) {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            alert('Ваша сессия истекла. Пожалуйста, войдите заново.');
            throw new Error('Нет активной сессии для выполнения запроса.');
        }

        const headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`
        };

        const config = {
            ...options,
            headers: {
                ...headers,
                ...options.headers,
            },
        };

        // For Vercel environment, use relative path.
        const baseUrl = window.location.origin;
        return fetch(new URL(url, baseUrl), config);
    }

    function toggleButtonLoading(btn, isLoading, textIdle, textBusy) {
        if (!btn) return;
        btn.disabled = !!isLoading;
        btn.textContent = isLoading ? textBusy : textIdle;
    }

    // --- Status Translation and Color Coding System ---

    /**
     * Returns Russian translation and CSS classes for different status types
     * @param {string} status - The status value
     * @param {string} type - The type of status ('bike', 'rental', 'client', 'payment')
     * @returns {Object} { text: string, className: string }
     */
    function getStatusDisplay(status, type) {
        const statusMaps = {
            bike: {
                'available': { text: 'Свободен', className: 'status-success' },
                'rented': { text: 'В аренде', className: 'status-warning' },
                'in_service': { text: 'В ремонте', className: 'status-error' },
                'maintenance': { text: 'Обслуживание', className: 'status-info' },
                'out_of_order': { text: 'Неисправен', className: 'status-error' },
                'reserved': { text: 'Зарезервирован', className: 'status-info' },
                'unavailable': { text: 'Недоступен', className: 'status-neutral' }
            },
            rental: {
                'active': { text: 'Активна', className: 'status-success' },
                'awaiting_battery_assignment': { text: 'Ожидает АКБ', className: 'status-warning' },
                'awaiting_contract_signing': { text: 'Ожидает подписания', className: 'status-warning' },
                'completed_by_admin': { text: 'Завершено админом', className: 'status-info' },
                'pending_assignment': { text: 'Ожидает велосипед', className: 'status-warning' },
                'pending_return': { text: 'Ожидает сдачи', className: 'status-warning' },
                'completed': { text: 'Завершена', className: 'status-neutral' },
                'rejected': { text: 'Отклонена', className: 'status-error' },
                'awaiting_return_signature': { text: 'Ожидает подписи акта', className: 'status-warning' }
            },
            client: {
                'approved': { text: 'Одобрен', className: 'status-success' },
                'rejected': { text: 'Отклонен', className: 'status-error' },
                'pending': { text: 'На проверке', className: 'status-warning' },
                'needs_confirmation': { text: 'Требует подтверждения', className: 'status-warning' },
                'not_set': { text: 'Не задан', className: 'status-neutral' }
            },
            payment: {
                'succeeded': { text: 'Успешно', className: 'status-success' },
                'pending': { text: 'Ожидает', className: 'status-warning' },
                'canceled': { text: 'Отменён', className: 'status-error' },
                'failed': { text: 'Ошибка', className: 'status-error' },
                'refunded': { text: 'Возвращено', className: 'status-neutral' }
            },
            assignment: {
                'pending_assignment': { text: 'Аренда', className: 'status-success' },
                'pending_return': { text: 'Сдача', className: 'status-warning' }
            },
            battery: {
                'available': { text: 'Свободна', className: 'status-success' },
                'in_use': { text: 'В использовании', className: 'status-warning' },
                'damaged': { text: 'Повреждена', className: 'status-error' },
                'maintenance': { text: 'Обслуживание', className: 'status-info' },
                'unavailable': { text: 'Недоступна', className: 'status-neutral' }
            }
        };

        const typeMap = statusMaps[type] || {};
        return typeMap[status] || { text: status || 'Неизвестно', className: 'status-neutral' };
    }

    // Payment type labels for admin panel
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

    // Payment method labels for admin panel
    const paymentMethodLabels = {
        'card': 'Карта',
        'sbp': 'СБП',
        'balance': 'Баланс',
        'yoo_money': 'ЮMoney'
    };

    /**
     * Creates a status badge HTML element
     * @param {string} status - The status value
     * @param {string} type - The type of status
     * @returns {string} HTML string for the status badge
     */
    function createStatusBadge(status, type) {
        const { text, className } = getStatusDisplay(status, type);
        return `<span class="status-badge ${className}">${text}</span>`;
    }

    // --- Tariff Extensions Logic ---

    // Словарь для перевода ключей распознанных данных
    const fieldTranslations = {
        'gender': 'Пол',
        'number': 'Номер',
        'series': 'Серия',
        'full_name': 'ФИО',
        'last_name': 'Фамилия',
        'birth_date': 'Дата рождения',
        'first_name': 'Имя',
        'issue_date': 'Дата выдачи',
        'birth_place': 'Место рождения',
        'middle_name': 'Отчество',
        'issuing_authority': 'Кем выдан',
        'registration_address': 'Адрес регистрации'
    };

    // Helper: render client info modal (view + edit + photos + lightbox)
    async function renderClientInfo(clientId) {
        try {
            const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
            if (error) throw error;

            const rec = client?.recognized_passport_data || client?.extra?.recognized_data || {};
            if (recognizedDisplay) {
                recognizedDisplay.innerHTML = '';
                const keys = Object.keys(rec);
                if (keys.length === 0) {
                    recognizedDisplay.innerHTML = '<p>Данных распознавания нет.</p>';
                } else {
                    keys.forEach(k => {
                        const row = document.createElement('div');
                        row.className = 'info-row';
                        const label = fieldTranslations[k] || k;
                        row.innerHTML = `<strong>${label}:</strong><span>${rec[k] ?? ''}</span>`;
                        recognizedDisplay.appendChild(row);
                    });
                }
            }
            if (recognizedEditForm) {
                recognizedEditForm.innerHTML = '';
                Object.keys(rec).forEach(k => {
                    const item = document.createElement('div');
                    item.className = 'form-group';
                    const val = (rec[k] ?? '').toString().replace(/"/g, '&quot;');
                    const label = fieldTranslations[k] || k;
                    item.innerHTML = `<label>${label}</label><input type="text" name="${k}" value="${val}">`;
                    recognizedEditForm.appendChild(item);
                });
                recognizedEditForm.classList.add('hidden');
                if (clientInfoEditToggle) clientInfoEditToggle.textContent = 'Редактировать';
                if (clientInfoSaveBtn) clientInfoSaveBtn.classList.add('hidden');
            }

            // ---> ИСПРАВЛЕНИЕ №2: Используем Telegram ID для поиска фото <---
            const photosDiv = document.getElementById('photo-links');
            if (photosDiv) {
                photosDiv.innerHTML = 'Загрузка...';
                try {
                    // 1. Извлекаем Telegram ID из колонки extra
                    const telegramId = client?.extra?.telegram_user_id;

                    if (!telegramId) {
                        throw new Error('Telegram ID не найден в данных клиента.');
                    }

                    // 2. Ищем папку в Storage по Telegram ID
                    const { data: files, error: fErr } = await supabase.storage.from('passports').list(String(telegramId));
                    if (fErr) throw fErr;

                    if (!files || files.length === 0) {
                        photosDiv.innerHTML = '<p>Фото не найдены.</p>';
                        viewerImages = [];
                    } else {
                        photosDiv.innerHTML = '';
                        // 3. Строим публичные URL, используя Telegram ID
                        viewerImages = files.map(f => supabase.storage.from('passports').getPublicUrl(`${telegramId}/${f.name}`).data.publicUrl);

                        viewerIndex = 0;
                        viewerImages.forEach(u => {
                            const img = document.createElement('img');
                            img.src = u;
                            img.className = 'client-photo-thumb';
                            img.style.maxHeight = '200px'; // Добавьте в код
                            img.addEventListener('click', () => {
                                if (imageViewerOverlay && imageViewerImg) {
                                    imageViewerImg.src = u;
                                    viewerIndex = viewerImages.indexOf(u);
                                    imageViewerOverlay.classList.remove('hidden');
                                }
                            });
                            photosDiv.appendChild(img);
                        });

                        // Add video if exists
                        if (client?.extra?.video_selfie_storage_path) {
                            const videoUrl = supabase.storage.from('passports').getPublicUrl(client.extra.video_selfie_storage_path).data.publicUrl;
                            const video = document.createElement('video');
                            video.src = videoUrl;
                            video.controls = true;
                            video.className = 'client-video-thumb';
                            video.style.maxWidth = '200px';
                            video.style.marginTop = '10px';
                            photosDiv.appendChild(video);
                        }
                    }
                } catch (e) {
                    photosDiv.innerHTML = `<p style="color:red;">Ошибка загрузки фото: ${e.message}</p>`;
                }
            }

            // Toggle edit/view
            currentEditingId = client.id;
            currentEditingExtra = client.extra || {};
            if (clientInfoSaveBtn) {
                clientInfoSaveBtn.onclick = async () => {
                    const formData = new FormData(recognizedEditForm);
                    const updated = {};
                    for (const [k, v] of formData.entries()) updated[k] = String(v);
                    const { error: uerr } = await supabase.from('clients').update({ recognized_passport_data: updated }).eq('id', currentEditingId);
                    if (uerr) { alert('Ошибка сохранения: ' + uerr.message); return; }
                    // refresh view
                    recognizedDisplay.innerHTML = '';
                    Object.keys(updated).forEach(k => {
                        const r = document.createElement('div');
                        r.className = 'info-row';
                        const label = fieldTranslations[k] || k;
                        r.innerHTML = `<strong>${label}:</strong><span>${updated[k]}</span>`;
                        recognizedDisplay.appendChild(r);
                    });
                    clientInfoEditToggle.click();
                };
            }

            // Render tags and notes
            renderTags(currentEditingExtra.tags || []);
            renderNotes(currentEditingExtra.notes || []);

            // Toggle edit/view functionality
            if (clientInfoEditToggle) {
                clientInfoEditToggle.onclick = () => {
                    const editing = !recognizedEditForm.classList.contains('hidden');
                    if (editing) {
                        recognizedEditForm.classList.add('hidden');
                        recognizedDisplay.classList.remove('hidden');
                        clientInfoEditToggle.textContent = 'Редактировать';
                        if (clientInfoSaveBtn) clientInfoSaveBtn.classList.add('hidden');
                        // Show footer buttons
                        document.getElementById('add-tag-footer-btn').style.display = 'inline-block';
                        document.getElementById('add-note-footer-btn').style.display = 'inline-block';
                        document.getElementById('invoice-create-btn').style.display = 'inline-block';
                        document.getElementById('balance-adjust-btn').style.display = 'inline-block';
                        document.getElementById('client-info-close-2').style.display = 'inline-block';
                    } else {
                        recognizedEditForm.classList.remove('hidden');
                        recognizedDisplay.classList.add('hidden');
                        clientInfoEditToggle.textContent = 'Просмотр';
                        if (clientInfoSaveBtn) clientInfoSaveBtn.classList.remove('hidden');
                        // Hide footer buttons except save
                        document.getElementById('add-tag-footer-btn').style.display = 'none';
                        document.getElementById('add-note-footer-btn').style.display = 'none';
                        document.getElementById('invoice-create-btn').style.display = 'none';
                        document.getElementById('balance-adjust-btn').style.display = 'none';
                        document.getElementById('client-info-close-2').style.display = 'none';
                    }
                };
            }

            // lightbox arrows
            if (imageViewerPrev) imageViewerPrev.onclick = () => {
                if (!viewerImages.length) return;
                viewerIndex = (viewerIndex - 1 + viewerImages.length) % viewerImages.length;
                imageViewerImg.src = viewerImages[viewerIndex];
            };
            if (imageViewerNext) imageViewerNext.onclick = () => {
                if (!viewerImages.length) return;
                viewerIndex = (viewerIndex + 1) % viewerImages.length;
                imageViewerImg.src = viewerImages[viewerIndex];
            };
        } catch (e) {
            console.error('Ошибка подготовки карточки клиента:', e);
        }
    }

    function addExtensionRow(daysVal = '', priceVal = '') {
        if (!extensionsList) return;
        const row = document.createElement('div');
        row.className = 'extension-row';
        row.innerHTML = `
            <input type="number" placeholder="Дней" value="${daysVal}" class="ext-days">
            <input type="number" placeholder="Стоимость (₽)" value="${priceVal}" class="ext-price">
            <button type="button" class="remove-extension-btn" title="Удалить">×</button>
        `;
        row.querySelector('.remove-extension-btn').addEventListener('click', () => row.remove());
        extensionsList.appendChild(row);
    }

    function renderExtensions(extArr) {
        if (!extensionsList) return;
        extensionsList.innerHTML = '';
        if (Array.isArray(extArr)) {
            extArr.forEach(ext => {
                const d = ext?.days || ext?.duration;
                const c = ext?.price_rub || ext?.cost || ext?.price;
                addExtensionRow(d || '', c || '');
            });
        }
    }

    function getExtensionsFromForm() {
        if (!extensionsList) return [];
        return Array.from(extensionsList.querySelectorAll('.extension-row')).map(row => {
            const days = parseInt(row.querySelector('.ext-days').value, 10);
            const price_rub = parseInt(row.querySelector('.ext-price').value, 10);
            return { days, price_rub };
        }).filter(ext => !isNaN(ext.days) && !isNaN(ext.price_rub) && ext.days > 0 && ext.price_rub >= 0);
    }

    if (addExtensionBtn) {
        addExtensionBtn.addEventListener('click', () => addExtensionRow());
    }

    // --- Authentication and Navigation ---

    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            showDashboard();
        }
    }

    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        selectSection('dashboard-main');
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmail.value;
        const password = loginPassword.value;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert('Ошибка входа: ' + error.message);
        } else if (data.user) {
            showDashboard();
        }
    });

    adminNav.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-section]');
        if (!btn) return;
        const target = btn.dataset.section;
        adminNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectSection(target);
    });

    function selectSection(name) {
        const adminAppContainer = document.getElementById('admin-app'); // Находим главный контейнер

        // Перед сменой секции всегда останавливаем таймер броней
        if (bookingUpdateInterval) {
            clearInterval(bookingUpdateInterval);
            bookingUpdateInterval = null;
        }

        // Скрываем все секции
        document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));

        const sectionMap = {
            'dashboard-main': { element: dashboardMainSection, loader: loadDashboardData },
            'tariffs': { element: tariffsSection, loader: loadTariffs },
            'clients': { element: clientsSection, loader: loadClients },
            'rentals': { element: rentalsSection, loader: loadRentals },
            'payments': { element: paymentsSection, loader: loadPayments },
            'bikes': { element: bikesSection, loader: loadBikes },
            'batteries': { element: batteriesSection, loader: loadBatteries }, // <-- ДОБАВЬ ЭТУ СТРОКУ
            'assignments': { element: assignmentsSection, loader: loadAssignments },
            'bookings': { element: document.getElementById('bookings-section'), loader: loadBookings }, // +++ ДОБАВИТЬ ЭТУ СТРОКУ +++
            'templates': { element: templatesSection, loader: loadTemplates },
            'admin-map': { element: adminMapSection, loader: initAdminMap }, // <-- ИЗМЕНЕНИЕ
        };

        const section = sectionMap[name];
        if (section && section.element) {
            section.element.classList.remove('hidden'); // Показываем нужную секцию
            if (section.loader) {
                section.loader(); // Вызываем её загрузчик/инициализатор
            }
        }

        // --- НОВЫЙ КОД: УПРАВЛЕНИЕ ШИРИНОЙ КОНТЕЙНЕРА ---
        // Если выбрана секция 'rentals' ИЛИ 'bikes' ИЛИ 'bookings', добавляем класс, иначе — убираем.
        if (adminAppContainer) {
            if (name === 'rentals' || name === 'bikes' || name === 'bookings') {
                adminAppContainer.classList.add('wide-content');
            } else {
                adminAppContainer.classList.remove('wide-content');
            }
        }
    }

    // --- Tariffs CRUD ---

    function formatExtensionsForDisplay(exts) {
        if (!Array.isArray(exts) || exts.length === 0) return 'Не заданы';
        return exts.map(e => `${e.days} дн. - ${e.price_rub || e.cost || 0} ₽`).join('<br>');
    }

    async function loadTariffs() {
        tariffTableBody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase.from('tariffs').select('*').order('id', { ascending: true });
            if (error) throw error;
            tariffTableBody.innerHTML = '';
            if (!data || data.length === 0) {
                tariffTableBody.innerHTML = '<tr><td colspan="5">Тарифы еще не созданы.</td></tr>';
                return;
            }
            data.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><a href="#" class="tariff-name-link" data-id="${t.id}" style="color: var(--primary-color); text-decoration: none;">${t.title}</a></td>
                    <td>${t.short_description || ''}</td>
                    <td>${formatExtensionsForDisplay(t.extensions)}</td>
                    <td>${t.is_active ? 'Да' : 'Нет'}</td>
                    <td>
                        <button type="button" class="preview-tariff-btn" data-id="${t.id}">Предпросмотр</button>
                        <button type="button" class="edit-tariff-btn" data-id="${t.id}">Ред.</button>
                        <button type="button" class="delete-tariff-btn" data-id="${t.id}">Удалить</button>
                    </td>`;
                tariffTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки тарифов:', err);
            tariffTableBody.innerHTML = `<tr><td colspan="5">Ошибка: ${err.message}</td></tr>`;
        }
    }

    // Old tariff form handler removed - now using modal

    tariffTableBody.addEventListener('click', async (e) => {
        const nameLink = e.target.closest('.tariff-name-link');
        if (nameLink) {
            e.preventDefault();
            previewTariffFull(nameLink.dataset.id);
            return;
        }

        const previewBtn = e.target.closest('.preview-tariff-btn');
        if (previewBtn) {
            const tariffId = previewBtn.dataset.id;
            await showClientTariffPreview(tariffId);
            return;
        }

        const editBtn = e.target.closest('.edit-tariff-btn');
        if (editBtn) {
            if (window.editTariffModal) {
                window.editTariffModal(editBtn.dataset.id);
            }
            return;
        }

        const deleteBtn = e.target.closest('.delete-tariff-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm(`Вы уверены, что хотите удалить тариф с ID ${id}? Это действие необратимо.`)) {
                try {
                    const { error } = await supabase.from('tariffs').delete().eq('id', id);
                    if (error) throw error;
                    alert('Тариф успешно удален.');
                    loadTariffs();
                } catch (err) {
                    alert('Ошибка удаления: ' + err.message);
                }
            }
        }
    });

    // Old tariff form functions removed - now using modal

    async function previewTariffCard(id) {
        try {
            const { data, error } = await supabase.from('tariffs').select('*').eq('id', id).single();
            if (error) throw error;
            const content = document.getElementById('tariff-preview-content');
            content.innerHTML = `
                <div style="border: 1px solid #ddd; padding: 16px; border-radius: 12px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <strong style="display: block; font-size: 1.2rem; margin-bottom: 8px;">${data.title}</strong>
                    <span style="display: block; font-size: 1rem; color: #666; margin-bottom: 8px;">${data.price_rub} ₽ / ${data.duration_days} дней</span>
                    <p style="font-size: 0.9rem; color: #888; margin: 0;">${data.short_description || ''}</p>
                </div>
            `;
            document.getElementById('tariff-preview-modal').classList.remove('hidden');
        } catch (err) {
            alert('Ошибка предпросмотра: ' + err.message);
        }
    }

    async function previewTariffFull(id) {
        try {
            const { data, error } = await supabase.from('tariffs').select('*').eq('id', id).single();
            if (error) throw error;
            const content = document.getElementById('tariff-preview-content');
            content.innerHTML = `
                <div style="border: 1px solid var(--progress-bar-bg); padding: 16px; border-radius: 8px; background: var(--card-bg);">
                    <h3>${data.title}</h3>
                    <p><strong>Цена:</strong> ${data.price_rub} ₽</p>
                    <p><strong>Длительность:</strong> ${data.duration_days} дней</p>
                    <p><strong>Описание:</strong></p>
                    <div style="white-space: pre-wrap;">${data.description || ''}</div>
                </div>
            `;
            document.getElementById('tariff-preview-modal').classList.remove('hidden');
        } catch (err) {
            alert('Ошибка предпросмотра: ' + err.message);
        }
    }

    document.getElementById('tariff-preview-close-btn').addEventListener('click', () => {
        document.getElementById('tariff-preview-modal').classList.add('hidden');
    });

    document.getElementById('tariff-preview-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('tariff-preview-modal')) {
            document.getElementById('tariff-preview-modal').classList.add('hidden');
        }
    });

    // --- Refund Logic ---
    const refundModal = document.getElementById('refund-modal');
    const refundCancelBtn = document.getElementById('refund-cancel-btn');
    const refundSubmitBtn = document.getElementById('refund-submit-btn');
    const refundPaymentIdInput = document.getElementById('refund-payment-id');
    const refundAmountInput = document.getElementById('refund-amount');
    const refundReasonInput = document.getElementById('refund-reason');
    const paymentsTableBody = document.querySelector('#payments-table tbody');

    // --- Payment Details Modal ---
    const paymentDetailsModal = document.getElementById('payment-details-modal');
    const paymentDetailsCloseBtn = document.getElementById('payment-details-close-btn');
    const paymentDetailsContent = document.getElementById('payment-details-content');

    if (paymentsTableBody) {
        paymentsTableBody.addEventListener('click', (e) => {
            // Handle refund button click
            const refundBtn = e.target.closest('.refund-btn');
            if (refundBtn) {
                e.stopPropagation();
                const paymentId = refundBtn.dataset.paymentId;
                const amount = refundBtn.dataset.amount;
                refundPaymentIdInput.value = paymentId;
                refundAmountInput.value = amount;
                refundModal.classList.remove('hidden');
                return;
            }

            // Handle row click to show payment details
            const row = e.target.closest('tr');
            if (row && row.dataset.paymentData) {
                const payment = JSON.parse(row.dataset.paymentData);
                showPaymentDetails(payment);
            }
        });
    }

    // Function to show payment details modal
    function showPaymentDetails(payment) {
        if (!paymentDetailsContent || !paymentDetailsModal) return;

        const typeLabel = paymentTypeLabels[payment.payment_type] || payment.payment_type || '—';
        const methodLabel = paymentMethodLabels[payment.method] || payment.method || '—';
        const statusDisplay = getStatusDisplay(payment.status, 'payment');
        const dateObj = payment.created_at ? new Date(payment.created_at) : null;
        const dateStr = dateObj ? dateObj.toLocaleString('ru-RU') : '—';

        paymentDetailsContent.innerHTML = `
            <div class="info-row">
                <strong>ID платежа:</strong>
                <span>${payment.id}</span>
            </div>
            <div class="info-row">
                <strong>Клиент:</strong>
                <span>${payment.client}</span>
            </div>
            <div class="info-row">
                <strong>Сумма:</strong>
                <span>${payment.amount} ₽</span>
            </div>
            <div class="info-row">
                <strong>Тип платежа:</strong>
                <span>${typeLabel}</span>
            </div>
            <div class="info-row">
                <strong>Способ оплаты:</strong>
                <span class="payment-method-badge ${payment.method || ''}">${methodLabel}</span>
            </div>
            <div class="info-row">
                <strong>Статус:</strong>
                <span class="status-badge ${statusDisplay.className}">${statusDisplay.text}</span>
            </div>
            <div class="info-row">
                <strong>Дата создания:</strong>
                <span>${dateStr}</span>
            </div>
            ${payment.description ? `
            <div class="info-row">
                <strong>Описание:</strong>
                <span>${payment.description}</span>
            </div>
            ` : ''}
            ${payment.yookassa_payment_id ? `
            <div class="info-row">
                <strong>ID ЮKassa:</strong>
                <span>${payment.yookassa_payment_id}</span>
            </div>
            ` : ''}
        `;

        paymentDetailsModal.classList.remove('hidden');
    }

    // Close payment details modal
    if (paymentDetailsCloseBtn) {
        paymentDetailsCloseBtn.addEventListener('click', () => {
            paymentDetailsModal.classList.add('hidden');
        });
    }

    if (paymentDetailsModal) {
        paymentDetailsModal.addEventListener('click', (e) => {
            if (e.target === paymentDetailsModal) {
                paymentDetailsModal.classList.add('hidden');
            }
        });
    }

    if (refundCancelBtn) {
        refundCancelBtn.addEventListener('click', () => refundModal.classList.add('hidden'));
    }
    if (refundModal) {
        refundModal.addEventListener('click', (e) => {
            if (e.target === refundModal) refundModal.classList.add('hidden');
        });
    }

    if (refundSubmitBtn) {
        refundSubmitBtn.addEventListener('click', async () => {
            const payment_id = refundPaymentIdInput.value;
            const amount = refundAmountInput.value;
            const reason = refundReasonInput.value;

            if (!payment_id || !amount) {
                alert('ID платежа и сумма обязательны.');
                return;
            }

            toggleButtonLoading(refundSubmitBtn, true, 'Выполнить возврат', 'Обработка...');

            try {
                const response = await authedFetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create-refund', payment_id, amount, reason })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `Ошибка сервера: ${response.status}`);
                }

                alert(result.message || 'Запрос на возврат успешно отправлен.');
                refundModal.classList.add('hidden');
                loadPayments(); // Refresh the payments list

            } catch (err) {
                alert('Ошибка возврата: ' + err.message);
            } finally {
                toggleButtonLoading(refundSubmitBtn, false, 'Выполнить возврат', 'Обработка...');
            }
        });
    }

    // --- Bikes CRUD ---
    // --- Bikes CRUD ---
    // Old bike form functions removed - now using modal

    // Load tariffs for bike select
    async function loadTariffsForBikeSelect() {
        if (bikeTariffSelect) {
            try {
                const { data: tariffs, error } = await supabase.from('tariffs').select('id, title').eq('is_active', true);
                if (error) throw error;

                bikeTariffSelect.innerHTML = '<option value="">— Не выбран —</option>';
                tariffs.forEach(tariff => {
                    const option = document.createElement('option');
                    option.value = tariff.id;
                    option.textContent = tariff.title;
                    bikeTariffSelect.appendChild(option);
                });
            } catch (err) {
                console.error("Ошибка загрузки тарифов:", err);
            }
        }
    }

    // Load tariffs when page loads
    loadTariffsForBikeSelect();

    async function loadBikes() {
        if (!bikesTableBody) return;
        // Увеличиваем colspan до 7, т.к. добавилась колонка "Ремонт"
        bikesTableBody.innerHTML = '<tr><td colspan="7">Загрузка...</td></tr>';
        try {
            // Запрос к базе данных остается тем же
            const { data, error } = await supabase.from('bikes').select('*').order('id', { ascending: true });
            if (error) throw error;

            bikesTableBody.innerHTML = '';
            if (!data || data.length === 0) {
                bikesTableBody.innerHTML = '<tr><td colspan="7">Велосипеды еще не добавлены.</td></tr>';
                return;
            }

            data.forEach(bike => {
                const tr = document.createElement('tr');

                // --- ВОТ ЭТОТ БЛОК ДОБАВЛЕН ---
                // Логика для отображения причины ремонта
                let serviceReasonCell = '—'; // По умолчанию ставим прочерк
                if (bike.status === 'in_service' && bike.service_reason) {
                    // Если статус "в ремонте" и есть причина, показываем ее
                    serviceReasonCell = `<span title="${bike.service_reason}" style="cursor: help;">${bike.service_reason}</span>`;
                }
                // --- КОНЕЦ НОВОГО БЛОКА ---

                // Вставляем новую ячейку <td>${serviceReasonCell}</td> в разметку
                tr.innerHTML = `
                    <td>${bike.id}</td>
                    <td>${bike.bike_code}</td>
                    <td>${bike.model_name || ''}</td>
                    <td>${bike.city || ''}</td>
                    <td>${createStatusBadge(bike.status, 'bike')}</td>
                    <td>${serviceReasonCell}</td> <!-- <-- НОВАЯ ЯЧЕЙКА С ПРИЧИНОЙ -->
                    <td class="table-actions">
                        <button type="button" class="edit-bike-btn" data-id="${bike.id}">Ред.</button>
                        <button type="button" class="delete-bike-btn" data-id="${bike.id}">Удалить</button>
                    </td>`;
                bikesTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки велосипедов:', err);
            bikesTableBody.innerHTML = `<tr><td colspan="7">Ошибка: ${err.message}</td></tr>`;
        }
    }

    // Old bike form handlers removed - now using modal

    // Old bike form submit handler removed - now using modal

    if (bikesTableBody) {
        bikesTableBody.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-bike-btn');
            if (editBtn) {
                if (window.editBikeModal) {
                    window.editBikeModal(editBtn.dataset.id);
                }
                return;
            }

            const deleteBtn = e.target.closest('.delete-bike-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (confirm(`Вы уверены, что хотите удалить велосипед с ID ${id}?`)) {
                    try {
                        const { error } = await supabase.from('bikes').delete().eq('id', id);
                        if (error) throw error;
                        await loadBikes();
                    } catch (err) {
                        alert('Ошибка удаления велосипеда: ' + err.message);
                    }
                }
            }
        });
    }

    // --- НОВЫЙ БЛОК: Batteries CRUD ---

    let currentBatteryStep = 1;
    let originalSerialNumber = null; // Track original serial number for edit mode

    function showBatteryModal(battery = null) {
        currentBatteryStep = 1;
        batteryModal.classList.remove('hidden');

        if (battery) {
            batteryModalTitle.textContent = 'Редактировать аккумулятор';
            batteryIdInput.value = battery.id;
            batterySerialNumberInput.value = battery.serial_number;
            originalSerialNumber = battery.serial_number; // Store original
            batteryCapacityInput.value = battery.capacity_wh || '';
            batteryDescriptionInput.value = battery.description || '';
            batteryStatusSelect.value = battery.status;
        } else {
            batteryModalTitle.textContent = 'Новый аккумулятор';
            batteryIdInput.value = '';
            batterySerialNumberInput.value = '';
            originalSerialNumber = null; // Reset for new battery
            batteryCapacityInput.value = '';
            batteryDescriptionInput.value = '';
            batteryStatusSelect.value = 'available';
        }

        updateBatteryStepDisplay();
    }

    function hideBatteryModal() {
        batteryModal.classList.add('hidden');
        currentBatteryStep = 1;
        batteryIdInput.value = '';
        batterySerialNumberInput.value = '';
        batteryCapacityInput.value = '';
        batteryDescriptionInput.value = '';
        batteryStatusSelect.value = 'available';
    }

    function updateBatteryStepDisplay() {
        // Hide all steps
        batteryStep1.classList.add('hidden');
        batteryStep2.classList.add('hidden');
        batteryStep3.classList.add('hidden');

        // Show current step
        if (currentBatteryStep === 1) batteryStep1.classList.remove('hidden');
        if (currentBatteryStep === 2) batteryStep2.classList.remove('hidden');
        if (currentBatteryStep === 3) batteryStep3.classList.remove('hidden');

        // Update step indicators
        document.querySelectorAll('#battery-modal .step-indicator').forEach((indicator, index) => {
            const circle = indicator.querySelector('.step-circle');
            if (index + 1 < currentBatteryStep) {
                circle.classList.add('completed');
                circle.classList.remove('active');
            } else if (index + 1 === currentBatteryStep) {
                circle.classList.add('active');
                circle.classList.remove('completed');
            } else {
                circle.classList.remove('active', 'completed');
            }
        });

        // Update buttons
        batteryPrevBtn.classList.toggle('hidden', currentBatteryStep === 1);
        batteryNextBtn.classList.toggle('hidden', currentBatteryStep === 3);
        batterySaveBtn.classList.toggle('hidden', currentBatteryStep !== 3);
    }

    async function loadBatteries() {
        if (!batteriesTableBody) return;
        batteriesTableBody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase.from('batteries').select('*').order('id', { ascending: true });
            if (error) throw error;

            batteriesTableBody.innerHTML = '';
            if (!data || data.length === 0) {
                batteriesTableBody.innerHTML = '<tr><td colspan="6">Аккумуляторы еще не добавлены.</td></tr>';
                return;
            }

            data.forEach(battery => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${battery.id}</td>
                    <td>${battery.serial_number}</td>
                    <td>${battery.capacity_wh || '—'}</td>
                    <td>${battery.description || '—'}</td>
                    <td>${createStatusBadge(battery.status, 'battery')}</td>
                    <td class="table-actions">
                        <button type="button" class="edit-battery-btn" data-id="${battery.id}">Ред.</button>
                        <button type="button" class="delete-battery-btn" data-id="${battery.id}">Удалить</button>
                    </td>`;
                batteriesTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки аккумуляторов:', err);
            batteriesTableBody.innerHTML = `<tr><td colspan="6">Ошибка: ${err.message}</td></tr>`;
        }
    }

    if (batteryAddBtn) batteryAddBtn.addEventListener('click', () => showBatteryModal());
    if (batteryModalCloseBtn) batteryModalCloseBtn.addEventListener('click', hideBatteryModal);

    if (batteryPrevBtn) {
        batteryPrevBtn.addEventListener('click', () => {
            if (currentBatteryStep > 1) {
                currentBatteryStep--;
                updateBatteryStepDisplay();
            }
        });
    }

    if (batteryNextBtn) {
        batteryNextBtn.addEventListener('click', () => {
            // Validate current step
            if (currentBatteryStep === 1) {
                if (!batterySerialNumberInput.value.trim()) {
                    alert('Пожалуйста, укажите серийный номер');
                    return;
                }
            }

            if (currentBatteryStep < 3) {
                currentBatteryStep++;
                updateBatteryStepDisplay();
            }
        });
    }

    if (batterySaveBtn) {
        batterySaveBtn.addEventListener('click', async () => {
            const id = batteryIdInput.value;
            const serialNumber = batterySerialNumberInput.value.trim();

            // Validate serial number
            if (!serialNumber) {
                alert('Серийный номер обязателен');
                return;
            }

            const batteryData = {
                serial_number: serialNumber,
                capacity_wh: batteryCapacityInput.value ? parseInt(batteryCapacityInput.value, 10) : null,
                description: batteryDescriptionInput.value.trim() || null,
                status: batteryStatusSelect.value,
            };

            try {
                // Check if serial number already exists
                // Only check if: 1) new battery OR 2) editing and serial number changed
                const serialNumberChanged = id && originalSerialNumber !== serialNumber;

                if (!id || serialNumberChanged) {
                    const { data: existing } = await supabase
                        .from('batteries')
                        .select('id')
                        .eq('serial_number', serialNumber)
                        .maybeSingle();

                    if (existing && existing.id !== parseInt(id)) {
                        alert(`Аккумулятор с серийным номером "${serialNumber}" уже существует`);
                        return;
                    }
                }

                const { error } = id
                    ? await supabase.from('batteries').update(batteryData).eq('id', id)
                    : await supabase.from('batteries').insert([batteryData]);

                if (error) throw error;
                await loadBatteries();
                hideBatteryModal();
            } catch (err) {
                alert('Ошибка сохранения аккумулятора: ' + err.message);
            }
        });
    }

    if (batteriesTableBody) {
        batteriesTableBody.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-battery-btn');
            if (editBtn) {
                const id = editBtn.dataset.id;
                const { data, error } = await supabase.from('batteries').select('*').eq('id', id).single();
                if (error) alert('Не удалось загрузить данные: ' + error.message);
                else showBatteryModal(data);
                return;
            }
            const deleteBtn = e.target.closest('.delete-battery-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (confirm(`Удалить аккумулятор с ID ${id}?`)) {
                    try {
                        const { error } = await supabase.from('batteries').delete().eq('id', id);
                        if (error) throw error;
                        await loadBatteries();
                    } catch (err) {
                        alert('Ошибка удаления: ' + err.message);
                    }
                }
            }
        });
    }

    // --- КОНЕЦ БЛОКА Batteries CRUD ---

    // --- Clients Logic ---

    async function loadClients() {
        clientsTableBody.innerHTML = '<tr><td colspan="8">Загрузка клиентов...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            clientsData = data || [];
            clientsTableBody.innerHTML = '';

            if (clientsData.length === 0) {
                clientsTableBody.innerHTML = '<tr><td colspan="8">Клиенты не найдены.</td></tr>';
                return;
            }

            clientsData.forEach(client => {
                const tr = document.createElement('tr');
                const date = new Date(client.created_at).toLocaleDateString();
                const status = client.verification_status || 'not_set';
                const tags = client.extra?.tags || [];

                const verificationButtons = status === 'pending' || status === 'needs_confirmation'
                    ? `<button type="button" class="approve-btn" data-id="${client.id}">Одобрить</button> <button type="button" class="reject-btn" data-id="${client.id}">Отклонить</button>`
                    : '';
                const tagsHtml = tags.map(tag => `<span class="chip" style="background-color: #eef7ff; border-color: #cfe6ff; color: #004a80; margin: 2px;">${tag}</span>`).join('');

                tr.innerHTML = `
                <td>${client.name}</td>
                <td>${client.phone || ''}</td>
                <td>${createStatusBadge(status, 'client')}</td>
                <td><div class="chips">${tagsHtml}</div></td>
                <td>${date}</td>
                <td><button type="button" class="view-client-btn" data-id="${client.id}">Инфо/Фото</button></td>
                <td>${verificationButtons}</td>
                <td><button type="button" class="delete-client-btn btn-danger" data-id="${client.id}" style="background-color:#e53e3e;color:white;">Удалить</button></td>`;
                clientsTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки клиентов:', err);
            clientsTableBody.innerHTML = `<tr><td colspan="9">Ошибка: ${err.message}</td></tr>`;
        }
    }

    clientsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const clientId = target.dataset.id;

        if (!clientId) return;

        let newStatus = '';
        if (target.classList.contains('approve-btn')) newStatus = 'approved';
        if (target.classList.contains('reject-btn')) newStatus = 'rejected';

        if (newStatus) {
            if (!confirm(`Вы уверены, что хотите изменить статус клиента #${clientId} на "${newStatus}"?`)) return;

            try {
                const { error } = await supabase
                    .from('clients')
                    .update({ verification_status: newStatus })
                    .eq('id', clientId);

                if (error) throw error;

                // --- ВОТ ЭТУ СТРОЧКУ НУЖНО ДОБАВИТЬ ---
                // Отправляем запрос на сервер, чтобы он послал уведомление
                authedFetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'notify-verification', userId: clientId, status: newStatus })
                });
                // --- КОНЕЦ ДОБАВЛЕНИЯ ---

                alert('Статус клиента успешно обновлен!');
                loadClients(); // Перезагружаем список, чтобы увидеть изменения
            } catch (err) {
                alert(`Ошибка обновления статуса: ${err.message}`);
            }
            return;
        }

        if (target.classList.contains('delete-client-btn')) {
            if (confirm(`ВНИМАНИЕ!\n\nВы уверены, что хотите НАВСЕГДА удалить клиента с ID ${clientId}?\n\nЭто действие также удалит всю его историю аренд и платежей. Отменить это будет невозможно.`)) {
                try {
                    target.disabled = true;
                    target.textContent = 'Удаление...';

                    // Сначала удаляем связанные записи, чтобы избежать ошибок внешнего ключа
                    await supabase.from('payments').delete().eq('client_id', clientId);
                    await supabase.from('rentals').delete().eq('user_id', clientId);

                    // Наконец, удаляем самого клиента
                    const { error } = await supabase.from('clients').delete().eq('id', clientId);
                    if (error) throw error;

                    alert('Клиент успешно удален.');
                    loadClients(); // Обновляем список
                } catch (err) {
                    alert(`Ошибка удаления: ${err.message}`);
                    target.disabled = false;
                    target.textContent = 'Удалить';
                }
            }
        }
    });
    // --- Rentals and Payments Loaders ---

    async function loadRentals() {
        const tbody = document.querySelector('#rentals-table tbody');
        tbody.innerHTML = '<tr><td colspan="8">Загрузка...</td></tr>';
        try {
            const statusRuMap = {
                'active': 'Активна',
                'awaiting_contract_signing': 'Ожидает подписания',
                'completed_by_admin': 'Завершено админом',
                'pending_assignment': 'Ожидает велосипед',
                'completed': 'Завершена',
                'rejected': 'Отклонена'
            };

            const { data, error } = await supabase
                .from('rentals')
                .select('id, user_id, bike_id, starts_at, current_period_ends_at, total_paid_rub, status, extra_data, clients (name, phone), rental_batteries(batteries(serial_number))')
                .order('starts_at', { ascending: false });

            if (error) throw error;
            tbody.innerHTML = '';
            (data || []).forEach(r => {
                const tr = document.createElement('tr');
                const start = r.starts_at ? new Date(r.starts_at).toLocaleString('ru-RU') : '—';
                const end = r.current_period_ends_at ? new Date(r.current_period_ends_at).toLocaleString('ru-RU') : '—';

                // --- НОВАЯ ЛОГИКА ДЛЯ КНОПОК ДЕЙСТВИЙ ---
                let actionsCell = `<button type="button" class="edit-rental-btn" data-id="${r.id}">Ред.</button>`;

                // Получаем ссылки из extra_data
                const contractUrl = r.extra_data?.contract_document_url;
                const returnActUrl = r.extra_data?.return_act_url;

                if (contractUrl) {
                    actionsCell += ` <a href="${contractUrl}" target="_blank" class="btn-link">Акт приёма</a>`;
                }
                if (returnActUrl) {
                    actionsCell += ` <a href="${returnActUrl}" target="_blank" class="btn-link">Акт сдачи</a>`;
                }

                if (r.status === 'active') {
                    actionsCell += ` <button type="button" class="end-rental-btn" data-id="${r.id}">Завершить</button>`;
                }

                tr.innerHTML = `
                    <td>${r.clients?.name || 'Н/Д'}</td>
                    <td>${r.clients?.phone || 'Н/Д'}</td>
                    <td>
                        <div>Велосипед: ${r.bike_id || '—'}</div>
                        ${r.rental_batteries && r.rental_batteries.length > 0
                        ? `<small style="color: #666;">АКБ: ${r.rental_batteries.map(rb => rb.batteries.serial_number).join(', ')}</small>`
                        : ''
                    }
                    </td>
                    <td>${start}</td>
                    <td>${end}</td>
                    <td>${typeof r.total_paid_rub === 'number' ? r.total_paid_rub : 0}</td>
                    <td>${createStatusBadge(r.status, 'rental')}</td>
                    <td class="table-actions">${actionsCell}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="8">Ошибка загрузки аренд: ${err.message}</td></tr>`;
        }
    }

    // --- Логика для редактирования и управления арендой (ОБЪЕДИНЕННЫЙ БЛОК) ---
    const rentalEditModal = document.getElementById('rental-edit-modal');
    const rentalEditCancelBtn = document.getElementById('rental-edit-cancel-btn');
    const rentalEditSaveBtn = document.getElementById('rental-edit-save-btn');
    const rentalIdInput = document.getElementById('rental-edit-id');
    const rentalBikeSelect = document.getElementById('rental-edit-bike');
    const rentalEndDateInput = document.getElementById('rental-edit-end-date');
    const rentalStatusSelect = document.getElementById('rental-edit-status');
    const rentalEditBatteriesList = document.getElementById('rental-edit-batteries-list');
    const rentalEditChangeBatteriesBtn = document.getElementById('rental-edit-change-batteries-btn');

    let currentRentalBatteries = [];

    if (rentalsTableBody) {
        rentalsTableBody.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-rental-btn');
            const endBtn = e.target.closest('.end-rental-btn');

            // --- ОБРАБОТЧИК КНОПКИ "РЕДАКТИРОВАТЬ" ---
            if (editBtn) {
                const rentalId = editBtn.dataset.id;
                try {
                    const { data: rentalData, error: rentalError } = await supabase
                        .from('rentals')
                        .select('*, bikes(*)')
                        .eq('id', rentalId)
                        .single();
                    if (rentalError) throw rentalError;

                    const { data: availableBikes, error: bikesError } = await supabase
                        .from('bikes')
                        .select('*')
                        .eq('status', 'available');
                    if (bikesError) throw bikesError;

                    rentalBikeSelect.innerHTML = '';
                    if (rentalData.bikes) {
                        const currentBikeOption = new Option(`${rentalData.bikes.model_name} (#${rentalData.bikes.bike_code}) - Текущий`, rentalData.bike_id);
                        rentalBikeSelect.add(currentBikeOption);
                    }
                    availableBikes.forEach(bike => {
                        if (bike.id !== rentalData.bike_id) {
                            const option = new Option(`${bike.model_name} (#${bike.bike_code})`, bike.id);
                            rentalBikeSelect.add(option);
                        }
                    });

                    rentalIdInput.value = rentalData.id;
                    rentalBikeSelect.value = rentalData.bike_id;
                    rentalStatusSelect.value = rentalData.status;

                    if (rentalData.current_period_ends_at) {
                        const date = new Date(rentalData.current_period_ends_at);
                        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                        rentalEndDateInput.value = date.toISOString().slice(0, 16);
                    }

                    // Загружаем АКБ для этой аренды
                    const { data: batteries, error: battError } = await supabase
                        .from('rental_batteries')
                        .select('battery_id, batteries(serial_number)')
                        .eq('rental_id', rentalId);

                    if (!battError && batteries) {
                        currentRentalBatteries = batteries.map(b => ({
                            id: b.battery_id,
                            serial: b.batteries?.serial_number || 'Неизвестно'
                        }));
                        renderRentalBatteriesList();
                    }

                    rentalEditModal.classList.remove('hidden');
                } catch (err) {
                    alert('Ошибка загрузки данных аренды: ' + err.message);
                }
            }

            // --- ОБРАБОТЧИК КНОПКИ "ЗАВЕРШИТЬ" ---
            if (endBtn) {
                const rentalId = endBtn.dataset.id;
                if (confirm(`Вы уверены, что хотите принудительно завершить аренду с ID ${rentalId}?`)) {
                    try {
                        const { error } = await supabase
                            .from('rentals').update({ status: 'completed_by_admin' }).eq('id', rentalId);
                        if (error) throw error;
                        alert('Аренда успешно завершена.');
                        loadRentals();
                    } catch (err) {
                        alert('Ошибка завершения аренды: ' + err.message);
                    }
                }
            }
        });
    }

    // Функция отображения списка АКБ
    function renderRentalBatteriesList() {
        if (!rentalEditBatteriesList) return;

        if (currentRentalBatteries.length === 0) {
            rentalEditBatteriesList.innerHTML = '<p style="color: #666; font-size: 14px;">АКБ не назначены</p>';
        } else {
            rentalEditBatteriesList.innerHTML = currentRentalBatteries.map(b =>
                `<div style="padding: 8px 12px; background: var(--card-bg); border-radius: 6px; border: 1px solid var(--progress-bar-bg);">
                    <strong>АКБ:</strong> ${b.serial}
                </div>`
            ).join('');
        }
    }

    // Обработчик кнопки "Изменить АКБ"
    if (rentalEditChangeBatteriesBtn) {
        rentalEditChangeBatteriesBtn.addEventListener('click', async () => {
            const rentalId = rentalIdInput.value;
            if (!rentalId) return;

            // Открываем существующее модальное окно выбора АКБ
            if (assignBatteriesModal && assignBatteriesRentalIdInput) {
                assignBatteriesRentalIdInput.value = rentalId;

                // Получаем текущий велосипед аренды
                const currentBikeId = rentalBikeSelect.value;
                
                // Загружаем доступные АКБ
                try {
                    const { data: batteries, error } = await supabase
                        .from('batteries')
                        .select('*')
                        .eq('status', 'available');

                    if (error) throw error;

                    if (batterySelectList) {
                        batterySelectList.innerHTML = '';
                        // Ограничиваем отображение до 5 АКБ
                        const limitedBatteries = batteries.slice(0, 5);
                        limitedBatteries.forEach(battery => {
                            const label = document.createElement('label');
                            label.className = 'battery-checkbox-item';
                            label.innerHTML = `
                                <input type="checkbox" name="battery" value="${battery.id}">
                                <span>${battery.serial_number} (${battery.capacity_wh || 'N/A'} Wh)</span>
                            `;
                            batterySelectList.appendChild(label);
                        });

                        // Показываем сообщение если АКБ больше 5
                        if (batteries.length > 5) {
                            const hint = document.createElement('p');
                            hint.style.cssText = 'color: #666; font-size: 13px; margin: 10px 0 0 0; text-align: center;';
                            hint.textContent = `Показано 5 из ${batteries.length} АКБ. Используйте поиск для фильтрации.`;
                            batterySelectList.appendChild(hint);
                        }
                    }

                    // Добавляем динамический поиск
                    const searchInput = document.getElementById('battery-search-in-modal');
                    if (searchInput) {
                        // Сбрасываем значение поиска
                        searchInput.value = '';

                        // Удаляем старые обработчики (если есть)
                        const newSearchInput = searchInput.cloneNode(true);
                        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

                        // Добавляем новый обработчик
                        newSearchInput.addEventListener('input', () => {
                            const query = newSearchInput.value.toLowerCase().trim();
                            batterySelectList.querySelectorAll('label').forEach(label => {
                                const text = label.textContent.toLowerCase();
                                label.style.display = text.includes(query) ? 'block' : 'none';
                            });
                        });
                    }

                    // ВАЖНО: Загружаем текущий велосипед и автоматически выбираем его
                    if (batteryModalBikeSelect && currentBikeId) {
                        // Получаем информацию о текущем велосипеде
                        const { data: currentBike, error: bikeError } = await supabase
                            .from('bikes')
                            .select('*')
                            .eq('id', currentBikeId)
                            .single();
                        
                        if (!bikeError && currentBike) {
                            // Заполняем select текущим велосипедом
                            batteryModalBikeSelect.innerHTML = '';
                            const option = document.createElement('option');
                            option.value = currentBike.id;
                            option.textContent = `${currentBike.model_name} (#${currentBike.bike_code}) - Текущий`;
                            batteryModalBikeSelect.appendChild(option);
                            batteryModalBikeSelect.value = currentBike.id;
                            
                            // Скрываем блок выбора велосипеда
                            const bikeSelectGroup = batteryModalBikeSelect.closest('.form-group');
                            if (bikeSelectGroup) {
                                bikeSelectGroup.style.display = 'none';
                            }
                        }
                    }

                    // Изменяем заголовок модального окна
                    const modalTitle = assignBatteriesModal.querySelector('.modal-header h3');
                    if (modalTitle) {
                        modalTitle.textContent = 'Изменить аккумуляторы';
                    }

                    assignBatteriesModal.classList.remove('hidden');
                    rentalEditModal.classList.add('hidden');

                } catch (err) {
                    alert('Ошибка загрузки АКБ: ' + err.message);
                }
            }
        });
    }

    if (rentalEditCancelBtn) {
        rentalEditCancelBtn.addEventListener('click', () => rentalEditModal.classList.add('hidden'));
    }

    if (rentalEditSaveBtn) {
        rentalEditSaveBtn.addEventListener('click', async () => {
            const id = rentalIdInput.value;
            const endDateISO = rentalEndDateInput.value
                ? new Date(rentalEndDateInput.value).toISOString()
                : null;

            const updateData = {
                bike_id: rentalBikeSelect.value,
                current_period_ends_at: endDateISO,
                status: rentalStatusSelect.value
            };

            toggleButtonLoading(rentalEditSaveBtn, true, 'Сохранить', 'Сохранение...');
            try {
                const { error } = await supabase.from('rentals').update(updateData).eq('id', id);
                if (error) throw error;
                alert('Аренда успешно обновлена!');
                rentalEditModal.classList.add('hidden');
                loadRentals();
            } catch (err) {
                alert('Ошибка сохранения: ' + err.message);
            } finally {
                toggleButtonLoading(rentalEditSaveBtn, false, 'Сохранить', '...');
            }
        });
    }

    function renderPaymentsChart(paymentsData) {
        const chartCanvas = document.getElementById('payments-chart');
        if (!chartCanvas) return; // Don't do anything if canvas isn't on the page

        if (window.paymentsChart instanceof Chart) {
            window.paymentsChart.destroy();
        }

        // --- ИЗМЕНЕНИЕ №1: Правильный подсчет дохода (учитываем списания) ---
        // Убираем фильтр "p.amount_rub > 0", чтобы суммировались все успешные транзакции.
        const successfulPayments = (paymentsData || []).filter(p => p.status === 'succeeded');

        const paymentsByDay = successfulPayments.reduce((acc, p) => {
            const day = new Date(p.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            acc[day] = (acc[day] || 0) + p.amount_rub;
            return acc;
        }, {});

        const labels = Object.keys(paymentsByDay).reverse();
        const chartData = Object.values(paymentsByDay).reverse();
        const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

        window.paymentsChart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Доход по дням, ₽',
                    data: chartData,
                    // --- ИЗМЕНЕНИЕ №2: Замена красного цвета на темно-зеленый для "сегодня" ---
                    backgroundColor: (context) => {
                        const label = labels[context.dataIndex];
                        // Если сегодня - используем темно-зеленый, в остальные дни - обычный зеленый.
                        return label === today ? 'rgba(8, 56, 48, 0.8)' : 'rgba(38, 185, 153, 0.6)';
                    },
                    borderColor: (context) => {
                        const label = labels[context.dataIndex];
                        return label === today ? 'rgba(8, 56, 48, 1)' : 'rgba(38, 185, 153, 1)';
                    },
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#083830',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 12 },
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                    }
                }
            }
        });
    }

    async function loadPayments() {
        const tbody = document.querySelector('#payments-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('id, yookassa_payment_id, amount_rub, payment_type, method, status, created_at, description, clients (name)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            tbody.innerHTML = '';
            (data || []).forEach(p => {
                // Get payment type label
                const typeLabel = paymentTypeLabels[p.payment_type] || p.payment_type || '—';

                // Get payment method label
                const methodLabel = paymentMethodLabels[p.method] || p.method || '—';

                const actionsCell = (p.status === 'succeeded' && p.status !== 'refunded' && p.yookassa_payment_id && !p.yookassa_payment_id.startsWith('manual'))
                    ? `<button type="button" class="refund-btn" data-payment-id="${p.yookassa_payment_id}" data-amount="${p.amount_rub}">Вернуть</button>`
                    : '';

                const tr = document.createElement('tr');
                const dateObj = p.created_at ? new Date(p.created_at) : null;
                const dateStr = dateObj ? dateObj.toLocaleDateString('ru-RU') : '—';
                const timeStr = dateObj ? dateObj.toLocaleTimeString('ru-RU') : '';

                // Make row clickable to show details
                tr.style.cursor = 'pointer';
                tr.dataset.paymentId = p.id;

                // Store payment data for modal
                tr.dataset.paymentData = JSON.stringify({
                    id: p.id,
                    client: p.clients?.name || 'Н/Д',
                    amount: p.amount_rub,
                    payment_type: p.payment_type,
                    method: p.method,
                    status: p.status,
                    created_at: p.created_at,
                    description: p.description,
                    yookassa_payment_id: p.yookassa_payment_id
                });

                // Build table row with separate payment_type and method columns
                tr.innerHTML = `
                    <td>${p.clients?.name || 'Н/Д'}</td>
                    <td>${p.amount_rub ?? 0} ₽</td>
                    <td>${typeLabel}</td>
                    <td><span class="payment-method-badge ${p.method || ''}">${methodLabel}</span></td>
                    <td>${createStatusBadge(p.status, 'payment')}</td>
                    <td>
                        <div>${dateStr}</div>
                        <small style="font-size: 0.8em; color: #666;">${timeStr}</small>
                    </td>
                    <td>${actionsCell}</td>`;
                tbody.appendChild(tr);
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7">Ошибка загрузки платежей: ${err.message}</td></tr>`;
            console.error('Ошибка загрузки платежей:', err);
        }
    }
    // Update dashboard time
    function updateDashboardTime() {
        const timeElement = document.getElementById('dashboard-time');
        if (timeElement) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            timeElement.textContent = `${hours}:${minutes}`;
        }
    }

    // Update time every minute
    updateDashboardTime();
    setInterval(updateDashboardTime, 60000);

    async function loadDashboardData() {
        // 1. Load Bike Stats
        const bikesContainer = document.getElementById('dashboard-bikes');
        if (bikesContainer) {
            try {
                const { data, error } = await supabase.from('bikes').select('status');
                if (error) throw error;

                const stats = data.reduce((acc, bike) => {
                    acc[bike.status] = (acc[bike.status] || 0) + 1;
                    return acc;
                }, {});

                const total = data.length;
                const available = stats.available || 0;
                const rented = stats.rented || 0;
                const in_service = stats.in_service || 0;

                bikesContainer.innerHTML = `
                    <div class="dashboard-stat-item">
                        <span class="dashboard-stat-label">Всего велосипедов</span>
                        <span class="dashboard-stat-value">${total}</span>
                    </div>
                    <div class="dashboard-stat-item">
                        <span class="dashboard-stat-label">Свободно</span>
                        <span class="dashboard-stat-value accent">${available}</span>
                    </div>
                    <div class="dashboard-stat-item">
                        <span class="dashboard-stat-label">В аренде</span>
                        <span class="dashboard-stat-value warning">${rented}</span>
                    </div>
                    <div class="dashboard-stat-item">
                        <span class="dashboard-stat-label">В ремонте</span>
                        <span class="dashboard-stat-value danger">${in_service}</span>
                    </div>
                `;
            } catch (err) {
                bikesContainer.innerHTML = `<p>Ошибка: ${err.message}</p>`;
            }
        }

        // 2. Load Operations Stats
        const operationsContainer = document.getElementById('dashboard-operations');
        if (operationsContainer) {
            try {
                // Active rentals
                const { data: rentals, error: rentalsError } = await supabase
                    .from('rentals')
                    .select('id')
                    .eq('status', 'active');
                if (rentalsError) throw rentalsError;

                // New clients this week
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const { data: newClients, error: clientsError } = await supabase
                    .from('clients')
                    .select('id')
                    .gte('created_at', weekAgo.toISOString());
                if (clientsError) throw clientsError;

                // Total batteries
                const { data: batteries, error: batteriesError } = await supabase
                    .from('batteries')
                    .select('status');
                if (batteriesError) throw batteriesError;

                const availableBatteries = batteries.filter(b => b.status === 'available').length;

                operationsContainer.innerHTML = `
                    <div class="dashboard-stat-item">
                        <span class="dashboard-stat-label">Активные аренды</span>
                        <span class="dashboard-stat-value warning">${rentals.length}</span>
                    </div>
                    <div class="dashboard-stat-item">
                        <span class="dashboard-stat-label">Новые клиенты (7 дн.)</span>
                        <span class="dashboard-stat-value accent">${newClients.length}</span>
                    </div>
                    <div class="dashboard-stat-item">
                        <span class="dashboard-stat-label">Свободные АКБ</span>
                        <span class="dashboard-stat-value">${availableBatteries}</span>
                    </div>
                `;
            } catch (err) {
                operationsContainer.innerHTML = `<p>Ошибка: ${err.message}</p>`;
            }
        }

        // 3. Load Revenue Data
        const revenueContainer = document.getElementById('revenue-breakdown');
        const weeklyIncomeDiv = document.getElementById('weekly-income');
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const { data: weekPayments, error } = await supabase
                .from('payments')
                .select('amount_rub, status, payment_type')
                .gte('created_at', weekAgo.toISOString())
                .eq('status', 'succeeded');
            if (error) throw error;

            const total = (weekPayments || []).reduce((sum, p) => sum + (p.amount_rub || 0), 0);
            const avgPayment = weekPayments.length > 0 ? Math.round(total / weekPayments.length) : 0;
            const rentalPayments = weekPayments.filter(p => p.payment_type === 'rental').length;
            const depositPayments = weekPayments.filter(p => p.payment_type === 'deposit').length;

            if (weeklyIncomeDiv) {
                weeklyIncomeDiv.textContent = `${total.toLocaleString('ru-RU')} ₽`;
            }

            if (revenueContainer) {
                revenueContainer.innerHTML = `
                    <div class="revenue-stat-item">
                        <div class="revenue-stat-label">Средний чек</div>
                        <div class="revenue-stat-value">${avgPayment.toLocaleString('ru-RU')} ₽</div>
                    </div>
                    <div class="revenue-stat-item">
                        <div class="revenue-stat-label">Всего платежей</div>
                        <div class="revenue-stat-value">${weekPayments.length}</div>
                    </div>
                    <div class="revenue-stat-item">
                        <div class="revenue-stat-label">Аренды</div>
                        <div class="revenue-stat-value">${rentalPayments}</div>
                    </div>
                    <div class="revenue-stat-item">
                        <div class="revenue-stat-label">Депозиты</div>
                        <div class="revenue-stat-value">${depositPayments}</div>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Ошибка загрузки недельного дохода:', err);
            if (weeklyIncomeDiv) weeklyIncomeDiv.textContent = 'Ошибка';
        }

        // 4. Load Payments for Chart
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('created_at, amount_rub, status')
                .order('created_at', { ascending: false });
            if (error) throw error;
            renderPaymentsChart(data);
        } catch (err) {
            console.error('Ошибка загрузки данных для графика платежей:', err);
        }

    }

    // --- Client Info/Edit Modals Logic ---
    // --- Client Info/Edit Modals Logic ---
    // --- Client Info/Edit Modals Logic ---

    if (clientsSection) {
        clientsSection.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-client-btn');
            if (viewBtn) {
                const clientId = viewBtn.dataset.id;
                await renderClientInfo(clientId);
                clientInfoOverlay.classList.remove('hidden');
            }
        });
    }

    if (clientInfoCloseBtn) {
        clientInfoCloseBtn.addEventListener('click', () => clientInfoOverlay.classList.add('hidden'));
    }
    if (typeof clientInfoCloseBtn2 !== 'undefined' && clientInfoCloseBtn2) {
        clientInfoCloseBtn2.addEventListener('click', () => clientInfoOverlay.classList.add('hidden'));
    }
    if (typeof imageViewerOverlay !== 'undefined' && imageViewerOverlay) {
        const closer = document.getElementById('image-viewer-close');
        if (closer) closer.addEventListener('click', () => imageViewerOverlay.classList.add('hidden'));
        imageViewerOverlay.addEventListener('click', (e) => { if (e.target === imageViewerOverlay) imageViewerOverlay.classList.add('hidden'); });
    }

    if (clientEditCancelBtn) {
        clientEditCancelBtn.addEventListener('click', () => clientEditOverlay.classList.add('hidden'));
    }

    if (clientEditSaveBtn) {
        clientEditSaveBtn.addEventListener('click', async () => {
            if (!currentEditingId) return;

            const updatedRec = {};
            clientEditForm.querySelectorAll('input, textarea').forEach(inp => {
                updatedRec[inp.name] = inp.value.trim();
            });

            // Создаем новый объект `extra` на основе старого, но с обновленными данными
            const extraObj = JSON.parse(JSON.stringify(currentEditingExtra || {}));
            extraObj.recognized_data = updatedRec;

            try {
                const { error } = await supabase
                    .from('clients')
                    .update({ extra: extraObj })
                    .eq('id', currentEditingId);
                if (error) throw error;

                alert('Данные клиента успешно обновлены.');
                clientEditOverlay.classList.add('hidden');
                await loadClients(); // Перезагружаем список клиентов для отображения изменений
            } catch (err) {
                alert('Ошибка сохранения данных: ' + err.message);
            }
        });
    }


    // --- Balance Adjustment Logic ---
    const balanceModal = document.getElementById('balance-modal');
    const balanceAdjustBtn = document.getElementById('balance-adjust-btn');
    const balanceCancelBtn = document.getElementById('balance-cancel-btn');
    const balanceSubmitBtn = document.getElementById('balance-submit-btn');
    const balanceClientIdInput = document.getElementById('balance-client-id');
    const balanceAmountInput = document.getElementById('balance-amount');
    const balanceReasonInput = document.getElementById('balance-reason');

    // Token Generation Button
    const generateTokenBtn = document.getElementById('generate-token-btn');

    if (balanceAdjustBtn) {
        balanceAdjustBtn.addEventListener('click', () => {
            if (currentEditingId && balanceModal) {
                balanceClientIdInput.value = currentEditingId;
                if (clientInfoOverlay) clientInfoOverlay.classList.add('hidden');
                balanceModal.classList.remove('hidden');
            } else {
                alert('Сначала выберите клиента.');
            }
        });
    }

    if (balanceCancelBtn) {
        balanceCancelBtn.addEventListener('click', () => {
            if (balanceModal) balanceModal.classList.add('hidden');
        });
    }

    if (balanceModal) {
        balanceModal.addEventListener('click', (e) => {
            if (e.target === balanceModal) {
                balanceModal.classList.add('hidden');
            }
        });
    }

    if (balanceSubmitBtn) {
        balanceSubmitBtn.addEventListener('click', async () => {
            const userId = balanceClientIdInput.value;
            const amount = balanceAmountInput.value;
            const reason = balanceReasonInput.value;

            if (!userId || !amount || !reason) {
                alert('Пожалуйста, заполните все поля: сумма и причина.');
                return;
            }

            toggleButtonLoading(balanceSubmitBtn, true, 'Применить', 'Применяем...');

            try {
                const response = await authedFetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'adjust-balance', userId, amount, reason })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `Ошибка сервера: ${response.status}`);
                }

                alert(result.message || 'Баланс успешно скорректирован.');
                balanceModal.classList.add('hidden');
                balanceAmountInput.value = '';
                balanceReasonInput.value = '';

            } catch (err) {
                alert('Ошибка: ' + err.message);
            } finally {
                toggleButtonLoading(balanceSubmitBtn, false, 'Применить', 'Применяем...');
            }
        });
    }

    // --- Token Generation Logic ---
    if (generateTokenBtn) {
        generateTokenBtn.addEventListener('click', async () => {
            if (!currentEditingId) {
                alert('Клиент не выбран.');
                return;
            }

            if (!confirm(`Сгенерировать новый токен доступа для клиента ID: ${currentEditingId}? Старый токен перестанет работать.`)) {
                return;
            }

            toggleButtonLoading(generateTokenBtn, true, 'Сгенерировать токен', 'Генерация...');

            try {
                const response = await authedFetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reset-auth-token', userId: currentEditingId })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Ошибка сервера');

                // Показываем токен администратору, чтобы он мог его скопировать и передать клиенту
                prompt("Скопируйте этот токен и отправьте клиенту:", result.newToken);

            } catch (err) {
                alert('Ошибка генерации токена: ' + err.message);
            } finally {
                toggleButtonLoading(generateTokenBtn, false, 'Сгенерировать токен', 'Генерация...');
            }
        });
    }

    // --- Client Tags Logic ---
    const clientTagsContainer = document.getElementById('client-tags-container');
    const clientTagInput = document.getElementById('client-tag-input');
    const addTagBtn = document.getElementById('add-tag-btn');

    function renderTags(tags = []) {
        if (!clientTagsContainer) return;
        const h4 = clientTagsContainer.previousElementSibling;
        if (!tags || tags.length === 0) {
            clientTagsContainer.style.display = 'none';
            if (h4 && h4.tagName === 'H4') h4.style.display = 'none';
            return;
        }
        clientTagsContainer.style.display = 'flex';
        if (h4 && h4.tagName === 'H4') h4.style.display = 'block';
        clientTagsContainer.innerHTML = '';
        tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'chip'; // Re-using chip style for tags
            tagEl.style.cursor = 'pointer';
            tagEl.style.backgroundColor = '#e0f3fb';
            tagEl.style.borderColor = '#40A4DF';
            tagEl.style.color = '#083830';
            tagEl.textContent = tag;
            const removeBtn = document.createElement('span');
            removeBtn.textContent = ' ×';
            removeBtn.style.fontWeight = 'bold';
            removeBtn.style.marginLeft = '4px';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeTag(tag);
            };
            tagEl.appendChild(removeBtn);
            clientTagsContainer.appendChild(tagEl);
        });
    }

    async function updateClientTags(newTags) {
        try {
            const { data: client, error: fetchError } = await supabase
                .from('clients')
                .select('extra')
                .eq('id', currentEditingId)
                .single();
            if (fetchError) throw fetchError;

            const extra = client.extra || {};
            extra.tags = newTags;

            const { error: updateError } = await supabase
                .from('clients')
                .update({ extra: extra })
                .eq('id', currentEditingId);
            if (updateError) throw updateError;

            return newTags;
        } catch (err) {
            alert('Не удалось обновить теги: ' + err.message);
            return null;
        }
    }

    async function addTag(tagText) {
        if (!tagText || !currentEditingId) return;

        toggleButtonLoading(addTagBtn, true, 'Добавить', '...');
        const { data: client, error } = await supabase.from('clients').select('extra').eq('id', currentEditingId).single();
        const currentTags = client.extra?.tags || [];
        if (currentTags.includes(tagText)) {
            alert('Такой тег уже существует.');
            toggleButtonLoading(addTagBtn, false, 'Добавить', '...');
            return;
        }
        const newTags = [...currentTags, tagText];
        const updatedTags = await updateClientTags(newTags);
        if (updatedTags !== null) {
            renderTags(updatedTags);
            loadClients(); // Refresh the main table to show new tags
        }
        toggleButtonLoading(addTagBtn, false, 'Добавить', '...');
    }

    async function removeTag(tagToRemove) {
        const { data: client, error } = await supabase.from('clients').select('extra').eq('id', currentEditingId).single();
        const currentTags = client.extra?.tags || [];
        const newTags = currentTags.filter(t => t !== tagToRemove);
        const updatedTags = await updateClientTags(newTags);
        if (updatedTags !== null) {
            renderTags(updatedTags);
            loadClients(); // Refresh the main table
        }
    }

    async function updateClientNotes(newNotes) {
        try {
            const { data: client, error: fetchError } = await supabase.from('clients').select('extra').eq('id', currentEditingId).single();
            if (fetchError) throw fetchError;
            const extra = client.extra || {};
            extra.notes = newNotes;
            const { error: updateError } = await supabase.from('clients').update({ extra: extra }).eq('id', currentEditingId);
            if (updateError) throw updateError;
            return newNotes;
        } catch (err) {
            alert('Не удалось обновить заметки: ' + err.message);
            return null;
        }
    }

    async function addNote(noteText) {
        if (!noteText || !currentEditingId) return;

        toggleButtonLoading(document.getElementById('add-note-modal-submit'), true, 'Добавить', 'Добавление...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const authorEmail = user ? user.email : 'admin';

            const newNote = {
                text: noteText,
                author: authorEmail,
                timestamp: new Date().toISOString()
            };

            // Fetch the latest extra data to avoid overwriting other changes
            const { data: client, error: fetchError } = await supabase
                .from('clients')
                .select('extra')
                .eq('id', currentEditingId)
                .single();

            if (fetchError) throw fetchError;

            const extra = client.extra || {};
            const notes = extra.notes || [];
            notes.push(newNote);
            extra.notes = notes;

            const { error: updateError } = await supabase
                .from('clients')
                .update({ extra: extra })
                .eq('id', currentEditingId);

            if (updateError) throw updateError;

            renderNotes(notes); // Re-render the notes list

        } catch (err) {
            alert('Не удалось добавить заметку: ' + err.message);
        } finally {
            toggleButtonLoading(document.getElementById('add-note-modal-submit'), false, 'Добавить', 'Добавление...');
        }
    }

    async function removeNote(timestamp) {
        const { data: client, error } = await supabase.from('clients').select('extra').eq('id', currentEditingId).single();
        const currentNotes = client.extra?.notes || [];
        const newNotes = currentNotes.filter(n => n.timestamp != timestamp);
        const updatedNotes = await updateClientNotes(newNotes);
        if (updatedNotes !== null) {
            renderNotes(updatedNotes);
            loadClients();
        }
    }


    // New footer buttons for adding tags and notes
    const addTagFooterBtn = document.getElementById('add-tag-footer-btn');
    const addNoteFooterBtn = document.getElementById('add-note-footer-btn');

    if (addTagFooterBtn) {
        addTagFooterBtn.addEventListener('click', () => {
            document.getElementById('add-tag-modal').classList.remove('hidden');
        });
    }

    if (addNoteFooterBtn) {
        addNoteFooterBtn.addEventListener('click', () => {
            document.getElementById('add-note-modal').classList.remove('hidden');
        });
    }

    // Modal close events
    document.getElementById('add-tag-modal-close')?.addEventListener('click', () => {
        document.getElementById('add-tag-modal').classList.add('hidden');
    });
    document.getElementById('add-tag-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('add-tag-modal')) {
            document.getElementById('add-tag-modal').classList.add('hidden');
        }
    });

    document.getElementById('add-note-modal-close')?.addEventListener('click', () => {
        document.getElementById('add-note-modal').classList.add('hidden');
    });
    document.getElementById('add-note-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('add-note-modal')) {
            document.getElementById('add-note-modal').classList.add('hidden');
        }
    });

    // Submit buttons for modals
    document.getElementById('add-tag-modal-submit')?.addEventListener('click', async () => {
        const tagText = document.getElementById('new-tag-input').value.trim();
        if (tagText) {
            await addTag(tagText);
            document.getElementById('add-tag-modal').classList.add('hidden');
            document.getElementById('new-tag-input').value = '';
        }
    });

    document.getElementById('add-note-modal-submit')?.addEventListener('click', async () => {
        const noteText = document.getElementById('new-note-input').value.trim();
        if (noteText) {
            await addNote(noteText);
            document.getElementById('add-note-modal').classList.add('hidden');
            document.getElementById('new-note-input').value = '';
        }
    });

    // --- Assignments Logic ---
    async function loadAssignments() {
        if (!assignmentsTableBody) return;
        assignmentsTableBody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('rentals')
                .select('id, created_at, user_id, tariff_id, status, clients(name), tariffs(title)')
                // ИЗМЕНЕНИЕ: Ищем новый статус для выбора АКБ
                .in('status', ['pending_assignment', 'awaiting_battery_assignment', 'pending_return'])
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                assignmentsTableBody.innerHTML = '<tr><td colspan="5">Нет активных заявок.</td></tr>';
                return;
            }

            assignmentsTableBody.innerHTML = '';
            data.forEach(assignment => {
                const tr = document.createElement('tr');
                let actionButton = '';

                // ИЗМЕНЕНИЕ: Разная логика для разных статусов
                if (assignment.status === 'pending_return') {
                    actionButton = `<button class="btn btn-primary process-return-btn" data-rental-id="${assignment.id}">Принять</button>`;
                } else if (assignment.status === 'awaiting_battery_assignment') { // <-- ОЖИДАЕТ АКБ
                    actionButton = `<button class="btn btn-primary assign-batteries-btn" data-rental-id="${assignment.id}">Выбрать оборудование</button>`;
                } else if (assignment.status === 'awaiting_contract_signing') { // <-- ОЖИДАЕТ ПОДПИСАНИЯ
                    actionButton = `<button class="btn btn-primary assign-batteries-btn" data-rental-id="${assignment.id}">Выбрать оборудование</button>`;
                } else { // 'pending_assignment'
                    actionButton = `<button class="btn btn-primary assign-bike-btn" data-rental-id="${assignment.id}">Привязать вел.</button>`;
                }

                tr.innerHTML = `
                    <td>${assignment.clients?.name || `ID: ${assignment.user_id.slice(0, 8)}...`}</td>
                    <td>${assignment.tariffs?.title || `ID: ${assignment.tariff_id}`}</td>
                    <td>${createStatusBadge(assignment.status, 'rental')}</td>
                    <td>${new Date(assignment.created_at).toLocaleString('ru-RU')}</td>
                    <td class="table-actions">
                        ${actionButton}
                        ${assignment.status === 'pending_assignment' ? `<button class="btn btn-secondary reject-rental-btn" data-rental-id="${assignment.id}" style="background-color: #fff1f2; color: #e53e3e;">Отклонить</button>` : ''}
                    </td>
                `;
                assignmentsTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки заявок:', err);
            assignmentsTableBody.innerHTML = `<tr><td colspan="5">Ошибка: ${err.message}</td></tr>`;
        }
    }

    // +++ НОВАЯ ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ БРОНЕЙ В АДМИНКЕ +++
    async function loadBookings() {
        const tbody = document.querySelector('#bookings-table tbody');
        if (!tbody) return;
        // Останавливаем предыдущий таймер, если он был
        if (bookingUpdateInterval) {
            clearInterval(bookingUpdateInterval);
            bookingUpdateInterval = null;
        }
        tbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';

        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, clients(name, phone)')
                .eq('status', 'active')
                .gt('expires_at', new Date().toISOString()) // Только активные и неистекшие
                .order('expires_at', { ascending: true });

            if (error) throw error;

            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">Нет активных бронирований.</td></tr>';
                return;
            }

            data.forEach(booking => {
                const tr = document.createElement('tr');
                tr.dataset.expiresAt = booking.expires_at; // Сохраняем дату для таймера

                tr.innerHTML = `
                    <td>${booking.clients?.name || 'ID: ' + booking.user_id}</td>
                    <td>${booking.clients?.phone || '—'}</td>
                    <td>${new Date(booking.expires_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="progress-cell">
                         <span class="time-left-display" style="font-size: 0.9em; color: #666;">Загрузка...</span>
                         <div class="progress-bar-container" style="margin-top: 4px;">
                            <div class="progress-bar progress-bar-fill" style="width: 100%;"></div>
                         </div>
                    </td>
                    <td class="table-actions">
                        <button class="btn btn-primary create-rental-from-booking-btn" data-booking-id="${booking.id}">Пришел</button>
                        <button class="btn btn-danger reject-booking-btn" data-booking-id="${booking.id}">Отклонить</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Функция для обновления таймеров
            const updateBookingTimers = () => {
                tbody.querySelectorAll('tr[data-expires-at]').forEach(row => {
                    const expiresDate = new Date(row.dataset.expiresAt);
                    const timeLeftMs = Math.max(0, expiresDate.getTime() - new Date().getTime());
                    const totalDurationMs = 2 * 60 * 60 * 1000;
                    const progress = (timeLeftMs / totalDurationMs) * 100;

                    const minutes = Math.floor(timeLeftMs / 60000);
                    const seconds = Math.floor((timeLeftMs % 60000) / 1000);

                    let progressBarColor = '#f5a623'; // Orange by default
                    if (progress < 15) progressBarColor = '#e53e3e'; // Red

                    row.querySelector('.time-left-display').textContent = `${minutes} мин. ${seconds} сек.`;
                    const progressBarFill = row.querySelector('.progress-bar-fill');
                    progressBarFill.style.width = `${progress}%`;
                    progressBarFill.style.backgroundColor = progressBarColor;
                });
            };

            updateBookingTimers(); // Первый запуск
            bookingUpdateInterval = setInterval(updateBookingTimers, 1000); // Обновляем каждую секунду

        } catch (err) {
            console.error('Ошибка загрузки броней:', err);
            tbody.innerHTML = `<tr><td colspan="5">Ошибка: ${err.message}</td></tr>`;
        }
    }

    // +++ НОВЫЕ ОБРАБОТЧИКИ ДЛЯ КНОПОК БРОНИРОВАНИЙ +++
    const bookingsTableBody = document.querySelector('#bookings-table tbody');
    if (bookingsTableBody) {
        bookingsTableBody.addEventListener('click', (e) => {
            const createRentalBtn = e.target.closest('.create-rental-from-booking-btn');
            const rejectBtn = e.target.closest('.reject-booking-btn');

            if (createRentalBtn) {
                const bookingId = createRentalBtn.dataset.bookingId;
                if (confirm(`Клиент пришел? Бронь #${bookingId} будет закрыта.`)) {
                    supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId)
                        .then(({ error }) => {
                            if (error) {
                                alert('Ошибка закрытия брони: ' + error.message);
                            } else {
                                alert('Бронь успешно закрыта!');
                                loadBookings();
                            }
                        });
                }
            }

            if (rejectBtn) {
                if (confirm('Вы уверены, что хотите отклонить эту бронь?')) {
                    const bookingId = rejectBtn.dataset.bookingId;
                    supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
                        .then(({ error }) => {
                            if (error) alert('Ошибка отмены брони: ' + error.message);
                            else loadBookings();
                        });
                }
            }
        });
    }

    // ЗАМЕНИ ВЕСЬ ЭТОТ БЛОК В СВОЕМ ФАЙЛЕ ADMIN.JS
    if (assignmentsTableBody) {
        assignmentsTableBody.addEventListener('click', async (e) => {
            console.log('Клик по таблице заявок:', e.target);
            const assignBtn = e.target.closest('.assign-bike-btn');
            const rejectBtn = e.target.closest('.reject-rental-btn');
            const processBtn = e.target.closest('.process-return-btn');
            const assignBatteriesBtn = e.target.closest('.assign-batteries-btn'); // <-- Наша кнопка

            console.log('assignBatteriesBtn найдена:', assignBatteriesBtn);

            // --- Блок для старой кнопки "Привязать вел." ---
            if (assignBtn) {
                const rentalId = assignBtn.dataset.rentalId;
                assignRentalIdInput.value = rentalId;

                try {
                    const { data, error } = await supabase.from('bikes').select('*').eq('status', 'available');
                    if (error) throw error;

                    bikeSelect.innerHTML = '<option value="">-- Выберите велосипед --</option>';
                    data.forEach(bike => {
                        const option = document.createElement('option');
                        option.value = bike.id;
                        option.textContent = `${bike.model_name} (#${bike.bike_code})`;
                        bikeSelect.appendChild(option);
                    });

                    bikeSelect.addEventListener('change', async () => {
                        const selectedId = bikeSelect.value;
                        if (selectedId) {
                            const selectedBike = data.find(b => b.id == selectedId);
                            if (selectedBike) {
                                assignBikeFrameNumberInput.value = selectedBike.frame_number || '';
                                assignBikeBatteryNumbersInput.value = Array.isArray(selectedBike.battery_numbers) ? selectedBike.battery_numbers.join(', ') : (selectedBike.battery_numbers || '');
                                assignBikeRegistrationNumberInput.value = selectedBike.registration_number || '';
                                assignBikeIotDeviceIdInput.value = selectedBike.iot_device_id || '';
                                assignBikeAdditionalEquipmentInput.value = selectedBike.additional_equipment || '';
                                bikeDetailsDiv.style.display = 'block';
                            }
                        } else {
                            bikeDetailsDiv.style.display = 'none';
                        }
                    });

                    assignBikeModal.classList.remove('hidden');
                } catch (err) {
                    alert('Не удалось загрузить список свободных велосипедов: ' + err.message);
                }
            }

            // --- Блок для кнопки "Отклонить" ---
            if (rejectBtn) {
                const rentalId = rejectBtn.dataset.rentalId;
                if (confirm(`Вы уверены, что хотите отклонить заявку #${rentalId} и вернуть средства клиенту?`)) {
                    toggleButtonLoading(rejectBtn, true, 'Отклонить', '...');
                    try {
                        const response = await authedFetch('/api/admin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'reject-rental', rental_id: rentalId })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || 'Ошибка сервера');

                        alert(result.message);
                        loadAssignments();

                    } catch (err) {
                        alert('Ошибка отклонения заявки: ' + err.message);
                    } finally {
                        toggleButtonLoading(rejectBtn, false, 'Отклонить', '...');
                    }
                }
            }

            // --- Блок для кнопки "Принять" (сдача велосипеда) ---
            if (processBtn) {
                const rentalId = processBtn.dataset.rentalId;
                const returnModal = document.getElementById('return-process-modal');
                const rentalIdInput = document.getElementById('return-process-rental-id');

                if (returnModal && rentalIdInput) {
                    // 1. Заполняем скрытое поле в модалке ID аренды
                    rentalIdInput.value = rentalId;

                    // 2. Сбрасываем форму на случай, если она была заполнена ранее
                    const defectsTextarea = document.getElementById('return-defects');
                    const bikeStatusRadios = document.querySelectorAll('input[name="bike-next-status"]');
                    const serviceReasonGroup = document.getElementById('service-reason-group');

                    if (defectsTextarea) defectsTextarea.value = '';
                    if (bikeStatusRadios.length > 0) bikeStatusRadios[0].checked = true;
                    if (serviceReasonGroup) serviceReasonGroup.classList.add('hidden');

                    // 3. Показываем модальное окно
                    returnModal.classList.remove('hidden');
                } else {
                    console.error('Модальное окно для приемки не найдено!');
                    alert('Ошибка: не удалось открыть окно приемки велосипеда.');
                }
            }

            // ==========================================================
            // === ВОТ НЕДОСТАЮЩИЙ БЛОК ДЛЯ КНОПКИ "ВЫБРАТЬ АКБ" ===
            // ==========================================================
            if (assignBatteriesBtn) {
                console.log('СРАБОТАЛ ОБРАБОТЧИК КНОПКИ ВЫБРАТЬ АКБ!');
                const rentalId = assignBatteriesBtn.dataset.rentalId;
                console.log('Rental ID:', rentalId);

                const searchInput = document.getElementById('battery-search-in-modal');
                searchInput.value = ''; // Сбрасываем поиск при открытии

                searchInput.addEventListener('input', () => {
                    const query = searchInput.value.toLowerCase().trim();
                    const batteryListContainer = document.getElementById('battery-select-list');
                    batteryListContainer.querySelectorAll('label').forEach(label => {
                        const batteryName = label.textContent.toLowerCase();
                        if (batteryName.includes(query)) {
                            label.style.display = 'block';
                        } else {
                            label.style.display = 'none';
                        }
                    });
                });

                console.log('Проверяем DOM элементы:');
                console.log('assignBatteriesRentalIdInput:', assignBatteriesRentalIdInput);
                console.log('batterySelectList:', batterySelectList);
                console.log('assignBatteriesModal:', assignBatteriesModal);

                if (!assignBatteriesRentalIdInput) {
                    alert('Ошибка: не найден элемент assign-batteries-rental-id');
                    return;
                }
                if (!batterySelectList) {
                    alert('Ошибка: не найден элемент battery-select-list');
                    return;
                }
                if (!assignBatteriesModal) {
                    alert('Ошибка: не найден элемент assign-batteries-modal');
                    return;
                }

                // Убеждаемся, что модальное окно находится в body
                if (!document.body.contains(assignBatteriesModal)) {
                    console.log('Модальное окно не в body, перемещаем...');
                    document.body.appendChild(assignBatteriesModal);
                }

                assignBatteriesRentalIdInput.value = rentalId;
                console.log('Значение установлено в поле:', assignBatteriesRentalIdInput.value);

                searchInput.value = ''; // Сбрасываем поиск при открытии

                searchInput.addEventListener('input', () => {
                    const query = searchInput.value.toLowerCase().trim();
                    const batteryListContainer = document.getElementById('battery-select-list');
                    batteryListContainer.querySelectorAll('label').forEach(label => {
                        const batteryName = label.textContent.toLowerCase();
                        if (batteryName.includes(query)) {
                            label.style.display = 'block';
                        } else {
                            label.style.display = 'none';
                        }
                    });
                });

                try {
                    console.log('Загружаем аккумуляторы из базы данных...');
                    // Загружаем только свободные аккумуляторы
                    const { data, error } = await supabase.from('batteries').select('*').eq('status', 'available');
                    if (error) throw error;

                    console.log('Получены аккумуляторы:', data);

                    batterySelectList.innerHTML = '';
                    if (data.length === 0) {
                        console.log('Нет свободных аккумуляторов');
                        batterySelectList.innerHTML = '<p>Нет свободных аккумуляторов.</p>';
                    } else {
                        console.log('Создаем список из', data.length, 'аккумуляторов');
                        data.forEach(battery => {
                            const label = document.createElement('label');
                            label.className = 'battery-checkbox-item';
                            label.innerHTML = `<input type="checkbox" value="${battery.id}">
                                <span>${battery.serial_number} (${battery.capacity_wh || 'N/A'} Wh)</span>`;
                            batterySelectList.appendChild(label);
                        });
                    }
                    
                    // ВАЖНО: Показываем поле выбора велосипеда (для новой аренды)
                    if (batteryModalBikeSelect) {
                        const bikeSelectGroup = batteryModalBikeSelect.closest('.form-group');
                        if (bikeSelectGroup) {
                            bikeSelectGroup.style.display = 'block';
                        }
                    }

                    // Устанавливаем правильный заголовок для новой аренды
                    const modalTitle = assignBatteriesModal.querySelector('.modal-header h3');
                    if (modalTitle) {
                        modalTitle.textContent = 'Выберите велосипед и аккумуляторы';
                    }

                    assignBatteriesModal.classList.remove('hidden');
            
                    // Load available bikes
                    try {
                        const { data: bikes, error: bikesError } = await supabase.from('bikes').select('*').eq('status', 'available');
                        if (bikesError) throw bikesError;
                        batteryModalBikeSelect.innerHTML = '<option value="">-- Выберите велосипед --</option>';
                        bikes.forEach(bike => {
                            const option = document.createElement('option');
                            option.value = bike.id;
                            option.textContent = `${bike.model_name} (#${bike.bike_code})`;
                            batteryModalBikeSelect.appendChild(option);
                        });
                    } catch (err) {
                        console.error('Ошибка загрузки велосипедов:', err);
                        alert('Ошибка загрузки списка велосипедов: ' + err.message);
                    }
                } catch (err) {
                    console.error('Ошибка при загрузке аккумуляторов:', err);
                    alert('Ошибка загрузки списка аккумуляторов: ' + err.message);
                }
            }
            // ==========================================================
            // === КОНЕЦ НОВОГО БЛОКА ===
            // ==========================================================
        });
    }

    if (assignBikeCancelBtn) {
        assignBikeCancelBtn.addEventListener('click', () => assignBikeModal.classList.add('hidden'));
    }

    if (assignBikeSubmitBtn) {
        assignBikeSubmitBtn.addEventListener('click', async () => {
            const rentalId = assignRentalIdInput.value;
            const bikeId = bikeSelect.value;

            if (!rentalId || !bikeId) {
                alert('Пожалуйста, выберите велосипед.');
                return;
            }

            toggleButtonLoading(assignBikeSubmitBtn, true, 'Привязать и активировать', 'Активация...');

            try {
                // Update bike data
                const batteryNumbers = assignBikeBatteryNumbersInput.value.split(',').map(s => s.trim()).filter(s => s);
                const bikeData = {
                    frame_number: assignBikeFrameNumberInput.value,
                    battery_numbers: batteryNumbers,
                    registration_number: assignBikeRegistrationNumberInput.value,
                    iot_device_id: assignBikeIotDeviceIdInput.value,
                    additional_equipment: assignBikeAdditionalEquipmentInput.value,
                };
                const { error: bikeError } = await supabase.from('bikes').update(bikeData).eq('id', bikeId);
                if (bikeError) throw new Error('Ошибка обновления данных велосипеда: ' + bikeError.message);

                const response = await authedFetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'assign-bike', rental_id: rentalId, bike_id: bikeId })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Ошибка сервера');

                alert('Аренда успешно активирована!');
                assignBikeModal.classList.add('hidden');
                loadAssignments();

            } catch (err) {
                alert('Ошибка активации аренды: ' + err.message);
            } finally {
                toggleButtonLoading(assignBikeSubmitBtn, false, 'Привязать и активировать', 'Активация...');
            }
        });
    }

    // --- НОВЫЙ БЛОК: Логика модального окна выбора АКБ ---

    if (assignBatteriesCancelBtn) {
        assignBatteriesCancelBtn.addEventListener('click', () => {
            assignBatteriesModal.classList.add('hidden');
            // Показываем поле велосипеда обратно (для следующего использования)
            if (batteryModalBikeSelect) {
                const bikeSelectGroup = batteryModalBikeSelect.closest('.form-group');
                if (bikeSelectGroup) {
                    bikeSelectGroup.style.display = 'block';
                }
            }
            // Если была открыта форма редактирования аренды, возвращаемся к ней
            if (rentalEditModal && rentalIdInput && rentalIdInput.value) {
                rentalEditModal.classList.remove('hidden');
            }
        });
    }

    if (assignBatteriesSubmitBtn) {
        assignBatteriesSubmitBtn.addEventListener('click', async () => {
            const rentalId = assignBatteriesRentalIdInput.value;
            const bikeId = batteryModalBikeSelect.value;
            const selectedCheckboxes = batterySelectList.querySelectorAll('input[type="checkbox"]:checked');
            const selectedBatteryIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value, 10));

            if (!bikeId) {
                alert('Пожалуйста, выберите велосипед.');
                return;
            }

            if (selectedBatteryIds.length === 0) {
                alert('Пожалуйста, выберите хотя бы один аккумулятор.');
                return;
            }

            // Проверяем, это редактирование существующей аренды или новая аренда
            // Получаем информацию об аренде
            const { data: rentalData, error: rentalFetchError } = await supabase
                .from('rentals')
                .select('bike_id')
                .eq('id', rentalId)
                .single();
            
            if (rentalFetchError) {
                alert('Ошибка получения данных аренды: ' + rentalFetchError.message);
                return;
            }

            // Если у аренды уже есть bike_id, это редактирование
            const isEditingExistingRental = rentalData && rentalData.bike_id;

            toggleButtonLoading(assignBatteriesSubmitBtn, true, 'Подтвердить и активировать', 'Активация...');

            try {
                if (isEditingExistingRental) {
                    // ЛОГИКА ДЛЯ РЕДАКТИРОВАНИЯ СУЩЕСТВУЮЩЕЙ АРЕНДЫ
                    
                    // Шаг 1: Получаем старые АКБ и освобождаем их
                    const { data: oldBatteries, error: oldBattError } = await supabase
                        .from('rental_batteries')
                        .select('battery_id')
                        .eq('rental_id', rentalId);
                    
                    if (!oldBattError && oldBatteries && oldBatteries.length > 0) {
                        const oldBatteryIds = oldBatteries.map(b => b.battery_id);
                        
                        // Освобождаем старые АКБ
                        await supabase
                            .from('batteries')
                            .update({ status: 'available' })
                            .in('id', oldBatteryIds);
                        
                        // Удаляем старые связи
                        await supabase
                            .from('rental_batteries')
                            .delete()
                            .eq('rental_id', rentalId);
                    }

                    // Шаг 2: Обновить статус новых АКБ на 'in_use'
                    const { error: batteryUpdateError } = await supabase
                        .from('batteries')
                        .update({ status: 'in_use' })
                        .in('id', selectedBatteryIds);
                    if (batteryUpdateError) throw new Error('Ошибка обновления статуса АКБ: ' + batteryUpdateError.message);

                    // Шаг 3: Создать новые записи в связующей таблице rental_batteries
                    const rentalBatteryRecords = selectedBatteryIds.map(battery_id => ({
                        rental_id: rentalId,
                        battery_id: battery_id
                    }));
                    const { error: linkError } = await supabase.from('rental_batteries').insert(rentalBatteryRecords);
                    if (linkError) throw new Error('Ошибка привязки АКБ к аренде: ' + linkError.message);

                    alert('Аккумуляторы успешно обновлены!');
                    assignBatteriesModal.classList.add('hidden');
                    
                    // Показываем поле велосипеда обратно
                    if (batteryModalBikeSelect) {
                        const bikeSelectGroup = batteryModalBikeSelect.closest('.form-group');
                        if (bikeSelectGroup) {
                            bikeSelectGroup.style.display = 'block';
                        }
                    }

                    // Обновляем список АКБ в окне редактирования
                    const { data: newBatteries, error: newBattError } = await supabase
                        .from('rental_batteries')
                        .select('battery_id, batteries(serial_number)')
                        .eq('rental_id', rentalId);

                    if (!newBattError && newBatteries) {
                        currentRentalBatteries = newBatteries.map(b => ({
                            id: b.battery_id,
                            serial: b.batteries?.serial_number || 'Неизвестно'
                        }));
                        renderRentalBatteriesList();
                    }

                    // Возвращаемся к окну редактирования аренды
                    rentalEditModal.classList.remove('hidden');
                    loadRentals(); // Обновляем список аренд

                } else {
                    // ЛОГИКА ДЛЯ НОВОЙ АРЕНДЫ
                    
                    // Шаг 1: Обновить статус велосипеда на 'rented'
                    const { error: bikeUpdateError } = await supabase
                        .from('bikes')
                        .update({ status: 'rented' })
                        .eq('id', bikeId);
                    if (bikeUpdateError) throw new Error('Ошибка обновления статуса велосипеда: ' + bikeUpdateError.message);

                    // Шаг 2: Привязать велосипед к аренде
                    const { error: rentalBikeUpdateError } = await supabase
                        .from('rentals')
                        .update({ bike_id: bikeId })
                        .eq('id', rentalId);
                    if (rentalBikeUpdateError) throw new Error('Ошибка привязки велосипеда к аренде: ' + rentalBikeUpdateError.message);

                    // Шаг 3: Обновить статус выбранных аккумуляторов на 'in_use'
                    const { error: batteryUpdateError } = await supabase
                        .from('batteries')
                        .update({ status: 'in_use' })
                        .in('id', selectedBatteryIds);
                    if (batteryUpdateError) throw new Error('Ошибка обновления статуса АКБ: ' + batteryUpdateError.message);

                    // Шаг 4: Создать записи в связующей таблице rental_batteries
                    const rentalBatteryRecords = selectedBatteryIds.map(battery_id => ({
                        rental_id: rentalId,
                        battery_id: battery_id
                    }));
                    const { error: linkError } = await supabase.from('rental_batteries').insert(rentalBatteryRecords);
                    if (linkError) throw new Error('Ошибка привязки АКБ к аренде: ' + linkError.message);

                    // Шаг 5: Обновить статус самой аренды на 'awaiting_contract_signing'
                    const { error: rentalUpdateError } = await supabase
                        .from('rentals')
                        .update({ status: 'awaiting_contract_signing' })
                        .eq('id', rentalId);
                    if (rentalUpdateError) throw new Error('Ошибка перевода аренды на подписание: ' + rentalUpdateError.message);

                    // Отправляем запрос на сервер, чтобы он послал уведомление
                    authedFetch('/api/admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'notify-battery-assignment', rentalId: parseInt(rentalId, 10) })
                    });

                    alert('Велосипед и аккумумуляторы назначены! Клиент получил уведомление о необходимости подписать договор.');
                    assignBatteriesModal.classList.add('hidden');
                    
                    // Показываем поле велосипеда обратно
                    if (batteryModalBikeSelect) {
                        const bikeSelectGroup = batteryModalBikeSelect.closest('.form-group');
                        if (bikeSelectGroup) {
                            bikeSelectGroup.style.display = 'block';
                        }
                    }
                    
                    loadAssignments(); // Обновляем список заявок
                }

            } catch (err) {
                alert('Произошла ошибка: ' + err.message);
            } finally {
                toggleButtonLoading(assignBatteriesSubmitBtn, false, 'Подтвердить и активировать', 'Активация...');
            }
        });
    }

    // --- Client Notes Logic ---
    const clientNotesList = document.getElementById('client-notes-list');
    const clientNoteInput = document.getElementById('client-note-input');
    const addNoteBtn = document.getElementById('add-note-btn');

    function renderNotes(notes = []) {
        if (!clientNotesList) return;
        const h4 = clientNotesList.previousElementSibling;
        if (!notes || notes.length === 0) {
            clientNotesList.style.display = 'none';
            if (h4 && h4.tagName === 'H4') h4.style.display = 'none';
            return;
        }
        clientNotesList.style.display = 'block';
        if (h4 && h4.tagName === 'H4') h4.style.display = 'block';
        clientNotesList.innerHTML = '';
        notes.slice().reverse().forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.style.borderBottom = '1px solid var(--progress-bar-bg)';
            noteEl.style.padding = '8px 0';
            noteEl.style.marginBottom = '8px';
            const author = note.author || 'Неизвестный автор';
            const date = note.timestamp ? new Date(note.timestamp).toLocaleString('ru-RU') : '';
            noteEl.innerHTML = `
                <p style="margin:0; white-space: pre-wrap; word-wrap: break-word;">${note.text}</p>
                <small style="color: #6b6b6b;">- ${author} (${date}) <span class="delete-note-cross" data-timestamp="${note.timestamp}" style="cursor: pointer; color: #e53e3e; font-weight: bold; margin-left: 10px;">×</span></small>
            `;
            clientNotesList.appendChild(noteEl);
        });
    }


    if (clientNotesList) {
        clientNotesList.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-note-cross')) {
                const timestamp = e.target.dataset.timestamp;
                if (confirm('Удалить эту заметку?')) {
                    await removeNote(timestamp);
                }
            }
        });
    }

    // --- Invoice Logic ---
    if (invoiceCreateBtn) {
        invoiceCreateBtn.addEventListener('click', () => {
            // currentEditingId is set when the client info modal is opened
            if (currentEditingId && invoiceModal) {
                invoiceClientIdInput.value = currentEditingId;
                // It's better to hide the info overlay before showing the invoice one
                if (clientInfoOverlay) clientInfoOverlay.classList.add('hidden');
                invoiceModal.classList.remove('hidden');
            } else {
                alert('Сначала выберите клиента для выставления счета.');
            }
        });
    }

    if (invoiceCancelBtn) {
        invoiceCancelBtn.addEventListener('click', () => {
            if (invoiceModal) {
                invoiceModal.classList.add('hidden');
            }
        });
    }

    // Also close on overlay click
    if (invoiceModal) {
        invoiceModal.addEventListener('click', (e) => {
            if (e.target === invoiceModal) {
                invoiceModal.classList.add('hidden');
            }
        });
    }

    if (invoiceSubmitBtn) {
        invoiceSubmitBtn.addEventListener('click', async () => {
            const userId = invoiceClientIdInput.value;
            const amount = invoiceAmountInput.value;
            const description = invoiceDescriptionInput.value;

            if (!userId || !amount || !description) {
                alert('Пожалуйста, заполните все поля: сумма и описание.');
                return;
            }

            toggleButtonLoading(invoiceSubmitBtn, true, 'Выставить и списать', 'Отправка...');

            try {
                const response = await authedFetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create-invoice', userId, amount, description })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `Ошибка сервера: ${response.status}`);
                }

                const responseText = await response.text();

                // Если ответ пустой, считаем, что все прошло успешно
                if (!responseText) {
                    alert('Счет успешно создан и отправлен на списание.');
                } else {
                    // Иначе, пытаемся парсить JSON
                    const result = JSON.parse(responseText);
                    alert(result.message || 'Счет успешно создан и отправлен на списание.');
                }

                invoiceModal.classList.add('hidden');
                invoiceAmountInput.value = '';
                invoiceDescriptionInput.value = '';

            } catch (err) {
                // Умное сообщение об ошибке
                if (err.message.includes('Unexpected token')) {
                    alert('Ошибка: получен некорректный ответ от сервера. Возможно, он временно недоступен.');
                } else {
                    alert('Ошибка: ' + err.message);
                }
            } finally {
                toggleButtonLoading(invoiceSubmitBtn, false, 'Выставить и списать', 'Отправка...');
            }
        });
    }

    // --- Export Logic ---
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const { data, error } = await supabase.from('clients').select('*');
                if (error) throw error;

                const headers = ['id', 'name', 'phone', 'city', 'tg_user_id', 'created_at'];
                const csvRows = [headers.join(',')];
                data.forEach(c => {
                    const row = headers.map(header => JSON.stringify(c[header] || ''));
                    csvRows.push(row.join(','));
                });

                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('Ошибка экспорта: ' + err.message);
            }
        });
    }

    // --- New Step-by-Step Return Processing Logic ---
    const returnProcessModal = document.getElementById('return-process-modal');
    if (returnProcessModal) {
        const returnProcessCloseBtn = document.getElementById('return-process-close-btn');
        const returnRentalIdInput = document.getElementById('return-process-rental-id');
        const returnDefectsTextarea = document.getElementById('return-defects');
        const bikeNextStatusRadios = document.querySelectorAll('input[name="bike-next-status"]');
        const serviceReasonGroup = document.getElementById('service-reason-group');
        const serviceReasonInput = document.getElementById('service-reason');
        const finalizeReturnBtn = document.getElementById('finalize-return-btn');

        // Step navigation elements
        const returnPrevBtn = document.getElementById('return-prev-btn');
        const returnNextBtn = document.getElementById('return-next-btn');
        const returnStep1 = document.getElementById('return-step-1');
        const returnStep2 = document.getElementById('return-step-2');
        const returnStep3 = document.getElementById('return-step-3');
        const chargeDamageRadios = document.querySelectorAll('input[name="charge-damage"]');
        const damageAmountGroup = document.getElementById('damage-amount-group');
        const damageAmountInput = document.getElementById('damage-amount');
        const damageDescriptionInput = document.getElementById('damage-description');

        let currentStep = 1;

        // Helper: Update step indicators
        function updateStepIndicators() {
            document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
                const stepNum = index + 1;
                const circle = indicator.querySelector('.step-circle');

                if (stepNum < currentStep) {
                    circle.classList.add('completed');
                    circle.classList.remove('active');
                } else if (stepNum === currentStep) {
                    circle.classList.add('active');
                    circle.classList.remove('completed');
                } else {
                    circle.classList.remove('active', 'completed');
                }

                indicator.classList.toggle('active', stepNum === currentStep);
            });
        }

        // Helper: Show specific step
        function showStep(step) {
            currentStep = step;

            // Hide all steps
            returnStep1.classList.add('hidden');
            returnStep2.classList.add('hidden');
            returnStep3.classList.add('hidden');

            // Show current step
            if (step === 1) returnStep1.classList.remove('hidden');
            if (step === 2) returnStep2.classList.remove('hidden');
            if (step === 3) returnStep3.classList.remove('hidden');

            // Update buttons
            returnPrevBtn.classList.toggle('hidden', step === 1);
            returnNextBtn.classList.toggle('hidden', step === 3);
            finalizeReturnBtn.classList.toggle('hidden', step !== 3);

            updateStepIndicators();
        }

        // Helper: Reset modal to step 1
        function resetModal() {
            showStep(1);
            returnDefectsTextarea.value = '';
            serviceReasonInput.value = '';
            damageAmountInput.value = '';
            damageDescriptionInput.value = '';
            document.querySelector('input[name="bike-next-status"][value="available"]').checked = true;
            document.querySelector('input[name="charge-damage"][value="no"]').checked = true;
            serviceReasonGroup.classList.add('hidden');
            damageAmountGroup.classList.add('hidden');
        }

        // Helper function to run the finalization sequence
        const finalizeAndSendAct = async (rentalId, defects, newBikeStatus, serviceReason, shouldCharge, chargeAmount, chargeDescription) => {
            toggleButtonLoading(finalizeReturnBtn, true, 'Завершить приемку', 'Обработка...');
            try {
                const { data: rental, error: rentalFetchError } = await supabase.from('rentals').select('user_id').eq('id', rentalId).single();
                if (rentalFetchError) throw new Error('Не удалось получить данные аренды для отправки акта.');
                const userId = rental.user_id;

                // Step 1: Charge for damages if needed
                if (shouldCharge && chargeAmount > 0) {
                    const chargeResponse = await authedFetch('/api/admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'charge-for-damages',
                            userId,
                            rentalId,
                            amount: chargeAmount,
                            description: chargeDescription || 'Возмещение ущерба',
                            defects
                        })
                    });

                    const chargeResult = await chargeResponse.json();
                    if (!chargeResponse.ok) throw new Error(chargeResult.error || 'Ошибка списания средств');
                }

                // Step 2: Generate return act PDF
                const pdfServerUrl = window.CONFIG.CONTRACTS_API_URL + '/api/user';
                const pdfResponse = await fetch(pdfServerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'generate-return-act', userId, rentalId, defects })
                });
                const pdfResult = await pdfResponse.json();
                if (!pdfResponse.ok) throw new Error(pdfResult.error || 'Ошибка генерации PDF акта.');

                // Step 3: Finalize return
                const finalizeResponse = await authedFetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'finalize-return',
                        rental_id: rentalId,
                        new_bike_status: newBikeStatus,
                        service_reason: serviceReason,
                        return_act_url: pdfResult.publicUrl,
                        defects
                    })
                });
                if (!finalizeResponse.ok) {
                    const errorResult = await finalizeResponse.json();
                    throw new Error(errorResult.error || 'Ошибка завершения аренды.');
                }

                alert('✅ Приемка велосипеда успешно завершена! Акт отправлен клиенту на подпись.');
                returnProcessModal.classList.add('hidden');
                resetModal();
                loadAssignments();
                loadBikes();
                return true;
            } catch (err) {
                alert('❌ Произошла ошибка: ' + err.message);
                return false;
            } finally {
                toggleButtonLoading(finalizeReturnBtn, false, 'Завершить приемку', 'Обработка...');
            }
        };

        // Show/hide service reason input
        bikeNextStatusRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                serviceReasonGroup.classList.toggle('hidden', radio.value !== 'in_service');
            });
        });

        // Show/hide damage amount input
        chargeDamageRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                damageAmountGroup.classList.toggle('hidden', radio.value !== 'yes');
            });
        });

        // Modal close events
        returnProcessCloseBtn.addEventListener('click', () => {
            returnProcessModal.classList.add('hidden');
            resetModal();
        });
        returnProcessModal.addEventListener('click', (e) => {
            if (e.target === returnProcessModal) {
                returnProcessModal.classList.add('hidden');
                resetModal();
            }
        });

        // Step navigation
        returnPrevBtn.addEventListener('click', () => {
            if (currentStep > 1) showStep(currentStep - 1);
        });

        returnNextBtn.addEventListener('click', () => {
            // Validation before moving to next step
            if (currentStep === 1) {
                const selectedStatus = document.querySelector('input[name="bike-next-status"]:checked').value;
                if (selectedStatus === 'in_service' && !serviceReasonInput.value.trim()) {
                    alert('Пожалуйста, укажите причину ремонта.');
                    return;
                }
            }

            if (currentStep < 3) showStep(currentStep + 1);
        });

        // Finalize button
        finalizeReturnBtn.addEventListener('click', async () => {
            const rentalId = returnRentalIdInput.value;
            const defects = returnDefectsTextarea.value.split('\n').map(d => d.trim()).filter(d => d);
            const newBikeStatus = document.querySelector('input[name="bike-next-status"]:checked').value;
            const serviceReason = serviceReasonInput.value.trim();
            const shouldCharge = document.querySelector('input[name="charge-damage"]:checked').value === 'yes';
            const chargeAmount = shouldCharge ? parseFloat(damageAmountInput.value) : 0;
            const chargeDescription = damageDescriptionInput.value.trim();

            // Validation
            if (shouldCharge) {
                if (!chargeAmount || chargeAmount <= 0) {
                    alert('Пожалуйста, укажите корректную сумму для списания.');
                    return;
                }
                if (!chargeDescription) {
                    alert('Пожалуйста, укажите описание для счета.');
                    return;
                }
            }

            await finalizeAndSendAct(rentalId, defects, newBikeStatus, serviceReason, shouldCharge, chargeAmount, chargeDescription);
        });

        // Initialize modal on first open
        resetModal();
    }

    // --- Step-by-Step Tariff Modal Logic ---
    if (tariffModal) {
        let currentTariffStep = 1;
        let editingTariffId = null;

        // Helper: Update step indicators
        function updateTariffStepIndicators() {
            document.querySelectorAll('#tariff-modal .step-indicator').forEach((indicator, index) => {
                const stepNum = index + 1;
                const circle = indicator.querySelector('.step-circle');

                if (stepNum < currentTariffStep) {
                    circle.classList.add('completed');
                    circle.classList.remove('active');
                } else if (stepNum === currentTariffStep) {
                    circle.classList.add('active');
                    circle.classList.remove('completed');
                } else {
                    circle.classList.remove('active', 'completed');
                }

                indicator.classList.toggle('active', stepNum === currentTariffStep);
            });
        }

        // Helper: Show specific step
        function showTariffStep(step) {
            currentTariffStep = step;

            // Hide all steps
            tariffStep1.classList.add('hidden');
            tariffStep2.classList.add('hidden');
            tariffStep3.classList.add('hidden');

            // Show current step
            if (step === 1) tariffStep1.classList.remove('hidden');
            if (step === 2) tariffStep2.classList.remove('hidden');
            if (step === 3) tariffStep3.classList.remove('hidden');

            // Update buttons
            tariffPrevBtn.classList.toggle('hidden', step === 1);
            tariffNextBtn.classList.toggle('hidden', step === 3);
            tariffSaveBtn.classList.toggle('hidden', step !== 3);

            updateTariffStepIndicators();
        }

        // Helper: Reset modal
        function resetTariffModal() {
            showTariffStep(1);
            tariffIdInput.value = '';
            tariffTitleInput.value = '';
            tariffShortDescriptionInput.value = '';
            tariffActiveCheckbox.checked = true;
            extensionsList.innerHTML = '';
            editingTariffId = null;
            tariffModalTitle.textContent = 'Новый тариф';
            addExtensionRow(); // Add one default row
        }

        // Helper: Add extension row
        function addExtensionRow(days = '', price = '') {
            const row = document.createElement('div');
            row.className = 'extension-item';
            row.innerHTML = `
                <input type="number" placeholder="Дней" value="${days}" min="1" required>
                <input type="number" placeholder="Цена (₽)" value="${price}" min="0" step="0.01" required>
                <button type="button" class="remove-extension-btn">×</button>
            `;

            row.querySelector('.remove-extension-btn').addEventListener('click', () => {
                if (extensionsList.children.length > 1) {
                    row.remove();
                } else {
                    alert('Должен быть хотя бы один период аренды');
                }
            });

            extensionsList.appendChild(row);
        }

        // Add extension button
        if (addExtensionBtn) {
            addExtensionBtn.addEventListener('click', () => addExtensionRow());
        }

        // Open modal for new tariff
        if (tariffAddBtn) {
            tariffAddBtn.addEventListener('click', () => {
                resetTariffModal();
                tariffModal.classList.remove('hidden');
            });
        }

        // Close modal
        if (tariffModalCloseBtn) {
            tariffModalCloseBtn.addEventListener('click', () => {
                tariffModal.classList.add('hidden');
                resetTariffModal();
            });
        }

        // Close on overlay click
        tariffModal.addEventListener('click', (e) => {
            if (e.target === tariffModal) {
                tariffModal.classList.add('hidden');
                resetTariffModal();
            }
        });

        // Step navigation
        if (tariffPrevBtn) {
            tariffPrevBtn.addEventListener('click', () => {
                if (currentTariffStep > 1) showTariffStep(currentTariffStep - 1);
            });
        }

        if (tariffNextBtn) {
            tariffNextBtn.addEventListener('click', () => {
                // Validation before moving to next step
                if (currentTariffStep === 1) {
                    if (!tariffTitleInput.value.trim()) {
                        alert('Пожалуйста, укажите название тарифа');
                        return;
                    }
                }

                if (currentTariffStep === 2) {
                    const rows = extensionsList.querySelectorAll('.extension-item');
                    let valid = true;
                    rows.forEach(row => {
                        const inputs = row.querySelectorAll('input');
                        if (!inputs[0].value || !inputs[1].value) {
                            valid = false;
                        }
                    });
                    if (!valid) {
                        alert('Пожалуйста, заполните все поля стоимости и длительности');
                        return;
                    }
                }

                if (currentTariffStep < 3) showTariffStep(currentTariffStep + 1);
            });
        }

        // Save tariff
        if (tariffSaveBtn) {
            tariffSaveBtn.addEventListener('click', async () => {
                try {
                    toggleButtonLoading(tariffSaveBtn, true, 'Сохранить тариф', 'Сохранение...');

                    // Collect extensions data
                    const extensions = [];
                    extensionsList.querySelectorAll('.extension-item').forEach(row => {
                        const inputs = row.querySelectorAll('input');
                        extensions.push({
                            days: parseInt(inputs[0].value),
                            price_rub: parseFloat(inputs[1].value)
                        });
                    });

                    const tariffData = {
                        title: tariffTitleInput.value.trim(),
                        short_description: tariffShortDescriptionInput.value.trim(),
                        extensions: extensions,
                        is_active: tariffActiveCheckbox.checked
                    };

                    let result;
                    if (editingTariffId) {
                        result = await supabase.from('tariffs').update(tariffData).eq('id', editingTariffId);
                    } else {
                        result = await supabase.from('tariffs').insert([tariffData]);
                    }

                    if (result.error) throw result.error;

                    alert(editingTariffId ? 'Тариф успешно обновлен' : 'Тариф успешно создан');
                    tariffModal.classList.add('hidden');
                    resetTariffModal();
                    await loadTariffs();

                } catch (err) {
                    alert('Ошибка сохранения тарифа: ' + err.message);
                } finally {
                    toggleButtonLoading(tariffSaveBtn, false, 'Сохранить тариф', 'Сохранение...');
                }
            });
        }

        // Edit tariff function (will be called from table)
        window.editTariffModal = async function (id) {
            try {
                const { data, error } = await supabase.from('tariffs').select('*').eq('id', id).single();
                if (error) throw error;

                editingTariffId = id;
                tariffModalTitle.textContent = 'Редактировать тариф';
                tariffIdInput.value = id;
                tariffTitleInput.value = data.title || '';
                tariffShortDescriptionInput.value = data.short_description || '';
                tariffActiveCheckbox.checked = data.is_active !== false;

                // Load extensions
                extensionsList.innerHTML = '';
                if (data.extensions && data.extensions.length > 0) {
                    data.extensions.forEach(ext => {
                        addExtensionRow(ext.days, ext.price_rub);
                    });
                } else {
                    addExtensionRow();
                }

                showTariffStep(1);
                tariffModal.classList.remove('hidden');

            } catch (err) {
                alert('Ошибка загрузки тарифа: ' + err.message);
            }
        };
    }

    // --- Step-by-Step Bike Modal Logic ---
    if (bikeModal) {
        let currentBikeStep = 1;
        let editingBikeId = null;

        // Helper: Update step indicators
        function updateBikeStepIndicators() {
            document.querySelectorAll('#bike-modal .step-indicator').forEach((indicator, index) => {
                const stepNum = index + 1;
                const circle = indicator.querySelector('.step-circle');

                if (stepNum < currentBikeStep) {
                    circle.classList.add('completed');
                    circle.classList.remove('active');
                } else if (stepNum === currentBikeStep) {
                    circle.classList.add('active');
                    circle.classList.remove('completed');
                } else {
                    circle.classList.remove('active', 'completed');
                }

                indicator.classList.toggle('active', stepNum === currentBikeStep);
            });
        }

        // Helper: Show specific step
        function showBikeStep(step) {
            currentBikeStep = step;

            // Hide all steps
            bikeStep1.classList.add('hidden');
            bikeStep2.classList.add('hidden');
            bikeStep3.classList.add('hidden');

            // Show current step
            if (step === 1) bikeStep1.classList.remove('hidden');
            if (step === 2) bikeStep2.classList.remove('hidden');
            if (step === 3) bikeStep3.classList.remove('hidden');

            // Update buttons
            bikePrevBtn.classList.toggle('hidden', step === 1);
            bikeNextBtn.classList.toggle('hidden', step === 3);
            bikeSaveBtn.classList.toggle('hidden', step !== 3);

            updateBikeStepIndicators();
        }

        // Helper: Reset modal
        function resetBikeModal() {
            showBikeStep(1);
            bikeIdInput.value = '';
            bikeCodeInput.value = '';
            bikeModelInput.value = '';
            bikeCitySelect.value = 'Москва';
            bikeTariffSelect.value = '';
            bikeFrameNumberInput.value = '';
            bikeRegistrationNumberInput.value = '';
            bikeIotDeviceIdInput.value = '';
            bikeAdditionalEquipmentInput.value = '';
            bikeStatusSelect.value = 'available';
            editingBikeId = null;
            bikeModalTitle.textContent = 'Новый велосипед';
        }

        // Open modal for new bike
        if (bikeAddBtn) {
            bikeAddBtn.addEventListener('click', () => {
                resetBikeModal();
                bikeModal.classList.remove('hidden');
            });
        }

        // Close modal
        if (bikeModalCloseBtn) {
            bikeModalCloseBtn.addEventListener('click', () => {
                bikeModal.classList.add('hidden');
                resetBikeModal();
            });
        }

        // Close on overlay click
        bikeModal.addEventListener('click', (e) => {
            if (e.target === bikeModal) {
                bikeModal.classList.add('hidden');
                resetBikeModal();
            }
        });

        // Step navigation
        if (bikePrevBtn) {
            bikePrevBtn.addEventListener('click', () => {
                if (currentBikeStep > 1) showBikeStep(currentBikeStep - 1);
            });
        }

        if (bikeNextBtn) {
            bikeNextBtn.addEventListener('click', () => {
                // Validation before moving to next step
                if (currentBikeStep === 1) {
                    if (!bikeCodeInput.value.trim()) {
                        alert('Пожалуйста, укажите код велосипеда');
                        return;
                    }
                    if (!bikeModelInput.value.trim()) {
                        alert('Пожалуйста, укажите модель велосипеда');
                        return;
                    }
                }

                if (currentBikeStep < 3) showBikeStep(currentBikeStep + 1);
            });
        }

        // Save bike
        if (bikeSaveBtn) {
            bikeSaveBtn.addEventListener('click', async () => {
                try {
                    toggleButtonLoading(bikeSaveBtn, true, 'Сохранить велосипед', 'Сохранение...');

                    const bikeData = {
                        bike_code: bikeCodeInput.value.trim(),
                        model_name: bikeModelInput.value.trim(),
                        city: bikeCitySelect.value,
                        status: bikeStatusSelect.value,
                        frame_number: bikeFrameNumberInput.value.trim() || null,
                        registration_number: bikeRegistrationNumberInput.value.trim() || null,
                        iot_device_id: bikeIotDeviceIdInput.value.trim() || null,
                        additional_equipment: bikeAdditionalEquipmentInput.value.trim() || null,
                        tariff_id: bikeTariffSelect.value || null
                    };

                    let result;
                    if (editingBikeId) {
                        result = await supabase.from('bikes').update(bikeData).eq('id', editingBikeId);
                    } else {
                        result = await supabase.from('bikes').insert([bikeData]);
                    }

                    if (result.error) throw result.error;

                    alert(editingBikeId ? 'Велосипед успешно обновлен' : 'Велосипед успешно создан');
                    bikeModal.classList.add('hidden');
                    resetBikeModal();
                    await loadBikes();

                } catch (err) {
                    alert('Ошибка сохранения велосипеда: ' + err.message);
                } finally {
                    toggleButtonLoading(bikeSaveBtn, false, 'Сохранить велосипед', 'Сохранение...');
                }
            });
        }

        // Edit bike function (will be called from table)
        window.editBikeModal = async function (id) {
            try {
                const { data, error } = await supabase.from('bikes').select('*').eq('id', id).single();
                if (error) throw error;

                editingBikeId = id;
                bikeModalTitle.textContent = 'Редактировать велосипед';
                bikeIdInput.value = id;
                bikeCodeInput.value = data.bike_code || '';
                bikeModelInput.value = data.model_name || '';
                bikeCitySelect.value = data.city || 'Москва';
                bikeStatusSelect.value = data.status || 'available';
                bikeFrameNumberInput.value = data.frame_number || '';
                bikeRegistrationNumberInput.value = data.registration_number || '';
                bikeIotDeviceIdInput.value = data.iot_device_id || '';
                bikeAdditionalEquipmentInput.value = data.additional_equipment || '';
                bikeTariffSelect.value = data.tariff_id || '';

                showBikeStep(1);
                bikeModal.classList.remove('hidden');

            } catch (err) {
                alert('Ошибка загрузки велосипеда: ' + err.message);
            }
        };
    }

    // --- Page Transitions ---
    function handlePageTransitions() {
        // Add exit animation when navigating away
        document.querySelectorAll('a[href]').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && (href.includes('admin_support.html') || href.includes('admin.html'))) {
                    e.preventDefault();
                    const adminApp = document.getElementById('admin-app');
                    adminApp.classList.add('page-transition-exit');

                    setTimeout(() => {
                        window.location.href = href;
                    }, 300);
                }
            });
        });

        // Add enter animation on page load
        const adminApp = document.getElementById('admin-app');
        adminApp.classList.add('page-transition-enter');
    }

    // --- Initial Load ---
    checkSession();
    handlePageTransitions();

    // ==== Templates Manager (Шаблоны договоров) ====

    const PLACEHOLDERS = {
        client: [
            ['client.full_name', 'ФИО'], ['client.first_name', 'Имя'], ['client.last_name', 'Фамилия'], ['client.middle_name', 'Отчество'],
            ['client.passport_series', 'Серия паспорта'], ['client.passport_number', 'Номер паспорта'], ['client.issued_by', 'Кем выдан'],
            ['client.issued_at', 'Дата выдачи'], ['client.birth_date', 'Дата рождения'], ['client.city', 'Город'], ['client.address', 'Адрес'],
            ['client.phone', 'Телефон'], ['client.inn', 'ИНН'], ['client.emergency_phone', 'Экстренный телефон'], ['client.citizenship', 'Гражданство']
        ],
        bike: [
            ['bike.name', 'Наименование'], ['bike.code', 'Код'], ['bike.frame_number', 'Номер рамы'], ['bike.battery_numbers', 'Номера аккумуляторов'],
            ['bike.registration_number', 'Рег. номер'], ['bike.iot_device_id', 'Номер IOT'], ['bike.additional_equipment', 'Доп. оборудование']
        ],
        tariff: [['tariff.title', 'Тариф'], ['tariff.duration_days', 'Дней'], ['tariff.price_rub', 'Сумма ₽']],
        rental: [['rental.id', '№ аренды'], ['rental.starts_at', 'Начало'], ['rental.ends_at', 'Конец'], ['rental.bike_id', 'ID велосипеда']],
        aux: [['now.date', 'Дата'], ['now.time', 'Время'], ['contract.city', 'Город акта']]
    };

    function mountChips(container, items) {
        if (!container) return;
        container.innerHTML = '';
        items.forEach(([value, label]) => {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = label;
            chip.title = `Вставить {{${value}}}`;
            chip.addEventListener('click', () => insertAtCaret(`{{${value}}}`));
            container.appendChild(chip);
        });
    }

    function insertAtCaret(text) {
        if (!templateEditor) return;
        templateEditor.focus();
        document.execCommand('insertText', false, text);
    }

    function toolbarAction(e) {
        const btn = e.target.closest('button[data-cmd]');
        if (!btn || !templateEditorInstance) return;
        const cmd = btn.dataset.cmd;
        if (cmd === 'bold') {
            templateEditorInstance.chain().focus().toggleBold().run();
        } else if (cmd === 'italic') {
            templateEditorInstance.chain().focus().toggleItalic().run();
        } else if (cmd === 'underline') {
            // Underline not in StarterKit, need to add extension
            // For now, skip or add later
        } else if (cmd === 'insertParagraph') {
            templateEditorInstance.chain().focus().setParagraph().run();
        }
    }

    // selection tracking inside editor
    function isWithinEditor(node) { return templateEditor && node && (node === templateEditor || templateEditor.contains(node)); }
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection ? window.getSelection() : null;
        if (!sel || sel.rangeCount === 0) return;
        const r = sel.getRangeAt(0);
        if (isWithinEditor(r.startContainer)) {
            lastSelRange = r.cloneRange();
        }
    });

    function insertAtSavedRange(token) {
        if (!templateEditor) return;
        templateEditor.focus();
        const sel = window.getSelection();
        try {
            if (lastSelRange && isWithinEditor(lastSelRange.startContainer)) {
                sel.removeAllRanges();
                sel.addRange(lastSelRange);
            }
            const range = sel.rangeCount ? sel.getRangeAt(0) : null;
            if (range) {
                range.deleteContents();
                const span = document.createElement('span');
                span.className = 'ph';
                span.textContent = token;
                range.insertNode(span);
                // move caret after inserted
                range.setStartAfter(span);
                range.collapse(true);
                sel.removeAllRanges(); sel.addRange(range);
            } else {
                document.execCommand('insertText', false, token);
            }
        } catch {
            document.execCommand('insertText', false, token);
        }
        // highlight
        highlightPlaceholdersInEditor();
    }

    // --- Drag&Drop и подсветка плейсхолдеров ---
    function enableDnDForChips() {
        document.querySelectorAll('.chips .chip').forEach(chip => {
            if (chip.dataset.dnd === '1') return;
            chip.dataset.dnd = '1';
            chip.setAttribute('draggable', 'true');
            chip.addEventListener('dragstart', (e) => {
                const token = `{{${chip.title.replace('Вставить ', '').replace(/[{}]/g, '').trim()}}}`;
                e.dataTransfer.setData('text/plain', token);
                chip.classList.add('dragging');
            });
            chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
            // после клика (вставки) подсветить
            chip.addEventListener('click', () => setTimeout(highlightPlaceholdersInEditor, 0));
        });
        if (templateEditor) {
            templateEditor.addEventListener('dragover', (e) => { e.preventDefault(); templateEditor.classList.add('drag-over'); });
            templateEditor.addEventListener('dragleave', () => templateEditor.classList.remove('drag-over'));
            templateEditor.addEventListener('drop', (e) => {
                e.preventDefault();
                templateEditor.classList.remove('drag-over');
                const text = e.dataTransfer.getData('text/plain');
                if (text) {
                    templateEditor.focus();
                    document.execCommand('insertText', false, text);
                    highlightPlaceholdersInEditor();
                    templateEditor.classList.add('drop-anim');
                    setTimeout(() => templateEditor.classList.remove('drop-anim'), 300);
                }
            });
            templateEditor.addEventListener('blur', highlightPlaceholdersInEditor);
        }
    }

    function highlightPlaceholdersInEditor() {
        if (!templateEditor) return;
        try {
            let html = templateEditor.innerHTML;
            html = html.replace(/<span class=\"ph\">(.*?)<\/span>/g, '$1');
            html = html.replace(/(\{\{\s*[\w\.\-]+\s*\}\})/g, '<span class="ph">$1<\/span>');
            templateEditor.innerHTML = html;
        } catch { }
    }

    // Навешиваем кликовую вставку, которая сохраняет позицию курсора
    function addChipClickHandlers() {
        document.querySelectorAll('.chips .chip').forEach(chip => {
            if (chip.dataset.clickBound === '1') return;
            chip.dataset.clickBound = '1';
            chip.addEventListener('mousedown', (e) => e.preventDefault());
            chip.addEventListener('click', () => {
                const m = /\{\{.*?\}\}/.exec(chip.title || '');
                const token = m ? m[0] : `{{${chip.textContent.trim()}}}`;
                insertAtSavedRange(token);
            });
        });
    }

    // --- Предпросмотр шаблона ---
    const templatePreviewBtn = document.getElementById('template-preview-btn');
    const templatePreviewOverlay = document.getElementById('template-preview-overlay');
    const templatePreviewContent = document.getElementById('template-preview-content');
    const templatePreviewClose = document.getElementById('template-preview-close');

    function pathGet(obj, path) { try { return path.split('.').reduce((o, k) => (o && o[k] != null) ? o[k] : '', obj); } catch { return '' } }
    function buildPreviewHTML() {
        const ctx = {
            client: { full_name: 'Иванов Иван Иванович', first_name: 'Иван', last_name: 'Иванов', middle_name: 'Иванович', passport_series: '12 34', passport_number: '567890', issued_by: 'ОВД г. Москва', issued_at: '01.01.2020', birth_date: '02.02.1990', city: 'Москва', address: 'ул. Пушкина, д.1' },
            tariff: { title: 'Золотой', duration_days: 7, price_rub: 3750 },
            rental: { id: 12345, starts_at: '2025-09-01', ends_at: '2025-09-08', bike_id: '00001' },
            now: { date: new Date().toLocaleDateString('ru-RU'), time: new Date().toLocaleTimeString('ru-RU') }
        };
        let html = templateEditor ? templateEditor.innerHTML : '';
        html = html.replace(/\{\{\s*([\w\.\-]+)\s*\}\}/g, (_, k) => { const v = pathGet(ctx, k); return v === undefined ? '' : String(v) });
        return html;
    }
    function openTemplatePreview() { if (!templatePreviewOverlay || !templatePreviewContent) return; templatePreviewContent.innerHTML = buildPreviewHTML(); templatePreviewOverlay.classList.remove('hidden'); }
    function closeTemplatePreview() { if (templatePreviewOverlay) templatePreviewOverlay.classList.add('hidden'); }
    if (templatePreviewBtn) templatePreviewBtn.addEventListener('click', openTemplatePreview);
    if (templatePreviewClose) templatePreviewClose.addEventListener('click', closeTemplatePreview);
    if (templatePreviewOverlay) templatePreviewOverlay.addEventListener('click', (e) => { if (e.target === templatePreviewOverlay) closeTemplatePreview(); });

    function initTemplateEditor() {
        if (templateEditorInstance) {
            templateEditorInstance.destroy();
        }
        const editorElement = document.getElementById('template-editor');
        if (editorElement) {
            templateEditorInstance = new TipTap.Editor({
                element: editorElement,
                extensions: [
                    TipTap.StarterKit,
                ],
                content: '',
                onUpdate: ({ editor }) => {
                    // Optional: handle updates
                },
            });
        }
    }

    async function loadTemplates() {
        try {
            // chips
            mountChips(chipsClient, PLACEHOLDERS.client);
            mountChips(chipsTariff, PLACEHOLDERS.tariff);
            mountChips(chipsRental, PLACEHOLDERS.rental);
            mountChips(chipsAux, PLACEHOLDERS.aux);
            addChipClickHandlers();

            // включаем перетаскивание и постподсветку
            enableDnDForChips();

            // Initialize TipTap editor
            initTemplateEditor();

            const { data, error } = await supabase.from('contract_templates').select('*').order('id', { ascending: true });
            if (error) throw error;
            if (templatesTableBody) {
                templatesTableBody.innerHTML = '';
                (data || []).forEach(t => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
              <td>${t.name}</td>
              <td>${t.is_active ? 'Да' : 'Нет'}</td>
              <td class="table-actions">
                <button type="button" class="template-edit-btn" data-id="${t.id}">Ред.</button>
                <button type="button" class="template-delete-btn" data-id="${t.id}">Удалить</button>
              </td>`;
                    templatesTableBody.appendChild(tr);
                });
            }
            if (contractTemplateSelect) {
                const selected = contractTemplateSelect.value;
                contractTemplateSelect.innerHTML = '<option value="">— Не выбран —</option>' + (data || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
                if (selected) contractTemplateSelect.value = selected;
            }
        } catch (err) {
            console.error('Ошибка загрузки шаблонов:', err);
        }
    }

    async function saveTemplate() {
        if (!templateEditorInstance) return;
        const id = (document.getElementById('template-id') || {}).value;
        const name = (document.getElementById('template-name') || {}).value || 'Без названия';
        const isActive = (document.getElementById('template-active') || { checked: true }).checked;
        const content = templateEditorInstance.getHTML() || '';
        const rec = { name, content, is_active: isActive, placeholders: PLACEHOLDERS };
        try {
            let resp;
            if (id) resp = await supabase.from('contract_templates').update(rec).eq('id', id).select('id').single();
            else resp = await supabase.from('contract_templates').insert([rec]).select('id').single();
            if (resp.error) throw resp.error;
            document.getElementById('template-id').value = resp.data?.id || id || '';
            await loadTemplates();
            alert('Шаблон сохранён');
        } catch (err) {
            alert('Ошибка сохранения шаблона: ' + err.message);
        }
    }

    function newTemplate() {
        (document.getElementById('template-id') || {}).value = '';
        (document.getElementById('template-name') || {}).value = '';
        (document.getElementById('template-active') || {}).checked = true;
        if (templateEditor) templateEditor.innerHTML = '';
    }

    if (editorToolbar) editorToolbar.addEventListener('click', toolbarAction);
    document.getElementById('templates-table')?.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.template-edit-btn');
        const delBtn = e.target.closest('.template-delete-btn');
        if (editBtn) {
            const id = editBtn.dataset.id;
            const { data, error } = await supabase.from('contract_templates').select('*').eq('id', id).single();
            if (!error && data) {
                document.getElementById('template-id').value = data.id;
                document.getElementById('template-name').value = data.name;
                document.getElementById('template-active').checked = !!data.is_active;
                if (templateEditor) templateEditor.innerHTML = data.content || '';
            }
        }
        if (delBtn) {
            const id = delBtn.dataset.id;
            if (!confirm('Удалить шаблон?')) return;
            const { error } = await supabase.from('contract_templates').delete().eq('id', id);
            if (error) alert('Ошибка удаления: ' + error.message);
            await loadTemplates();
        }
    });
    if (templateSaveBtn) templateSaveBtn.addEventListener('click', saveTemplate);
    if (templateNewBtn) templateNewBtn.addEventListener('click', newTemplate);

    // Попробуем заранее загрузить шаблоны (для выпадающего списка у тарифов)
    loadTemplates().catch(() => { });

    // --- НОВЫЙ БЛОК: Логика предпросмотра тарифов как у клиента ---

    // Глобальные переменные для предпросмотра
    const clientViewTariffListModal = document.getElementById('client-view-tariff-list-modal');
    const clientViewTariffDetailModal = document.getElementById('client-view-tariff-detail-modal');
    let tariffDataForPreview = {}; // Здесь будем хранить данные всех тарифов

    // Функция, которая запускает весь процесс предпросмотра
    async function showClientTariffPreview(targetTariffId = null) {
        // 1. Загружаем все активные тарифы
        try {
            const { data, error } = await supabase.from('tariffs').select('*').eq('is_active', true).order('id');
            if (error) throw error;

            tariffDataForPreview = {}; // Очищаем старые данные
            data.forEach(t => {
                const key = t.slug || `tariff-${t.id}`;
                tariffDataForPreview[key] = {
                    ...t,
                    // Парсим extensions, т.к. они могут быть строкой
                    extensions: typeof t.extensions === 'string' ? JSON.parse(t.extensions) : t.extensions,
                };
            });

            // 2. Показываем детальное окно для конкретного тарифа
            const targetTariffKey = Object.keys(tariffDataForPreview).find(key => tariffDataForPreview[key].id == targetTariffId);
            if (targetTariffKey) {
                renderTariffDetailForClientView(targetTariffKey);
            } else {
                alert('Тариф не найден или неактивен.');
            }

        } catch (err) {
            alert('Ошибка загрузки данных для предпросмотра: ' + err.message);
        }
    }

    // Функция для отрисовки детального окна тарифа
    function renderTariffDetailForClientView(tariffKey) {
        const t = tariffDataForPreview[tariffKey];
        if (!t) return;

        // Заполняем элементы модального окна
        document.getElementById('client-view-tariff-detail-title').textContent = t.title;
        document.getElementById('client-view-tariff-detail-description').textContent = t.description || '';
        const optionsContainer = document.getElementById('client-view-tariff-options-list');
        optionsContainer.innerHTML = '';

        const extensions = (t.extensions && Array.isArray(t.extensions) && t.extensions.length > 0)
            ? t.extensions
            : [{ days: t.duration_days, price_rub: t.price_rub }];

        extensions.forEach((ext, idx) => {
            const isSelectedClass = (idx === 0) ? ' selected' : '';
            const optionHTML = `
                <label class="tariff-option-item${isSelectedClass}">
                    <input type="radio" name="client-view-tariff-option" value="${idx}" ${idx === 0 ? 'checked' : ''}>
                    <div class="option-details">
                        <span class="option-duration">${ext.days} дней</span>
                    </div>
                    <span class="option-price">${ext.price_rub || ext.cost || 0} ₽</span>
                </label>
            `;
            optionsContainer.insertAdjacentHTML('beforeend', optionHTML);
        });

        // Добавляем интерактивность для выбора (хотя она тут не нужна для логики, но для вида)
        optionsContainer.querySelectorAll('.tariff-option-item').forEach(label => {
            label.addEventListener('click', () => {
                optionsContainer.querySelectorAll('.tariff-option-item').forEach(el => el.classList.remove('selected'));
                label.classList.add('selected');
                label.querySelector('input').checked = true;
            });
        });

        clientViewTariffDetailModal.classList.remove('hidden');
    }

    // Обработчики закрытия модальных окон
    document.getElementById('client-view-tariff-list-close-btn')?.addEventListener('click', () => {
        clientViewTariffListModal.classList.add('hidden');
    });
    clientViewTariffListModal?.addEventListener('click', (e) => {
        if (e.target === clientViewTariffListModal) clientViewTariffListModal.classList.add('hidden');
    });

    document.getElementById('client-view-tariff-detail-close-btn')?.addEventListener('click', () => {
        clientViewTariffDetailModal.classList.add('hidden');
    });
    clientViewTariffDetailModal?.addEventListener('click', (e) => {
        if (e.target === clientViewTariffDetailModal) clientViewTariffDetailModal.classList.add('hidden');
    });

    // --- НОВЫЙ БЛОК: Логика настройки стоимости бронирования ---

    // Загрузка текущей стоимости бронирования
    async function loadBookingCost() {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'booking_cost_rub')
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            const currentCost = data ? parseFloat(data.value) : 0;
            if (bookingCostInput) {
                bookingCostInput.value = currentCost;
            }
        } catch (err) {
            console.error('Ошибка загрузки стоимости бронирования:', err);
            if (bookingCostInput) {
                bookingCostInput.value = 0;
            }
        }
    }

    // Сохранение стоимости бронирования
    async function saveBookingCost() {
        const cost = parseFloat(bookingCostInput.value);
        if (isNaN(cost) || cost < 0) {
            alert('Пожалуйста, введите корректную стоимость (неотрицательное число).');
            return;
        }

        toggleButtonLoading(bookingCostSaveBtn, true, 'Сохранить', 'Сохранение...');

        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'booking_cost_rub',
                    value: cost.toString()
                });

            if (error) throw error;

            alert('Стоимость бронирования успешно сохранена.');
            bookingCostModal.classList.add('hidden');

        } catch (err) {
            alert('Ошибка сохранения стоимости бронирования: ' + err.message);
        } finally {
            toggleButtonLoading(bookingCostSaveBtn, false, 'Сохранить', 'Сохранение...');
        }
    }

    // Обработчики событий для модального окна стоимости бронирования
    if (setupBookingCostBtn) {
        setupBookingCostBtn.addEventListener('click', () => {
            loadBookingCost();
            bookingCostModal.classList.remove('hidden');
        });
    }

    if (bookingCostCancelBtn) {
        bookingCostCancelBtn.addEventListener('click', () => {
            bookingCostModal.classList.add('hidden');
        });
    }

    if (bookingCostModal) {
        bookingCostModal.addEventListener('click', (e) => {
            if (e.target === bookingCostModal) {
                bookingCostModal.classList.add('hidden');
            }
        });
    }

    if (bookingCostSaveBtn) {
        bookingCostSaveBtn.addEventListener('click', saveBookingCost);
    }

});
