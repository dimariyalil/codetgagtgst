/**
 * Analytics and Metrics Calculation Module
 * Handles all channel analysis, scoring, and metrics computation
 */

class TGTrafficAnalytics {
    constructor() {
        this.qualityThresholds = {
            excellent: { score: 90, color: 'green' },
            good: { score: 70, color: 'blue' },
            average: { score: 50, color: 'yellow' },
            poor: { score: 30, color: 'orange' },
            bad: { score: 0, color: 'red' }
        };

        this.categoryMultipliers = {
            'news': 1.2,
            'tech': 1.3,
            'lifestyle': 1.0,
            'entertainment': 0.9,
            'business': 1.4,
            'education': 1.1,
            'unknown': 1.0
        };
    }

    /**
     * Main channel analysis method
     * Calculates comprehensive metrics and quality score
     */
    analyzeChannel(channelData, statsData = null) {
        try {
            const metrics = this.calculateChannelMetrics(channelData, statsData);
            const qualityScore = this.calculateQualityScore(metrics);
            const engagementMetrics = this.calculateEngagementMetrics(metrics);
            const recommendations = this.generateRecommendations(metrics, qualityScore);
            const priceEstimate = this.estimateAdPrice(metrics, qualityScore);

            return {
                success: true,
                channel: {
                    username: channelData.username,
                    title: channelData.title,
                    description: channelData.description,
                    participants_count: channelData.participants_count,
                    category: channelData.category,
                    verified: channelData.verified,
                    language: channelData.language
                },
                metrics,
                qualityScore,
                engagementMetrics,
                recommendations,
                priceEstimate,
                analysisTimestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                channel: channelData ? { username: channelData.username } : null
            };
        }
    }

    /**
     * Calculate basic channel metrics
     */
    calculateChannelMetrics(channelData, statsData) {
        const subscribers = channelData.participants_count || 0;
        const avgReach = channelData.avg_post_reach || statsData?.avg_post_reach || 0;
        const ciIndex = channelData.ci_index || statsData?.ci_index || 0;
        const errPercent = channelData.err_percent || 0;

        // Calculate reach percentage
        const reachPercentage = subscribers > 0 ? (avgReach / subscribers) * 100 : 0;

        // Calculate engagement rate (simplified)
        const engagementRate = ciIndex > 0 ? ciIndex : (reachPercentage * 0.8);

        // Calculate activity metrics
        const postsPerDay = statsData?.posts_count ? 
            statsData.posts_count / (statsData.period || 7) : 1;

        const viewsPerPost = statsData?.views_per_post || avgReach;
        const forwardsPerPost = statsData?.forwards_per_post || 0;
        const mentionsPerPost = statsData?.mentions_per_post || 0;

        return {
            subscribers,
            avgReach,
            reachPercentage: Math.round(reachPercentage * 100) / 100,
            engagementRate: Math.round(engagementRate * 100) / 100,
            ciIndex: Math.round(ciIndex * 100) / 100,
            errPercent: Math.round(errPercent * 100) / 100,
            postsPerDay: Math.round(postsPerDay * 10) / 10,
            viewsPerPost,
            forwardsPerPost,
            mentionsPerPost,
            category: channelData.category || 'unknown',
            verified: channelData.verified || false,
            language: channelData.language || 'unknown'
        };
    }

