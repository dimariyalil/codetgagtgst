/**
 * LocalStorage Data Management Module
 * Handles all data persistence and storage operations
 */

class TGTrafficStorage {
    constructor() {
        this.storageKeys = {
            API_KEY: 'tg_traffic_api_key',
            PROJECTS: 'tg_traffic_projects',
            ANALYSIS_RESULTS: 'tg_traffic_analysis_results',
            USER_SETTINGS: 'tg_traffic_user_settings',
            WORK_CAMPAIGNS: 'tg_traffic_work_campaigns',
            TEMPLATES: 'tg_traffic_templates',
            EXPORT_HISTORY: 'tg_traffic_export_history'
        };

        this.initializeStorage();
    }

    /**
     * Initialize storage with default values if not exists
     */
    initializeStorage() {
        try {
            // Check if projects exist, if not create empty array
            if (!this.getProjects()) {
                this.setProjects([]);
            }

            // Check if user settings exist, if not create defaults
            if (!this.getUserSettings()) {
                this.setUserSettings(this.getDefaultSettings());
            }

            // Check if work campaigns exist, if not create empty array
            if (!this.getWorkCampaigns()) {
                this.setWorkCampaigns([]);
            }

            // Check if templates exist, if not create defaults
            if (!this.getTemplates()) {
                this.setTemplates(this.getDefaultTemplates());
            }

        } catch (error) {
            console.error('Error initializing storage:', error);
        }
    }

