// Phone mask function
function formatPhone(value) {
    const cleaned = value.replace(/\D/g, '');
    let formatted = '';
    if (cleaned.length > 0) {
        formatted = '+7';
        if (cleaned.length > 1) {
            formatted += ' (' + cleaned.substring(1, 4);
            if (cleaned.length >= 5) {
                formatted += ') ' + cleaned.substring(4, 7);
                if (cleaned.length >= 8) {
                    formatted += '-' + cleaned.substring(7, 9);
                    if (cleaned.length >= 10) {
                        formatted += '-' + cleaned.substring(9, 11);
                    }
                }
            }
        }
    }
    return formatted;
}

// Setup phone inputs
function setupPhoneInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', (e) => {
        const newValue = formatPhone(e.target.value);
        e.target.value = newValue;
    });

    input.addEventListener('focus', () => {
        if (!input.value) {
            input.value = '+7 ';
        }
    });
}

setupPhoneInput('login-phone');
setupPhoneInput('reg-phone');

// File upload UI
function setupFileInput(inputId, labelId, infoId) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    const info = document.getElementById(infoId);

    if (!input || !label || !info) return;

    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            label.classList.add('has-file');
            info.classList.add('has-file');
            info.querySelector('.hint').textContent = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
        } else {
            label.classList.remove('has-file');
            info.classList.remove('has-file');
            if (inputId === 'passport-main') {
                info.querySelector('.hint').textContent = 'Разворот с фотографией';
            } else {
                info.querySelector('.hint').textContent = 'Регистрация по месту жительства';
            }
        }
    });
}

setupFileInput('passport-main', 'label-main', 'info-main');
setupFileInput('passport-reg', 'label-reg', 'info-reg');

// Check if already logged in
function checkExistingAuth() {
    const userId = localStorage.getItem('userId');
    const isRegistered = localStorage.getItem('isRegistered');

    if (userId && isRegistered === 'true') {
        console.log('[Auth] Already logged in, redirecting to index');
        window.location.href = 'index.html';
        return true;
    }
    return false;
}

// Check on page load
checkExistingAuth();

// Registration data
let registrationData = {
    phone: '',
    city: '',
    checkId: '',
    mode: '', // 'login' or 'register'
    citizenship: '', // 'ru', 'by', 'kz', 'other'
    country: '' // Name of country if citizenship is 'other'
};

// Show step function
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
}

// Error/Success messages
function showError(stepId, message) {
    const errorEl = document.getElementById(`error-${stepId}`);
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('active');
    setTimeout(() => errorEl.classList.remove('active'), 5000);
}

function showSuccess(stepId, message) {
    const successEl = document.getElementById(`success-${stepId}`);
    if (!successEl) return;
    successEl.textContent = message;
    successEl.classList.add('active');
    setTimeout(() => successEl.classList.remove('active'), 3000);
}

// Step 0: Choice buttons
document.getElementById('btn-login').addEventListener('click', () => {
    registrationData.mode = 'login';
    showStep('step-login-1');
});

document.getElementById('btn-register').addEventListener('click', () => {
    registrationData.mode = 'register';
    showStep('step-reg-1');
    updateProgressDots(1);
});

// Back buttons
document.getElementById('back-to-choice-1').addEventListener('click', () => showStep('step-0'));
document.getElementById('back-to-choice-2').addEventListener('click', () => showStep('step-0'));
document.getElementById('back-to-reg-2').addEventListener('click', () => {
    showStep('step-reg-2');
    updateProgressDots(2);
});
document.getElementById('back-to-reg-3').addEventListener('click', () => {
    showStep('step-reg-3');
    updateProgressDots(3);
});

// LOGIN FLOW
// Step 1: Login phone form
document.getElementById('login-phone-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const phone = document.getElementById('login-phone').value.trim();
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length !== 11) {
        showError('login-1', 'Неверный формат номера');
        return;
    }

    // Check if user exists
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'check-user-exists',
                phone: cleaned
            })
        });

        const data = await response.json();

        if (!data.exists) {
            showError('login-1', 'Пользователь с таким номером не найден. Пожалуйста, зарегистрируйтесь.');
            return;
        }

        registrationData.phone = cleaned;
        showStep('step-login-2');
        await initiateCall(cleaned, 'login');

    } catch (error) {
        console.error('Check user error:', error);
        showError('login-1', 'Ошибка проверки пользователя');
    }
});

// REGISTRATION FLOW
// Step 1: Registration phone and city form
document.getElementById('reg-phone-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const phone = document.getElementById('reg-phone').value.trim();
    const city = document.getElementById('city').value;

    if (!city) {
        showError('reg-1', 'Выберите город');
        return;
    }

    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 11) {
        showError('reg-1', 'Неверный формат номера');
        return;
    }

    registrationData.phone = cleaned;
    registrationData.city = city;

    showStep('step-reg-2');
    await initiateCall(cleaned, 'register');
});

