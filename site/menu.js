// Общий скрипт для главного меню GoGoBike и динамической подгрузки тарифов.
//
// Этот файл не использует внешние фреймворки и подключается на всех
// страницах. При загрузке он проверяет выбранного провайдера (qr
// или GoGoBike) и автоматически открывает меню на главной
// странице, если выбран GoGoBike. В меню предусмотрены кнопки для
// навигации, открытия существующих модальных окон и демонстрации
// незавершённых функций. Дополнительно имеется поддержка загрузки
// тарифов из базы Supabase: чтобы включить динамическую загрузку,
// сохраните URL проекта и публичный anon key в localStorage под
// ключами `supabaseUrl` и `supabaseAnonKey`.

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('main-menu-overlay');
    // На страницах, где нет меню (например, старт и регистрация), ничего не делаем
    if (!overlay) return;

    const closeBtn = document.getElementById('main-menu-close-btn');
    const tariffBtn = document.getElementById('menu-tariffs-btn');
    const myRentalsBtn = document.getElementById('menu-my-rentals-btn');
    const topupBtn = document.getElementById('menu-topup-btn');
    const mapBtn = document.getElementById('menu-map-btn');
    const statsBtn = document.getElementById('menu-stats-btn');
    const profileBtn = document.getElementById('menu-profile-btn');
    const supportBtn = document.getElementById('menu-support-btn');

    function openMenu() {
        overlay.classList.remove('hidden');
        // Блокируем прокрутку фона
        document.body.style.overflow = 'hidden';
        // Фокусируем первую кнопку для доступности
        const first = overlay.querySelector('.menu-item-btn');
        if (first) first.focus();
    }

    function closeMenu() {
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeMenu);
    }
    // Закрытие по Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
            closeMenu();
        }
    });

    // Автооткрытие на главной. Ранее для GoGoBike меню открывалось автоматически,
    // но сейчас у нас есть собственный интерфейс и меню не требуется.
    // Если вам всё‑таки нужно открывать меню на старых провайдерах, измените условие ниже.
    const provider = localStorage.getItem('paymentProvider');
    const pathname = window.location.pathname;
    const isIndex = pathname.endsWith('index.html') || pathname === '/' || pathname === '';
    // Открываем старое меню только если явно выбран QR‑провайдер и мы на главной.
    if (provider && provider !== 'GoGoBike' && isIndex) {
        setTimeout(() => openMenu(), 200);
    }

    // Навигационные действия. Если соответствующие страницы существуют,
    // открываем их; иначе выводим предупреждение.
    if (tariffBtn) {
        tariffBtn.addEventListener('click', () => {
            // Открываем существующее модальное окно с тарифами
            const modal = document.getElementById('tariff-modal');
            if (modal) {
                modal.classList.remove('hidden');
            }
            closeMenu();
        });
    }
    if (myRentalsBtn) {
        myRentalsBtn.addEventListener('click', () => {
            // В данной сборке страница «Мои аренды» не реализована
            alert('Список ваших аренд будет доступен в следующих версиях.');
            closeMenu();
        });
    }
    if (topupBtn) {
        topupBtn.addEventListener('click', () => {
            const modal = document.getElementById('topup-modal');
            if (modal) {
                modal.classList.remove('hidden');
            } else {
                alert('Форма пополнения будет доступна на главной странице.');
            }
            closeMenu();
        });
    }
    if (mapBtn) {
        mapBtn.addEventListener('click', () => {
            window.location.href = 'map.html';
        });
    }
    if (statsBtn) {
        statsBtn.addEventListener('click', () => {
            window.location.href = 'stats.html';
        });
    }
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }
    if (supportBtn) {
        supportBtn.addEventListener('click', () => {
            let handled = false;
            if (window.SupportChat && typeof window.SupportChat.open === 'function') {
                window.SupportChat.open();
                handled = true;
            }
            if (!handled) {
                const chatModal = document.getElementById('support-modal') || document.getElementById('help-modal') || document.querySelector('.chat-modal');
                if (chatModal) {
                    chatModal.classList.remove('hidden');
                    handled = true;
                }
            }
            if (!handled) {
                alert('Сервис поддержки недоступен в данный момент.');
            }
            closeMenu();
        });
    }


});