    /**
     * Generic localStorage methods with error handling
     */
    setItem(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            localStorage.setItem(key, jsonValue);
            return true;
        } catch (error) {
            console.error(`Error saving to localStorage (${key}):`, error);
            return false;
        }
    }

    getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (error) {
            console.error(`Error reading from localStorage (${key}):`, error);
            return defaultValue;
        }
    }

    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing from localStorage (${key}):`, error);
            return false;
        }
    }

    /**
     * API Key management
     */
    setApiKey(apiKey) {
        return this.setItem(this.storageKeys.API_KEY, apiKey);
    }

    getApiKey() {
        return this.getItem(this.storageKeys.API_KEY, '');
    }

    removeApiKey() {
        return this.removeItem(this.storageKeys.API_KEY);
    }

    /**
     * Projects management
     */
    setProjects(projects) {
        return this.setItem(this.storageKeys.PROJECTS, projects);
    }

    getProjects() {
        return this.getItem(this.storageKeys.PROJECTS, []);
    }

    addProject(project) {
        const projects = this.getProjects();
        const projectWithId = {
            ...project,
            id: project.id || this.generateId(),
            createdAt: project.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        projects.push(projectWithId);
        return this.setProjects(projects) ? projectWithId : null;
    }

    updateProject(projectId, updates) {
        const projects = this.getProjects();
        const index = projects.findIndex(p => p.id === projectId);

        if (index !== -1) {
            projects[index] = {
                ...projects[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            return this.setProjects(projects) ? projects[index] : null;
        }

        return null;
    }

    getProject(projectId) {
        const projects = this.getProjects();
        return projects.find(p => p.id === projectId) || null;
    }

    deleteProject(projectId) {
        const projects = this.getProjects();
        const filteredProjects = projects.filter(p => p.id !== projectId);
        return this.setProjects(filteredProjects);
    }

    searchProjects(query) {
        const projects = this.getProjects();
        const lowercaseQuery = query.toLowerCase();

        return projects.filter(project => 
            project.name.toLowerCase().includes(lowercaseQuery) ||
            project.description?.toLowerCase().includes(lowercaseQuery) ||
            project.channels?.some(channel => 
                channel.username.toLowerCase().includes(lowercaseQuery) ||
                channel.title?.toLowerCase().includes(lowercaseQuery)
            )
        );
    }

    /**
     * Analysis results management
     */
    setAnalysisResults(results) {
        return this.setItem(this.storageKeys.ANALYSIS_RESULTS, results);
    }

    getAnalysisResults() {
        return this.getItem(this.storageKeys.ANALYSIS_RESULTS, []);
    }

    addAnalysisResult(result) {
        const results = this.getAnalysisResults();
        const resultWithId = {
            ...result,
            id: result.id || this.generateId(),
            timestamp: result.timestamp || new Date().toISOString()
        };

        results.unshift(resultWithId); // Add to beginning for chronological order

        // Keep only last 100 results to prevent storage bloat
        if (results.length > 100) {
            results.splice(100);
        }

        return this.setAnalysisResults(results) ? resultWithId : null;
    }

    getAnalysisResult(resultId) {
        const results = this.getAnalysisResults();
        return results.find(r => r.id === resultId) || null;
    }

    deleteAnalysisResult(resultId) {
        const results = this.getAnalysisResults();
        const filteredResults = results.filter(r => r.id !== resultId);
        return this.setAnalysisResults(filteredResults);
    }

    clearAnalysisResults() {
        return this.setAnalysisResults([]);
    }

    /**
     * Work campaigns management (В РАБОТЕ section)
     */
    setWorkCampaigns(campaigns) {
        return this.setItem(this.storageKeys.WORK_CAMPAIGNS, campaigns);
    }

    getWorkCampaigns() {
        return this.getItem(this.storageKeys.WORK_CAMPAIGNS, []);
    }

    addWorkCampaign(campaign) {
        const campaigns = this.getWorkCampaigns();
        const campaignWithId = {
            ...campaign,
            id: campaign.id || this.generateId(),
            createdAt: campaign.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: campaign.status || 'planning'
        };

        campaigns.push(campaignWithId);
        return this.setWorkCampaigns(campaigns) ? campaignWithId : null;
    }

    updateWorkCampaign(campaignId, updates) {
        const campaigns = this.getWorkCampaigns();
        const index = campaigns.findIndex(c => c.id === campaignId);

        if (index !== -1) {
            campaigns[index] = {
                ...campaigns[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            return this.setWorkCampaigns(campaigns) ? campaigns[index] : null;
        }

        return null;
    }

    getWorkCampaign(campaignId) {
        const campaigns = this.getWorkCampaigns();
        return campaigns.find(c => c.id === campaignId) || null;
    }

    deleteWorkCampaign(campaignId) {
        const campaigns = this.getWorkCampaigns();
        const filteredCampaigns = campaigns.filter(c => c.id !== campaignId);
        return this.setWorkCampaigns(filteredCampaigns);
    }

    /**
     * User settings management
     */
    setUserSettings(settings) {
        return this.setItem(this.storageKeys.USER_SETTINGS, settings);
    }

    getUserSettings() {
        return this.getItem(this.storageKeys.USER_SETTINGS, this.getDefaultSettings());
    }

    updateUserSettings(updates) {
        const currentSettings = this.getUserSettings();
        const newSettings = { ...currentSettings, ...updates };
        return this.setUserSettings(newSettings) ? newSettings : null;
    }

    getDefaultSettings() {
        return {
            theme: 'light',
            language: 'ru',
            autoSave: true,
            exportFormat: 'excel',
            defaultCpmRange: { min: 50, max: 500 },
            analysisDepth: 7, // days
            chartType: 'line',
            notificationsEnabled: true,
            rateLimitDelay: 1000,
            maxRetries: 3,
            batchSize: 10
        };
    }

    /**
     * Templates management
     */
    setTemplates(templates) {
        return this.setItem(this.storageKeys.TEMPLATES, templates);
    }

    getTemplates() {
        return this.getItem(this.storageKeys.TEMPLATES, this.getDefaultTemplates());
    }

    addTemplate(template) {
        const templates = this.getTemplates();
        const templateWithId = {
            ...template,
            id: template.id || this.generateId(),
            createdAt: template.createdAt || new Date().toISOString()
        };

        templates.push(templateWithId);
        return this.setTemplates(templates) ? templateWithId : null;
    }

    deleteTemplate(templateId) {
        const templates = this.getTemplates();
        const filteredTemplates = templates.filter(t => t.id !== templateId);
        return this.setTemplates(filteredTemplates);
    }

    getDefaultTemplates() {
        return [
            {
                id: 'default-news',
                name: 'Новостные каналы',
                description: 'Шаблон для анализа новостных каналов',
                channels: ['breakingmash', 'rianews', 'meduzalive'],
                cpmRange: { min: 100, max: 800 },
                createdAt: new Date().toISOString()
            },
            {
                id: 'default-tech',
                name: 'IT и технологии',
                description: 'Шаблон для анализа IT каналов',
                channels: ['tproger', 'habr_com', 'digitalcultist'],
                cpmRange: { min: 150, max: 1200 },
                createdAt: new Date().toISOString()
            },
            {
                id: 'default-lifestyle',
                name: 'Лайфстайл',
                description: 'Шаблон для анализа лайфстайл каналов',
                channels: ['fashion_kaluga', 'beautyinsider', 'theoryandpractice'],
                cpmRange: { min: 80, max: 600 },
                createdAt: new Date().toISOString()
            }
        ];
    }

    /**
     * Export history management
     */
    addExportRecord(exportData) {
        const history = this.getItem(this.storageKeys.EXPORT_HISTORY, []);
        const record = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            type: exportData.type || 'excel',
            fileName: exportData.fileName,
            channelsCount: exportData.channelsCount || 0,
            projectName: exportData.projectName || null
        };

        history.unshift(record);

        // Keep only last 50 export records
        if (history.length > 50) {
            history.splice(50);
        }

        return this.setItem(this.storageKeys.EXPORT_HISTORY, history);
    }

    getExportHistory() {
        return this.getItem(this.storageKeys.EXPORT_HISTORY, []);
    }

    clearExportHistory() {
        return this.setItem(this.storageKeys.EXPORT_HISTORY, []);
    }

    /**
     * Data backup and restore
     */
    createBackup() {
        try {
            const backup = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                data: {
                    projects: this.getProjects(),
                    analysisResults: this.getAnalysisResults(),
                    workCampaigns: this.getWorkCampaigns(),
                    userSettings: this.getUserSettings(),
                    templates: this.getTemplates(),
                    exportHistory: this.getExportHistory()
                }
            };

            return JSON.stringify(backup, null, 2);
        } catch (error) {
            console.error('Error creating backup:', error);
            return null;
        }
    }

    restoreFromBackup(backupData) {
        try {
            const backup = JSON.parse(backupData);

            if (!backup.version || !backup.data) {
                throw new Error('Неверный формат файла резервной копии');
            }

            // Restore data
            if (backup.data.projects) this.setProjects(backup.data.projects);
            if (backup.data.analysisResults) this.setAnalysisResults(backup.data.analysisResults);
            if (backup.data.workCampaigns) this.setWorkCampaigns(backup.data.workCampaigns);
            if (backup.data.userSettings) this.setUserSettings(backup.data.userSettings);
            if (backup.data.templates) this.setTemplates(backup.data.templates);
            if (backup.data.exportHistory) this.setItem(this.storageKeys.EXPORT_HISTORY, backup.data.exportHistory);

            return true;
        } catch (error) {
            console.error('Error restoring backup:', error);
            return false;
        }
    }

    /**
     * Storage cleanup and maintenance
     */
    getStorageUsage() {
        try {
            let totalSize = 0;
            const usage = {};

            Object.entries(this.storageKeys).forEach(([key, storageKey]) => {
                const data = localStorage.getItem(storageKey);
                const size = data ? data.length : 0;
                usage[key] = size;
                totalSize += size;
            });

            return {
                totalSize,
                usage,
                available: (5 * 1024 * 1024) - totalSize, // Assuming 5MB localStorage limit
                percentage: Math.round((totalSize / (5 * 1024 * 1024)) * 100)
            };
        } catch (error) {
            console.error('Error calculating storage usage:', error);
            return null;
        }
    }

    clearAllData() {
        try {
            Object.values(this.storageKeys).forEach(key => {
                localStorage.removeItem(key);
            });

            // Reinitialize with defaults
            this.initializeStorage();
            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            return false;
        }
    }

    cleanupOldData(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const cutoffTimestamp = cutoffDate.toISOString();

            // Clean old analysis results
            const analysisResults = this.getAnalysisResults();
            const filteredResults = analysisResults.filter(result => 
                result.timestamp > cutoffTimestamp
            );
            this.setAnalysisResults(filteredResults);

            // Clean old export history
            const exportHistory = this.getExportHistory();
            const filteredHistory = exportHistory.filter(record => 
                record.timestamp > cutoffTimestamp
            );
            this.setItem(this.storageKeys.EXPORT_HISTORY, filteredHistory);

            return true;
        } catch (error) {
            console.error('Error cleaning up old data:', error);
            return false;
        }
    }

    /**
     * Utility methods
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('ru-RU');
        } catch (error) {
            return dateString;
        }
    }

    isStorageAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Export for use in other modules
window.TGTrafficStorage = TGTrafficStorage;