    /**
     * Calculate overall quality score (0-100)
     */
    calculateQualityScore(metrics) {
        let score = 0;
        let weights = 0;

        // Subscriber count weight (max 25 points)
        if (metrics.subscribers > 0) {
            const subscriberScore = Math.min(
                25, 
                Math.log10(metrics.subscribers) * 5
            );
            score += subscriberScore * 0.25;
            weights += 0.25;
        }

        // Reach percentage weight (max 30 points)
        if (metrics.reachPercentage > 0) {
            const reachScore = Math.min(30, metrics.reachPercentage * 2);
            score += reachScore * 0.30;
            weights += 0.30;
        }

        // Engagement rate weight (max 25 points)
        if (metrics.engagementRate > 0) {
            const engagementScore = Math.min(25, metrics.engagementRate * 5);
            score += engagementScore * 0.25;
            weights += 0.25;
        }

        // CI Index weight (max 20 points)
        if (metrics.ciIndex > 0) {
            const ciScore = Math.min(20, metrics.ciIndex * 20);
            score += ciScore * 0.20;
            weights += 0.20;
        }

        // Apply category multiplier
        const categoryMultiplier = this.categoryMultipliers[metrics.category] || 1.0;
        score *= categoryMultiplier;

        // Verified channels get bonus
        if (metrics.verified) {
            score *= 1.1;
        }

        // ERR percentage penalty
        if (metrics.errPercent > 5) {
            score *= (1 - (metrics.errPercent / 100) * 0.5);
        }

        // Normalize score
        const finalScore = weights > 0 ? Math.min(100, Math.max(0, score / weights * 100)) : 0;

        return {
            overall: Math.round(finalScore * 100) / 100,
            breakdown: {
                subscribers: Math.round((metrics.subscribers > 0 ? Math.log10(metrics.subscribers) * 5 : 0) * 100) / 100,
                reach: Math.round(Math.min(30, metrics.reachPercentage * 2) * 100) / 100,
                engagement: Math.round(Math.min(25, metrics.engagementRate * 5) * 100) / 100,
                ci: Math.round(Math.min(20, metrics.ciIndex * 20) * 100) / 100
            },
            modifiers: {
                category: categoryMultiplier,
                verified: metrics.verified ? 1.1 : 1.0,
                err: metrics.errPercent > 5 ? (1 - (metrics.errPercent / 100) * 0.5) : 1.0
            }
        };
    }

    /**
     * Calculate detailed engagement metrics
     */
    calculateEngagementMetrics(metrics) {
        const engagement = {
            views: {
                total: metrics.viewsPerPost,
                perSubscriber: metrics.subscribers > 0 ? 
                    Math.round((metrics.viewsPerPost / metrics.subscribers) * 10000) / 10000 : 0
            },
            forwards: {
                total: metrics.forwardsPerPost,
                rate: metrics.viewsPerPost > 0 ? 
                    Math.round((metrics.forwardsPerPost / metrics.viewsPerPost) * 10000) / 100 : 0
            },
            mentions: {
                total: metrics.mentionsPerPost,
                rate: metrics.viewsPerPost > 0 ? 
                    Math.round((metrics.mentionsPerPost / metrics.viewsPerPost) * 10000) / 100 : 0
            },
            activity: {
                postsPerDay: metrics.postsPerDay,
                consistency: this.calculateConsistencyScore(metrics.postsPerDay)
            }
        };

        // Calculate viral potential
        engagement.viralPotential = this.calculateViralPotential(engagement);

        return engagement;
    }

    /**
     * Calculate consistency score based on posting frequency
     */
    calculateConsistencyScore(postsPerDay) {
        if (postsPerDay >= 1 && postsPerDay <= 3) return 'excellent';
        if (postsPerDay >= 0.5 && postsPerDay < 1) return 'good';
        if (postsPerDay >= 0.2 && postsPerDay < 0.5) return 'average';
        if (postsPerDay > 3) return 'too_frequent';
        return 'poor';
    }