// Call verification
async function initiateCall(phone, mode) {
    try {
        console.log('[Call Init] Sending phone:', phone, 'Mode:', mode);
        const response = await fetch('/api/call-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'initiate', phone })
        });

        const data = await response.json();
        console.log('[Call Init] Response:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Ошибка инициализации звонка');
        }

        registrationData.checkId = data.check_id;

        const prefix = mode === 'login' ? 'login' : 'reg';
        document.getElementById(`${prefix}-call-number`).textContent = data.call_phone_pretty;
        document.getElementById(`${prefix}-call-btn`).href = `tel:${data.call_phone}`;
        document.getElementById(`${prefix}-waiting-call`).classList.add('active');

        startStatusCheck(mode);

    } catch (error) {
        console.error('Call initiation error:', error);
        const stepId = mode === 'login' ? 'login-2' : 'reg-2';
        showError(stepId, error.message);
    }
}

let statusCheckInterval;
function startStatusCheck(mode) {
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/call-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'check-status',
                    check_id: registrationData.checkId
                })
            });

            const data = await response.json();
            console.log('[Call Status]', data);

            if (data.check_status === '401' || data.check_status === 401) {
                clearInterval(statusCheckInterval);

                if (mode === 'login') {
                    // Login: fetch user and redirect
                    await completeLogin();
                } else {
                    // Registration: go to step 3 (citizenship selection)
                    showSuccess('reg-2', 'Номер подтвержден');
                    setTimeout(() => {
                        showStep('step-reg-3');
                        updateProgressDots(3);
                    }, 1500);
                }
            } else if (data.check_status === '402' || data.check_status === 402) {
                clearInterval(statusCheckInterval);
                const stepId = mode === 'login' ? 'login-2' : 'reg-2';
                showError(stepId, 'Время ожидания истекло. Попробуйте еще раз.');
            }

        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 2000);
}

// Complete login after call verification
async function completeLogin() {
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'login-by-phone',
                phone: registrationData.phone
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Ошибка входа');
        }

        // Save to localStorage
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name || 'Пользователь');
        localStorage.setItem('userPhone', data.user.phone);
        localStorage.setItem('isRegistered', 'true');
        localStorage.setItem('authProvider', 'phone');

        showSuccess('login-2', 'Вход выполнен успешно');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);

    } catch (error) {
        console.error('Login error:', error);
        showError('login-2', error.message);
    }
}

// Step 4 (Registration): Documents upload - REMOVED OLD CODE, replaced with new version below

// Progress dots update
function updateProgressDots(currentStep) {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) {
            if (i === currentStep) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        }
    }
}

// Step 3 (Registration): Citizenship selection
const citizenshipOptions = document.querySelectorAll('.citizenship-option');
const citizenshipContinueBtn = document.getElementById('citizenship-continue');
const otherCountryInput = document.getElementById('other-country-input');
const countryNameInput = document.getElementById('country-name');

citizenshipOptions.forEach(option => {
    option.addEventListener('click', () => {
        // Remove selected from all options
        citizenshipOptions.forEach(opt => opt.classList.remove('selected'));

        // Mark this option as selected
        option.classList.add('selected');

        // Store citizenship
        registrationData.citizenship = option.getAttribute('data-country');

        // Show/hide country input for "other"
        if (registrationData.citizenship === 'other') {
            otherCountryInput.style.display = 'block';
            countryNameInput.required = true;
        } else {
            otherCountryInput.style.display = 'none';
            countryNameInput.required = false;
            countryNameInput.value = '';
        }

        // Enable continue button
        citizenshipContinueBtn.disabled = false;
    });
});

citizenshipContinueBtn.addEventListener('click', () => {
    if (!registrationData.citizenship) {
        showError('reg-3', 'Выберите гражданство');
        return;
    }

    // Check if "other" is selected and country name is provided
    if (registrationData.citizenship === 'other') {
        const countryName = countryNameInput.value.trim();
        if (!countryName) {
            showError('reg-3', 'Укажите вашу страну');
            return;
        }
        registrationData.country = countryName;
    }

    showStep('step-reg-4');
    updateProgressDots(4);
    generateDocumentInputs(registrationData.citizenship);
});

