/**
 * Loading Skeletons - компоненты-заглушки для плавной загрузки
 * Показываются мгновенно, заменяются на реальные данные по мере загрузки
 */

class LoadingSkeletons {
    /**
     * Скелетон для главной страницы клиента
     */
    static mainPage() {
        return `
            <div class="skeleton-container">
                <div class="bike-image-wrapper">
                    <div class="skeleton-image"></div>
                </div>
                <div class="progress-section">
                    <div class="skeleton-bar"></div>
                    <div class="skeleton-labels">
                        <div class="skeleton-text short"></div>
                        <div class="skeleton-text short"></div>
                    </div>
                </div>
                <div class="skeleton-text large" style="margin: 20px 0;"></div>
                <div class="info-cards">
                    <div class="card skeleton-card">
                        <div class="skeleton-icon"></div>
                        <div>
                            <div class="skeleton-text tiny"></div>
                            <div class="skeleton-text short"></div>
                        </div>
                    </div>
                    <div class="card skeleton-card">
                        <div class="skeleton-icon"></div>
                        <div>
                            <div class="skeleton-text tiny"></div>
                            <div class="skeleton-text short"></div>
                        </div>
                    </div>
                </div>
                <div class="action-buttons">
                    <div class="skeleton-button large"></div>
                    <div class="secondary-actions">
                        <div class="skeleton-button small"></div>
                        <div class="skeleton-button medium"></div>
                        <div class="skeleton-button medium"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Скелетон для таблицы (админка)
     */
    static table(rows = 5, cols = 6) {
        const headerRow = `<tr>${'<th><div class="skeleton-text short"></div></th>'.repeat(cols)}</tr>`;
        const bodyRows = Array(rows).fill(null).map(() =>
            `<tr>${'<td><div class="skeleton-text medium"></div></td>'.repeat(cols)}</tr>`
        ).join('');

        return `
            <table class="skeleton-table">
                <thead>${headerRow}</thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;
    }

    /**
     * Скелетон для дашборда админки
     */
    static dashboard() {
        return `
            <div class="dashboard-grid skeleton-dashboard">
                <div class="dashboard-column">
                    <div class="skeleton-text large"></div>
                    <div class="dashboard-stats-group">
                        ${Array(4).fill(null).map(() => `
                            <div class="stat-card skeleton-stat">
                                <div class="skeleton-icon"></div>
                                <div>
                                    <div class="skeleton-text tiny"></div>
                                    <div class="skeleton-text short"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="dashboard-column-wide">
                    <div class="dashboard-revenue-card skeleton-revenue">
                        <div class="skeleton-text large"></div>
                        <div class="skeleton-text huge"></div>
                        <div class="skeleton-bars">
                            ${Array(3).fill(null).map(() => `
                                <div class="skeleton-bar-item">
                                    <div class="skeleton-text tiny"></div>
                                    <div class="skeleton-text short"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="skeleton-chart"></div>
                </div>
            </div>
        `;
    }

    /**
     * Показать скелетон в контейнере
     */
    static show(container, type, ...args) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        if (!container) return;

        container.innerHTML = this[type]?.(...args) || '<div class="skeleton-text large"></div>';
        container.classList.add('loading');
    }

    /**
     * Скрыть скелетон и показать контент
     */
    static hide(container, content) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        if (!container) return;

        // Плавная анимация замены
        container.style.opacity = '0';
        setTimeout(() => {
            container.innerHTML = content;
            container.classList.remove('loading');
            container.style.opacity = '1';
        }, 200);
    }
}

// CSS для скелетонов
const skeletonStyles = document.createElement('style');
skeletonStyles.textContent = `
    /* Базовая анимация пульсации */
    @keyframes skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .skeleton-container {
        animation: skeleton-pulse 1.5s ease-in-out infinite;
    }

    /* Скелетон-изображение */
    .skeleton-image {
        width: 100%;
        height: 300px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: skeleton-shimmer 1.5s infinite;
        border-radius: 16px;
    }

    @keyframes skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }

    /* Скелетон-текст */
    .skeleton-text {
        height: 16px;
        background: #e0e0e0;
        border-radius: 4px;
        margin: 8px 0;
    }
    .skeleton-text.tiny { width: 40px; }
    .skeleton-text.short { width: 80px; }
    .skeleton-text.medium { width: 120px; }
    .skeleton-text.large { width: 200px; }
    .skeleton-text.huge { width: 100px; height: 40px; }

    /* Скелетон-бар */
    .skeleton-bar {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        margin: 12px 0;
    }

    .skeleton-labels {
        display: flex;
        justify-content: space-between;
        gap: 10px;
    }

    /* Скелетон-карточка */
    .skeleton-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
    }

    .skeleton-icon {
        width: 48px;
        height: 48px;
        background: #e0e0e0;
        border-radius: 50%;
    }

    /* Скелетон-кнопка */
    .skeleton-button {
        height: 48px;
        background: #e0e0e0;
        border-radius: 12px;
        margin: 8px 0;
    }
    .skeleton-button.small { width: 60px; }
    .skeleton-button.medium { width: 120px; }
    .skeleton-button.large { width: 100%; }

    /* Скелетон-таблица */
    .skeleton-table {
        width: 100%;
        border-collapse: collapse;
    }
    .skeleton-table th,
    .skeleton-table td {
        padding: 12px;
        text-align: left;
    }

    /* Скелетон-дашборд */
    .skeleton-stat {
        display: flex;
        gap: 12px;
        padding: 16px;
        background: white;
        border-radius: 12px;
        margin-bottom: 12px;
    }

    .skeleton-revenue {
        padding: 24px;
        background: white;
        border-radius: 16px;
        margin-bottom: 24px;
    }

    .skeleton-bars {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 20px;
    }

    .skeleton-bar-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .skeleton-chart {
        height: 300px;
        background: #f5f5f5;
        border-radius: 16px;
    }

    /* Плавное появление */
    .loading {
        transition: opacity 0.3s ease;
    }
`;

document.head.appendChild(skeletonStyles);

// Экспортируем глобально
window.LoadingSkeletons = LoadingSkeletons;

console.log('[LoadingSkeletons] Initialized ✓');