    /**
     * Calculate viral potential score
     */
    calculateViralPotential(engagementMetrics) {
        let viralScore = 0;

        // Forward rate contributes most to viral potential
        if (engagementMetrics.forwards.rate > 5) viralScore += 40;
        else if (engagementMetrics.forwards.rate > 2) viralScore += 25;
        else if (engagementMetrics.forwards.rate > 1) viralScore += 15;

        // Mention rate indicates discussion generation
        if (engagementMetrics.mentions.rate > 3) viralScore += 30;
        else if (engagementMetrics.mentions.rate > 1) viralScore += 20;
        else if (engagementMetrics.mentions.rate > 0.5) viralScore += 10;

        // Views per subscriber indicates content quality
        if (engagementMetrics.views.perSubscriber > 1.2) viralScore += 20;
        else if (engagementMetrics.views.perSubscriber > 1) viralScore += 15;
        else if (engagementMetrics.views.perSubscriber > 0.8) viralScore += 10;

        // Activity consistency
        if (engagementMetrics.activity.consistency === 'excellent') viralScore += 10;
        else if (engagementMetrics.activity.consistency === 'good') viralScore += 5;

        return Math.min(100, viralScore);
    }

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(metrics, qualityScore) {
        const recommendations = [];

        if (qualityScore.overall >= 90) {
            recommendations.push({
                type: 'success',
                title: 'Отличный канал',
                message: 'Высокие показатели качества. Рекомендуется для рекламных кампаний.'
            });
        } else if (qualityScore.overall >= 70) {
            recommendations.push({
                type: 'info',
                title: 'Хороший канал',
                message: 'Неплохие показатели. Подходит для большинства рекламных задач.'
            });
        } else {
            recommendations.push({
                type: 'warning',
                title: 'Требует проверки',
                message: 'Показатели ниже среднего. Рекомендуется дополнительный анализ.'
            });
        }

        // Specific recommendations
        if (metrics.reachPercentage < 20) {
            recommendations.push({
                type: 'warning',
                title: 'Низкий охват',
                message: `Охват составляет только ${metrics.reachPercentage}% от подписчиков`
            });
        }

        if (metrics.errPercent > 10) {
            recommendations.push({
                type: 'danger',
                title: 'Высокий ERR',
                message: `ERR ${metrics.errPercent}% может указывать на накрутку`
            });
        }

        if (metrics.engagementRate < 5) {
            recommendations.push({
                type: 'info',
                title: 'Низкая вовлеченность',
                message: 'Рассмотрите каналы с более высокой вовлеченностью аудитории'
            });
        }

        if (metrics.postsPerDay > 5) {
            recommendations.push({
                type: 'warning',
                title: 'Слишком частые посты',
                message: 'Высокая частота публикаций может снижать внимание к рекламе'
            });
        }

        return recommendations;
    }

    /**
     * Estimate advertising price range
     */
    estimateAdPrice(metrics, qualityScore) {
        let baseCpm = 100; // Base CPM in rubles

        // Adjust by subscriber count
        if (metrics.subscribers > 100000) baseCpm *= 1.5;
        else if (metrics.subscribers > 50000) baseCpm *= 1.3;
        else if (metrics.subscribers > 10000) baseCpm *= 1.1;
        else if (metrics.subscribers < 1000) baseCpm *= 0.5;

        // Adjust by category
        const categoryMultiplier = this.categoryMultipliers[metrics.category] || 1.0;
        baseCpm *= categoryMultiplier;

        // Adjust by quality score
        const qualityMultiplier = 0.5 + (qualityScore.overall / 100);
        baseCpm *= qualityMultiplier;

        // Adjust by engagement
        if (metrics.engagementRate > 15) baseCpm *= 1.4;
        else if (metrics.engagementRate > 10) baseCpm *= 1.2;
        else if (metrics.engagementRate < 3) baseCpm *= 0.8;

        // Verified channels premium
        if (metrics.verified) baseCpm *= 1.2;

        // Calculate price range (±30% from base)
        const minPrice = Math.round(baseCpm * 0.7);
        const maxPrice = Math.round(baseCpm * 1.3);
        const avgPrice = Math.round(baseCpm);

        // Calculate post price (assuming 1000 views per 1000 subscribers)
        const estimatedViews = metrics.avgReach || (metrics.subscribers * 0.3);
        const postPrice = Math.round((avgPrice / 1000) * (estimatedViews / 1000) * 1000);

        return {
            cpm: {
                min: minPrice,
                max: maxPrice,
                avg: avgPrice,
                currency: 'RUB'
            },
            postPrice: {
                estimated: postPrice,
                currency: 'RUB'
            },
            factors: {
                subscribers: metrics.subscribers,
                category: metrics.category,
                quality: qualityScore.overall,
                engagement: metrics.engagementRate,
                verified: metrics.verified
            }
        };
    }

