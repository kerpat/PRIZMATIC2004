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
    mode: '' // 'login' or 'register'
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
});

// Back buttons
document.getElementById('back-to-choice-1').addEventListener('click', () => showStep('step-0'));
document.getElementById('back-to-choice-2').addEventListener('click', () => showStep('step-0'));

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
                    // Registration: go to step 3 (documents)
                    showSuccess('reg-2', 'Номер подтвержден');
                    setTimeout(() => showStep('step-reg-3'), 1500);
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

// Step 3 (Registration): Documents upload
document.getElementById('documents-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const passportMain = document.getElementById('passport-main').files[0];
    const passportReg = document.getElementById('passport-reg').files[0];

    if (!passportMain || !passportReg) {
        showError('reg-3', 'Загрузите обе фотографии');
        return;
    }

    const finishBtn = document.getElementById('finish-btn');
    finishBtn.disabled = true;
    finishBtn.textContent = 'Загрузка...';

    try {
        const formData = new FormData();
        formData.append('phone', registrationData.phone);
        formData.append('city', registrationData.city);
        formData.append('passport_main', passportMain);
        formData.append('passport_reg', passportReg);

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

        showSuccess('reg-3', 'Регистрация завершена');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        showError('reg-3', error.message);
        finishBtn.disabled = false;
        finishBtn.textContent = 'Завершить регистрацию';
    }
});
