/**
 * TGStat API Integration Module
 * Handles all API calls to TGStat service with CORS proxy
 */

class TGStatAPI {
    constructor(apiKey = '') {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.tgstat.ru';
        this.proxyURL = 'https://api.allorigins.win/raw?url=';
        this.rateLimitDelay = 1000; // 1 second between requests
        this.maxRetries = 3;
    }

    /**
     * Set API key for authentication
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Get API key status and limits
     */
    async getApiStatus() {
        try {
            const response = await this.makeRequest('/usage');
            return {
                success: true,
                data: response,
                remaining: response.requests_left || 0,
                limit: response.requests_limit || 0
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                remaining: 0,
                limit: 0
            };
        }
    }

    /**
     * Get channel information by username
     */
    async getChannelInfo(channelUsername) {
        // Remove @ symbol if present
        const cleanUsername = channelUsername.replace('@', '');

        try {
            const response = await this.makeRequest(`/channels/get?channel=${cleanUsername}`);

            if (response && response.response) {
                const channel = response.response;
                return {
                    success: true,
                    data: {
                        id: channel.id,
                        username: channel.username,
                        title: channel.title,
                        description: channel.about || '',
                        participants_count: channel.participants_count || 0,
                        photo: channel.photo || null,
                        verified: channel.verified || false,
                        fake: channel.fake || false,
                        restricted: channel.restricted || false,
                        scam: channel.scam || false,
                        category: channel.category || 'unknown',
                        language: channel.language || 'unknown',
                        avg_post_reach: channel.avg_post_reach || 0,
                        err_percent: channel.err_percent || 0,
                        ci_index: channel.ci_index || 0
                    }
                };
            } else {
                throw new Error('Канал не найден или недоступен');
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get channel statistics and metrics
     */
    async getChannelStats(channelUsername, period = 7) {
        const cleanUsername = channelUsername.replace('@', '');

        try {
            const response = await this.makeRequest(`/channels/stat?channel=${cleanUsername}&period=${period}`);

            if (response && response.response) {
                const stats = response.response;
                return {
                    success: true,
                    data: {
                        period,
                        views_per_post: stats.views_per_post || 0,
                        forwards_per_post: stats.forwards_per_post || 0,
                        mentions_per_post: stats.mentions_per_post || 0,
                        avg_post_reach: stats.avg_post_reach || 0,
                        participants_count: stats.participants_count || 0,
                        daily_reach: stats.daily_reach || 0,
                        ci_index: stats.ci_index || 0,
                        posts_count: stats.posts_count || 0
                    }
                };
            } else {
                throw new Error('Статистика канала недоступна');
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get channel posts for analysis
     */
    async getChannelPosts(channelUsername, limit = 50) {
        const cleanUsername = channelUsername.replace('@', '');

        try {
            const response = await this.makeRequest(`/channels/posts?channel=${cleanUsername}&limit=${limit}`);

            if (response && response.response && response.response.items) {
                const posts = response.response.items.map(post => ({
                    id: post.id,
                    date: post.date,
                    text: post.text || '',
                    views: post.views || 0,
                    forwards: post.forwards || 0,
                    replies: post.replies || 0,
                    reactions: post.reactions || 0,
                    media_type: post.media_type || null,
                    link_preview: post.link_preview || null
                }));

                return {
                    success: true,
                    data: posts,
                    count: posts.length
                };
            } else {
                throw new Error('Посты канала недоступны');
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: [],
                count: 0
            };
        }
    }

    /**
     * Search channels by keywords
     */
    async searchChannels(query, limit = 20) {
        try {
            const response = await this.makeRequest(`/channels/search?q=${encodeURIComponent(query)}&limit=${limit}`);

            if (response && response.response && response.response.items) {
                const channels = response.response.items.map(channel => ({
                    id: channel.id,
                    username: channel.username,
                    title: channel.title,
                    participants_count: channel.participants_count || 0,
                    category: channel.category || 'unknown',
                    verified: channel.verified || false,
                    avg_post_reach: channel.avg_post_reach || 0
                }));

                return {
                    success: true,
                    data: channels,
                    count: channels.length
                };
            } else {
                throw new Error('Результаты поиска недоступны');
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: [],
                count: 0
            };
        }
    }

    /**
     * Get channel competitors/similar channels
     */
    async getSimilarChannels(channelUsername, limit = 10) {
        const cleanUsername = channelUsername.replace('@', '');

        try {
            const response = await this.makeRequest(`/channels/mentions?channel=${cleanUsername}&limit=${limit}`);

            if (response && response.response) {
                return {
                    success: true,
                    data: response.response.items || [],
                    count: response.response.items ? response.response.items.length : 0
                };
            } else {
                return {
                    success: true,
                    data: [],
                    count: 0
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: [],
                count: 0
            };
        }
    }

    /**
     * Make HTTP request with retry logic and rate limiting
     */
    async makeRequest(endpoint, retryCount = 0) {
        if (!this.apiKey) {
            throw new Error('API ключ не установлен');
        }

        const url = `${this.proxyURL}${encodeURIComponent(`${this.baseURL}${endpoint}`)}`;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'TGTrafficMaster/1.0'
        };

        try {
            // Rate limiting
            await this.delay(this.rateLimitDelay);

            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                mode: 'cors'
            });

            if (!response.ok) {
                if (response.status === 429 && retryCount < this.maxRetries) {
                    // Rate limit exceeded, retry with exponential backoff
                    await this.delay(Math.pow(2, retryCount) * 2000);
                    return this.makeRequest(endpoint, retryCount + 1);
                }

                if (response.status === 401) {
                    throw new Error('Неверный API ключ или ключ истек');
                }

                if (response.status === 403) {
                    throw new Error('Доступ запрещен. Проверьте лимиты API');
                }

                if (response.status === 404) {
                    throw new Error('Ресурс не найден');
                }

                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.ok === false) {
                throw new Error(data.error || 'Ошибка API');
            }

            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Ошибка сети. Проверьте подключение к интернету');
            }

            if (retryCount < this.maxRetries && !error.message.includes('API ключ')) {
                await this.delay(Math.pow(2, retryCount) * 1000);
                return this.makeRequest(endpoint, retryCount + 1);
            }

            throw error;
        }
    }

    /**
     * Delay execution for rate limiting
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Batch process multiple channels with rate limiting
     */
    async batchAnalyzeChannels(channelUsernames, onProgress = null) {
        const results = [];
        const total = channelUsernames.length;

        for (let i = 0; i < channelUsernames.length; i++) {
            const username = channelUsernames[i];

            try {
                // Get basic channel info
                const channelInfo = await this.getChannelInfo(username);

                if (channelInfo.success) {
                    // Get channel statistics
                    const channelStats = await this.getChannelStats(username);

                    results.push({
                        username,
                        success: true,
                        info: channelInfo.data,
                        stats: channelStats.success ? channelStats.data : null,
                        error: null
                    });
                } else {
                    results.push({
                        username,
                        success: false,
                        info: null,
                        stats: null,
                        error: channelInfo.error
                    });
                }

                // Call progress callback if provided
                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total,
                        percentage: Math.round(((i + 1) / total) * 100),
                        currentChannel: username
                    });
                }

            } catch (error) {
                results.push({
                    username,
                    success: false,
                    info: null,
                    stats: null,
                    error: error.message
                });
            }

            // Rate limiting between requests
            if (i < channelUsernames.length - 1) {
                await this.delay(this.rateLimitDelay);
            }
        }

        return results;
    }

    /**
     * Validate channel username format
     */
    static validateChannelUsername(username) {
        const cleanUsername = username.replace('@', '');
        const regex = /^[a-zA-Z0-9_]{5,32}$/;

        return {
            valid: regex.test(cleanUsername),
            cleaned: cleanUsername
        };
    }

    /**
     * Parse multiple channel usernames from text
     */
    static parseChannelUsernames(text) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const usernames = [];
        const errors = [];

        lines.forEach((line, index) => {
            // Remove common prefixes
            let username = line
                .replace(/^https?:\/\/t\.me\//i, '')
                .replace(/^@/, '')
                .split('?')[0] // Remove URL parameters
                .split('/')[0]; // Remove path after username

            const validation = TGStatAPI.validateChannelUsername(username);

            if (validation.valid) {
                usernames.push(validation.cleaned);
            } else {
                errors.push({
                    line: index + 1,
                    text: line,
                    error: 'Неверный формат имени канала'
                });
            }
        });

        return {
            usernames: [...new Set(usernames)], // Remove duplicates
            errors
        };
    }
}

// Export for use in other modules
window.TGStatAPI = TGStatAPI;