// Generate document inputs based on citizenship
function generateDocumentInputs(citizenship) {
    const docsContainer = document.getElementById('docs-container');
    const docsSubtitle = document.getElementById('docs-subtitle');
    const docsInfo = document.getElementById('docs-info');

    let subtitle = '';
    let infoTitle = '';
    let infoText = '';
    let documents = [];

    switch(citizenship) {
        case 'ru':
            subtitle = 'Загрузите фотографии вашего паспорта РФ';
            infoTitle = 'Требуется 2 фотографии';
            infoText = 'Лицевая сторона паспорта с фотографией и страница с регистрацией по месту жительства.';
            documents = [
                { id: 'passport-main', label: 'Лицевая сторона паспорта', hint: 'Разворот с фотографией' },
                { id: 'passport-reg', label: 'Страница с регистрацией', hint: 'Регистрация по месту жительства' }
            ];
            break;
        case 'by':
            subtitle = 'Загрузите фотографии паспорта Республики Беларусь';
            infoTitle = 'Требуется 2 фотографии';
            infoText = 'Лицевая сторона паспорта с фотографией и страница с регистрацией.';
            documents = [
                { id: 'passport-main', label: 'Лицевая сторона паспорта', hint: 'Разворот с фотографией' },
                { id: 'passport-reg', label: 'Страница с регистрацией', hint: 'Регистрация' }
            ];
            break;
        case 'kz':
            subtitle = 'Загрузите фотографии паспорта Республики Казахстан';
            infoTitle = 'Требуется 2 фотографии';
            infoText = 'Лицевая сторона паспорта с фотографией и страница с регистрацией.';
            documents = [
                { id: 'passport-main', label: 'Лицевая сторона паспорта', hint: 'Разворот с фотографией' },
                { id: 'passport-reg', label: 'Страница с регистрацией', hint: 'Регистрация' }
            ];
            break;
        case 'other':
            subtitle = 'Загрузите фотографии документов';
            infoTitle = 'Требуется паспорт и виза/разрешение';
            infoText = 'Лицевая сторона паспорта и виза или разрешение на пребывание в РФ.';
            documents = [
                { id: 'passport-main', label: 'Лицевая сторона паспорта', hint: 'Разворот с фотографией' },
                { id: 'passport-visa', label: 'Виза или разрешение', hint: 'Документ на пребывание в РФ' }
            ];
            break;
    }

    // Update subtitle and info
    docsSubtitle.textContent = subtitle;
    docsInfo.innerHTML = `<span class="title">${infoTitle}</span>${infoText}`;

    // Generate file inputs
    docsContainer.innerHTML = documents.map(doc => `
        <div class="file-upload-wrapper">
            <input type="file" id="${doc.id}" name="${doc.id}" accept="image/*" capture="environment" required>
            <label for="${doc.id}" class="file-upload-label" id="label-${doc.id}">
                <div class="file-upload-info" id="info-${doc.id}">
                    <span class="title">${doc.label}</span>
                    <span class="hint">${doc.hint}</span>
                </div>
                <div class="file-upload-icon">
                    <svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                </div>
            </label>
        </div>
    `).join('');

    // Setup file inputs
    documents.forEach(doc => {
        setupFileInput(doc.id, `label-${doc.id}`, `info-${doc.id}`);
    });
}

// Update Step 4 form submission to include citizenship
const originalFormSubmit = document.getElementById('documents-form');
originalFormSubmit.addEventListener('submit', async (e) => {
    e.preventDefault();

    const passportMain = document.getElementById('passport-main').files[0];
    const passportReg = document.getElementById('passport-reg')?.files[0];
    const passportVisa = document.getElementById('passport-visa')?.files[0];

    if (!passportMain) {
        showError('reg-4', 'Загрузите фотографию паспорта');
        return;
    }

    if (registrationData.citizenship !== 'other' && !passportReg) {
        showError('reg-4', 'Загрузите все необходимые фотографии');
        return;
    }

    if (registrationData.citizenship === 'other' && !passportVisa) {
        showError('reg-4', 'Загрузите визу или разрешение');
        return;
    }

    const finishBtn = document.getElementById('finish-btn');
    finishBtn.disabled = true;
    finishBtn.textContent = 'Загрузка...';

    try {
        const formData = new FormData();
        formData.append('phone', registrationData.phone);
        formData.append('city', registrationData.city);
        formData.append('citizenship', registrationData.citizenship);
        if (registrationData.country) {
            formData.append('country', registrationData.country);
        }
        formData.append('passport_main', passportMain);

        if (passportReg) {
            formData.append('passport_reg', passportReg);
        }

        if (passportVisa) {
            formData.append('passport_visa', passportVisa);
        }

        const response = await fetch('/api/auth', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Ошибка регистрации');
        }

        // Save to localStorage
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name || 'Пользователь');
        localStorage.setItem('userPhone', data.user.phone);
        localStorage.setItem('isRegistered', 'true');
        localStorage.setItem('authProvider', 'phone');

        showSuccess('reg-4', 'Регистрация завершена');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        showError('reg-4', error.message);
        finishBtn.disabled = false;
        finishBtn.textContent = 'Завершить регистрацию';
    }
});