    /**
     * Compare multiple channels
     */
    compareChannels(channelsData) {
        const comparisons = channelsData.map(channel => {
            const analysis = this.analyzeChannel(channel.info, channel.stats);
            return {
                ...analysis,
                rank: 0 // Will be calculated after sorting
            };
        });

        // Sort by quality score
        comparisons.sort((a, b) => b.qualityScore.overall - a.qualityScore.overall);

        // Assign ranks
        comparisons.forEach((item, index) => {
            item.rank = index + 1;
        });

        // Calculate category averages
        const categoryStats = this.calculateCategoryStats(comparisons);

        return {
            channels: comparisons,
            summary: {
                total: comparisons.length,
                avgQualityScore: Math.round(
                    comparisons.reduce((sum, ch) => sum + ch.qualityScore.overall, 0) / 
                    comparisons.length * 100
                ) / 100,
                avgSubscribers: Math.round(
                    comparisons.reduce((sum, ch) => sum + ch.metrics.subscribers, 0) / 
                    comparisons.length
                ),
                avgReach: Math.round(
                    comparisons.reduce((sum, ch) => sum + ch.metrics.reachPercentage, 0) / 
                    comparisons.length * 100
                ) / 100,
                categoryStats
            }
        };
    }

    /**
     * Calculate category statistics
     */
    calculateCategoryStats(channels) {
        const categories = {};

        channels.forEach(channel => {
            const category = channel.metrics.category;
            if (!categories[category]) {
                categories[category] = {
                    count: 0,
                    avgScore: 0,
                    avgSubscribers: 0,
                    avgCpm: 0
                };
            }

            categories[category].count++;
            categories[category].avgScore += channel.qualityScore.overall;
            categories[category].avgSubscribers += channel.metrics.subscribers;
            categories[category].avgCpm += channel.priceEstimate.cpm.avg;
        });

        // Calculate averages
        Object.keys(categories).forEach(category => {
            const cat = categories[category];
            cat.avgScore = Math.round(cat.avgScore / cat.count * 100) / 100;
            cat.avgSubscribers = Math.round(cat.avgSubscribers / cat.count);
            cat.avgCpm = Math.round(cat.avgCpm / cat.count);
        });

        return categories;
    }

    /**
     * Generate export data for Excel
     */
    generateExportData(analysisResults) {
        const exportData = [];

        analysisResults.forEach((result, index) => {
            if (result.success) {
                exportData.push({
                    'Ранг': index + 1,
                    'Канал': `@${result.channel.username}`,
                    'Название': result.channel.title || '',
                    'Подписчики': result.metrics.subscribers,
                    'Охват %': result.metrics.reachPercentage,
                    'Вовлеченность %': result.metrics.engagementRate,
                    'CI индекс': result.metrics.ciIndex,
                    'ERR %': result.metrics.errPercent,
                    'Оценка качества': result.qualityScore.overall,
                    'Категория': result.metrics.category,
                    'Верифицирован': result.metrics.verified ? 'Да' : 'Нет',
                    'CPM мин': result.priceEstimate.cpm.min,
                    'CPM макс': result.priceEstimate.cpm.max,
                    'CPM средн': result.priceEstimate.cpm.avg,
                    'Цена поста': result.priceEstimate.postPrice.estimated,
                    'Постов в день': result.metrics.postsPerDay,
                    'Просмотры/пост': result.metrics.viewsPerPost,
                    'Репосты/пост': result.metrics.forwardsPerPost,
                    'Упоминания/пост': result.metrics.mentionsPerPost,
                    'Язык': result.metrics.language,
                    'Дата анализа': new Date(result.analysisTimestamp).toLocaleString('ru-RU')
                });
            }
        });

        return exportData;
    }

    /**
     * Get quality badge info
     */
    getQualityBadge(score) {
        if (score >= 90) return { label: 'Отлично', color: 'green', icon: 'star' };
        if (score >= 70) return { label: 'Хорошо', color: 'blue', icon: 'thumbs-up' };
        if (score >= 50) return { label: 'Средне', color: 'yellow', icon: 'minus' };
        if (score >= 30) return { label: 'Плохо', color: 'orange', icon: 'thumbs-down' };
        return { label: 'Очень плохо', color: 'red', icon: 'times' };
    }

    /**
     * Validate analysis data
     */
    validateAnalysisData(channelData) {
        if (!channelData) {
            throw new Error('Данные канала не предоставлены');
        }

        if (!channelData.username) {
            throw new Error('Не указано имя канала');
        }

        if (typeof channelData.participants_count !== 'number' || channelData.participants_count < 0) {
            throw new Error('Некорректное количество подписчиков');
        }

        return true;
    }
}

// Export for use in other modules
window.TGTrafficAnalytics = TGTrafficAnalytics;
