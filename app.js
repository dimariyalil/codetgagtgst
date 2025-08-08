/**
 * TG Traffic Master - Основная логика приложения
 * Управление интерфейсом, вкладками, модальными окнами и взаимодействием с пользователем
 */

class TGTrafficMaster {
    constructor() {
        this.currentTab = 'evaluation';
        this.analysisResults = [];
        this.currentProject = null;
        this.analysisInProgress = false;

        this.init();
    }

    /**
     * Инициализация приложения
     */
    init() {
        this.bindEvents();
        this.loadSavedProjects();
        this.showTab('evaluation');

        // Проверяем API ключ при загрузке
        this.checkApiKey();

        console.log('TG Traffic Master инициализирован');
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        // Вкладки
        document.getElementById('evaluation-tab').addEventListener('click', () => this.showTab('evaluation'));
        document.getElementById('work-tab').addEventListener('click', () => this.showTab('work'));

        // Кнопки анализа
        document.getElementById('analyze-btn').addEventListener('click', () => this.startAnalysis());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearResults());

        // Экспорт и сохранение
        document.getElementById('excel-btn').addEventListener('click', () => this.exportToExcel());
        document.getElementById('save-project-btn').addEventListener('click', () => this.showSaveProjectModal());

        // Модальные окна
        document.getElementById('cancel-save-btn').addEventListener('click', () => this.hideSaveProjectModal());
        document.getElementById('confirm-save-btn').addEventListener('click', () => this.saveProject());
        document.getElementById('cancel-cpm-btn').addEventListener('click', () => this.hideRealCpmModal());
        document.getElementById('confirm-cpm-btn').addEventListener('click', () => this.saveRealCpm());

        // Новая кампания
        document.getElementById('new-campaign-btn').addEventListener('click', () => this.createNewCampaign());

        // Закрытие модальных окон по клику вне их
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('fixed')) {
                this.hideAllModals();
            }
        });

        // Обработка Enter в формах
        document.getElementById('project-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveProject();
        });

        document.getElementById('real-cpm-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveRealCpm();
        });
    }

    /**
     * Переключение вкладок
     */
    showTab(tabName) {
        // Обновляем кнопки
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active', 'border-indigo-500', 'text-indigo-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });

        document.getElementById(tabName + '-tab').classList.add('active', 'border-indigo-500', 'text-indigo-600');
        document.getElementById(tabName + '-tab').classList.remove('border-transparent', 'text-gray-500');

        // Показываем контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        document.getElementById(tabName + '-section').classList.remove('hidden');
        document.getElementById(tabName + '-section').classList.add('fade-in');

        this.currentTab = tabName;

        // Обновляем данные для текущей вкладки
        if (tabName === 'work') {
            this.loadCampaigns();
        }
    }

    /**
     * Начало анализа каналов
     */
    async startAnalysis() {
        const input = document.getElementById('channels-input').value.trim();

        if (!input) {
            this.showNotification('Введите ссылки на каналы для анализа', 'warning');
            return;
        }

        // Проверяем API ключ
        if (!window.TGStatAPI || !window.TGStatAPI.hasValidToken()) {
            this.showNotification('API ключ TGStat не настроен. Проверьте настройки.', 'error');
            return;
        }

        const channels = this.parseChannelInput(input);

        if (channels.length === 0) {
            this.showNotification('Не найдено валидных ссылок на каналы', 'error');
            return;
        }

        this.analysisInProgress = true;
        this.showLoading();
        this.toggleAnalysisButtons(false);

        try {
            this.showNotification(\`Начинаем анализ \${channels.length} каналов...\`, 'info');

            const results = await this.analyzeChannels(channels);
            this.displayResults(results);

            this.showNotification(\`Анализ завершен! Обработано \${results.length} каналов\`, 'success');

        } catch (error) {
            console.error('Ошибка анализа:', error);
            this.showNotification('Произошла ошибка при анализе каналов: ' + error.message, 'error');
        } finally {
            this.analysisInProgress = false;
            this.hideLoading();
            this.toggleAnalysisButtons(true);
        }
    }

    /**
     * Парсинг введенных каналов
     */
    parseChannelInput(input) {
        const lines = input.split('\n').map(line => line.trim()).filter(line => line);
        const channels = [];

        lines.forEach(line => {
            // Разделяем по запятым если в строке несколько каналов
            const parts = line.split(',').map(part => part.trim()).filter(part => part);
            channels.push(...parts);
        });

        // Валидация и нормализация ссылок
        const validChannels = [];
        channels.forEach(channel => {
            const normalized = this.normalizeChannelUrl(channel);
            if (normalized) {
                validChannels.push(normalized);
            }
        });

        // Убираем дубликаты
        return [...new Set(validChannels)];
    }

    /**
     * Нормализация URL канала
     */
    normalizeChannelUrl(url) {
        // Удаляем пробелы
        url = url.trim();

        if (!url) return null;

        // Если начинается с @, оставляем как есть
        if (url.startsWith('@')) {
            return url;
        }

        // Если это полная ссылка t.me
        if (url.includes('t.me/')) {
            const match = url.match(/t\.me\/([a-zA-Z0-9_]+)/);
            return match ? '@' + match[1] : null;
        }

        // Если это приглашение t.me/+
        if (url.includes('t.me/+')) {
            return url; // Возвращаем как есть для приглашений
        }

        // Если это просто имя канала без @
        if (/^[a-zA-Z0-9_]+$/.test(url)) {
            return '@' + url;
        }

        return null;
    }

    /**
     * Анализ каналов через API
     */
    async analyzeChannels(channels) {
        const results = [];
        const batchSize = 3; // Анализируем по 3 канала одновременно

        for (let i = 0; i < channels.length; i += batchSize) {
            const batch = channels.slice(i, i + batchSize);
            const batchPromises = batch.map(channel => this.analyzeChannel(channel));

            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    console.error(\`Ошибка анализа канала \${batch[index]}:\`, result.reason);
                    results.push({
                        channel: batch[index],
                        error: result.reason.message || 'Неизвестная ошибка',
                        status: 'error'
                    });
                }
            });

            // Небольшая пауза между батчами
            if (i + batchSize < channels.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        this.analysisResults = results;
        return results;
    }

    /**
     * Анализ отдельного канала
     */
    async analyzeChannel(channelUrl) {
        try {
            // Получаем основные данные канала
            const channelData = await window.TGStatAPI.getChannelInfo(channelUrl);
            const channelStats = await window.TGStatAPI.getChannelStats(channelUrl);

            // Рассчитываем метрики
            const metrics = window.Analytics.calculateMetrics(channelData, channelStats);

            return {
                channel: channelUrl,
                title: channelData.title || channelUrl,
                username: channelData.username || channelUrl,
                subscribers: channelData.participantsCount || 0,
                avgReach: channelStats.avgReach || 0,
                er: metrics.engagementRate || 0,
                quality: metrics.qualityScore || 0,
                cpmForecast: metrics.cpmForecast || 0,
                citationIndex: channelStats.citationIndex || 0,
                mentions: channelStats.mentionsCount || 0,
                reposts: channelStats.repostsCount || 0,
                posts: channelStats.postsCount || 0,
                err24h: channelStats.err24h || 0,
                category: channelData.category || 'Не определено',
                status: this.determineChannelStatus(metrics),
                rawData: { channelData, channelStats, metrics },
                analyzedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(\`Ошибка анализа канала \${channelUrl}:\`, error);

            return {
                channel: channelUrl,
                error: error.message,
                status: 'error',
                analyzedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Определение статуса канала
     */
    determineChannelStatus(metrics) {
        const { qualityScore, engagementRate, botScore } = metrics;

        if (botScore > 50) return 'Подозрение на боты';
        if (qualityScore >= 80) return 'Отлично';
        if (qualityScore >= 60) return 'Хорошо';
        if (qualityScore >= 40) return 'Средне';
        if (qualityScore >= 20) return 'Плохо';
        return 'Недоступен';
    }

    /**
     * Отображение результатов
     */
    displayResults(results) {
        const tbody = document.getElementById('results-table-body');
        tbody.innerHTML = '';

        results.forEach(result => {
            const row = this.createResultRow(result);
            tbody.appendChild(row);
        });

        document.getElementById('results-count').textContent = \`Анализ: \${results.length} каналов\`;
        document.getElementById('results-section').classList.remove('hidden');
        document.getElementById('results-section').classList.add('fade-in');
    }

    /**
     * Создание строки таблицы результатов
     */
    createResultRow(result) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        if (result.error) {
            row.innerHTML = \`
                <td class="px-6 py-4">
                    <div class="channel-cell">
                        <span class="channel-name text-red-600">\${result.channel}</span>
                        <span class="channel-username text-red-500">Ошибка</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-gray-400" colspan="12">
                    \${result.error}
                </td>
                <td class="px-6 py-4">
                    <span class="quality-badge status-error">Ошибка</span>
                </td>
            \`;
            return row;
        }

        row.innerHTML = \`
            <td class="px-6 py-4">
                <div class="channel-cell">
                    <span class="channel-name">\${result.title}</span>
                    <span class="channel-username">\${result.username}</span>
                </div>
            </td>
            <td class="px-6 py-4 metric-value">\${this.formatNumber(result.subscribers)}</td>
            <td class="px-6 py-4 metric-value">\${this.formatNumber(result.avgReach)}</td>
            <td class="px-6 py-4 metric-value">\${result.er.toFixed(2)}%</td>
            <td class="px-6 py-4">
                <span class="quality-badge \${this.getQualityClass(result.quality)}">\${result.quality}/100</span>
            </td>
            <td class="px-6 py-4 metric-value">\${result.cpmForecast.toFixed(2)} ₽</td>
            <td class="px-6 py-4 metric-value">\${result.citationIndex}</td>
            <td class="px-6 py-4 metric-value">\${this.formatNumber(result.mentions)}</td>
            <td class="px-6 py-4 metric-value">\${this.formatNumber(result.reposts)}</td>
            <td class="px-6 py-4 metric-value">\${this.formatNumber(result.posts)}</td>
            <td class="px-6 py-4 metric-value">\${result.err24h.toFixed(2)}%</td>
            <td class="px-6 py-4">\${result.category}</td>
            <td class="px-6 py-4">
                <span class="quality-badge \${this.getStatusClass(result.status)}">\${result.status}</span>
            </td>
            <td class="px-6 py-4">
                <div class="flex gap-1">
                    <button class="action-btn action-btn-success" onclick="app.showRealCpmModal('\${result.channel}', \${result.cpmForecast})" title="Реальный CPM">
                        <i class="fas fa-ruble-sign"></i>
                    </button>
                    <button class="action-btn action-btn-primary" onclick="app.showChannelDetails('\${result.channel}')" title="Подробнее">
                        <i class="fas fa-info"></i>
                    </button>
                </div>
            </td>
        \`;

        return row;
    }

    /**
     * Показать модальное окно реального CPM
     */
    showRealCpmModal(channel, predictedCpm) {
        this.currentChannel = channel;
        document.getElementById('predicted-cpm-display').textContent = predictedCpm.toFixed(2) + ' ₽';
        document.getElementById('real-cpm-input').value = '';
        document.getElementById('real-cpm-modal').classList.remove('hidden');
    }

    /**
     * Скрыть модальное окно реального CPM
     */
    hideRealCpmModal() {
        document.getElementById('real-cpm-modal').classList.add('hidden');
        this.currentChannel = null;
    }

    /**
     * Сохранить реальный CPM
     */
    saveRealCpm() {
        const realCpm = parseFloat(document.getElementById('real-cpm-input').value);

        if (isNaN(realCpm) || realCpm < 0) {
            this.showNotification('Введите корректное значение CPM', 'warning');
            return;
        }

        // Находим результат и обновляем
        const result = this.analysisResults.find(r => r.channel === this.currentChannel);
        if (result) {
            result.realCpm = realCpm;
            result.cpmDeviation = ((realCpm - result.cpmForecast) / result.cpmForecast * 100).toFixed(1);

            // Обновляем отображение
            this.displayResults(this.analysisResults);

            this.showNotification(\`Реальный CPM сохранен: \${realCpm} ₽ (отклонение: \${result.cpmDeviation}%)\`, 'success');
        }

        this.hideRealCpmModal();
    }

    /**
     * Показать детали канала
     */
    showChannelDetails(channel) {
        const result = this.analysisResults.find(r => r.channel === channel);
        if (!result || result.error) {
            this.showNotification('Данные канала недоступны', 'warning');
            return;
        }

        // Здесь можно добавить модальное окно с детальной информацией
        console.log('Детали канала:', result);
        this.showNotification('Детальный просмотр будет добавлен в следующих версиях', 'info');
    }

    /**
     * Очистка результатов
     */
    clearResults() {
        if (this.analysisInProgress) {
            this.showNotification('Дождитесь завершения анализа', 'warning');
            return;
        }

        document.getElementById('channels-input').value = '';
        document.getElementById('results-section').classList.add('hidden');
        document.getElementById('results-table-body').innerHTML = '';
        this.analysisResults = [];

        this.showNotification('Результаты очищены', 'info');
    }

    /**
     * Экспорт в Excel
     */
    exportToExcel() {
        if (this.analysisResults.length === 0) {
            this.showNotification('Нет данных для экспорта', 'warning');
            return;
        }

        try {
            const data = this.analysisResults.map(result => ({
                'Канал': result.title || result.channel,
                'Username': result.username || result.channel,
                'Подписчики': result.subscribers || 0,
                'Средний охват': result.avgReach || 0,
                'ER %': result.er || 0,
                'Качество': result.quality || 0,
                'Прогноз CPM': result.cpmForecast || 0,
                'Реальный CPM': result.realCpm || '',
                'Отклонение %': result.cpmDeviation || '',
                'ИЦ': result.citationIndex || 0,
                'Упоминания': result.mentions || 0,
                'Репосты': result.reposts || 0,
                'Посты': result.posts || 0,
                'ERR 24h': result.err24h || 0,
                'Категория': result.category || '',
                'Статус': result.status || '',
                'Дата анализа': new Date(result.analyzedAt).toLocaleString('ru-RU')
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Анализ каналов');

            const fileName = \`TG_Traffic_Master_Анализ_\${new Date().toISOString().slice(0, 10)}.xlsx\`;
            XLSX.writeFile(wb, fileName);

            this.showNotification(\`Файл \${fileName} скачан\`, 'success');

        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка при экспорте данных', 'error');
        }
    }

    /**
     * Показать модальное окно сохранения проекта
     */
    showSaveProjectModal() {
        if (this.analysisResults.length === 0) {
            this.showNotification('Нет данных для сохранения', 'warning');
            return;
        }

        document.getElementById('project-name-input').value = \`Проект \${new Date().toLocaleDateString('ru-RU')}\`;
        document.getElementById('save-project-modal').classList.remove('hidden');
    }

    /**
     * Скрыть модальное окно сохранения проекта
     */
    hideSaveProjectModal() {
        document.getElementById('save-project-modal').classList.add('hidden');
    }

    /**
     * Сохранить проект
     */
    saveProject() {
        const projectName = document.getElementById('project-name-input').value.trim();

        if (!projectName) {
            this.showNotification('Введите название проекта', 'warning');
            return;
        }

        if (this.analysisResults.length === 0) {
            this.showNotification('Нет данных для сохранения', 'warning');
            return;
        }

        const project = {
            id: Date.now().toString(),
            name: projectName,
            channels: this.analysisResults,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            window.Storage.saveProject(project);
            this.showNotification(\`Проект "\${projectName}" сохранен\`, 'success');
            this.hideSaveProjectModal();

            // Переходим в раздел "В работе"
            setTimeout(() => {
                this.showTab('work');
            }, 1000);

        } catch (error) {
            console.error('Ошибка сохранения проекта:', error);
            this.showNotification('Ошибка при сохранении проекта', 'error');
        }
    }

    /**
     * Загрузить сохраненные проекты
     */
    loadSavedProjects() {
        try {
            this.savedProjects = window.Storage.getProjects();
        } catch (error) {
            console.error('Ошибка загрузки проектов:', error);
            this.savedProjects = [];
        }
    }

    /**
     * Загрузить кампании в раздел "В работе"
     */
    loadCampaigns() {
        const campaignsList = document.getElementById('campaigns-list');
        const noCampaigns = document.getElementById('no-campaigns');

        this.loadSavedProjects();

        if (this.savedProjects.length === 0) {
            noCampaigns.classList.remove('hidden');
            return;
        }

        noCampaigns.classList.add('hidden');

        // Создаем карточки кампаний
        const campaignsHtml = this.savedProjects.map(project => this.createCampaignCard(project)).join('');
        campaignsList.innerHTML = campaignsHtml;
    }

    /**
     * Создать карточку кампании
     */
    createCampaignCard(project) {
        const channelsCount = project.channels.length;
        const avgQuality = project.channels.reduce((sum, ch) => sum + (ch.quality || 0), 0) / channelsCount;
        const totalReach = project.channels.reduce((sum, ch) => sum + (ch.avgReach || 0), 0);

        return \`
            <div class="campaign-card">
                <div class="campaign-title">\${project.name}</div>
                <div class="campaign-meta">
                    <span><i class="fas fa-calendar mr-1"></i>\${new Date(project.createdAt).toLocaleDateString('ru-RU')}</span>
                    <span><i class="fas fa-chart-bar mr-1"></i>\${channelsCount} каналов</span>
                </div>
                <div class="campaign-stats">
                    <div class="campaign-stat">
                        <div class="campaign-stat-value">\${channelsCount}</div>
                        <div class="campaign-stat-label">Каналов</div>
                    </div>
                    <div class="campaign-stat">
                        <div class="campaign-stat-value">\${avgQuality.toFixed(0)}</div>
                        <div class="campaign-stat-label">Ср. качество</div>
                    </div>
                    <div class="campaign-stat">
                        <div class="campaign-stat-value">\${this.formatNumber(totalReach)}</div>
                        <div class="campaign-stat-label">Общий охват</div>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <button class="action-btn action-btn-primary" onclick="app.openProject('\${project.id}')">
                        <i class="fas fa-eye mr-1"></i> Открыть
                    </button>
                    <button class="action-btn action-btn-warning" onclick="app.deleteProject('\${project.id}')">
                        <i class="fas fa-trash mr-1"></i> Удалить
                    </button>
                </div>
            </div>
        \`;
    }

    /**
     * Открыть сохраненный проект
     */
    openProject(projectId) {
        const project = this.savedProjects.find(p => p.id === projectId);
        if (!project) {
            this.showNotification('Проект не найден', 'error');
            return;
        }

        // Загружаем данные проекта
        this.analysisResults = project.channels;
        this.currentProject = project;

        // Переходим в раздел "Оценка" и показываем результаты
        this.showTab('evaluation');
        this.displayResults(project.channels);

        this.showNotification(\`Проект "\${project.name}" загружен\`, 'success');
    }

    /**
     * Удалить проект
     */
    deleteProject(projectId) {
        if (!confirm('Вы уверены, что хотите удалить этот проект?')) {
            return;
        }

        try {
            window.Storage.deleteProject(projectId);
            this.loadCampaigns();
            this.showNotification('Проект удален', 'success');
        } catch (error) {
            console.error('Ошибка удаления проекта:', error);
            this.showNotification('Ошибка при удалении проекта', 'error');
        }
    }

    /**
     * Создать новую кампанию
     */
    createNewCampaign() {
        this.showTab('evaluation');
        this.clearResults();
        this.showNotification('Создайте новый анализ в разделе "Оценка"', 'info');
    }

    /**
     * Проверить API ключ
     */
    checkApiKey() {
        if (!window.TGStatAPI || !window.TGStatAPI.hasValidToken()) {
            console.warn('API ключ TGStat не настроен');
            // Можно показать уведомление или модальное окно настройки
        }
    }

    /**
     * Показать индикатор загрузки
     */
    showLoading() {
        document.getElementById('loading-indicator').classList.remove('hidden');
    }

    /**
     * Скрыть индикатор загрузки
     */
    hideLoading() {
        document.getElementById('loading-indicator').classList.add('hidden');
    }

    /**
     * Переключить кнопки анализа
     */
    toggleAnalysisButtons(enabled) {
        const analyzeBtn = document.getElementById('analyze-btn');
        const clearBtn = document.getElementById('clear-btn');

        if (enabled) {
            analyzeBtn.disabled = false;
            analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            clearBtn.disabled = false;
            clearBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            analyzeBtn.disabled = true;
            analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
            clearBtn.disabled = true;
            clearBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    /**
     * Скрыть все модальные окна
     */
    hideAllModals() {
        document.getElementById('save-project-modal').classList.add('hidden');
        document.getElementById('real-cpm-modal').classList.add('hidden');
    }

    /**
     * Форматирование чисел
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '-';
        return new Intl.NumberFormat('ru-RU').format(num);
    }

    /**
     * Получить класс для качества
     */
    getQualityClass(quality) {
        if (quality >= 80) return 'quality-excellent';
        if (quality >= 60) return 'quality-good';
        if (quality >= 40) return 'quality-average';
        return 'quality-poor';
    }

    /**
     * Получить класс для статуса
     */
    getStatusClass(status) {
        switch (status) {
            case 'Отлично': return 'status-excellent';
            case 'Хорошо': return 'status-good';
            case 'Средне': return 'status-average';
            case 'Плохо': return 'status-poor';
            case 'Недоступен': return 'status-unavailable';
            default: return 'status-error';
        }
    }

    /**
     * Показать уведомление
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = \`notification notification-\${type}\`;
        notification.innerHTML = \`
            <i class="fas \${this.getNotificationIcon(type)} mr-2"></i>
            \${message}
        \`;

        document.body.appendChild(notification);

        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Клик для скрытия
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    /**
     * Получить иконку для уведомления
     */
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-times-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }
}

// Инициализация приложения при загрузке страницы
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TGTrafficMaster();
});