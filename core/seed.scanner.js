/**
 * 种子扫描器 - 核心算法模块
 * 负责遍历种子、并行评估、结果收集
 */
const pLimit = require('p-limit');
const logger = require('../utils/logger');
const { SeedCache } = require('./cache.manager');
const Scorer = require('./scorer');
const { handleError } = require('../utils/error.handler');

class SeedScanner {
    /**
     * @param {Object} config - 完整配置
     */
    constructor(config) {
        this.config = config;
        this.searchConfig = config.search;
        this.gameConfig = config.game;
        this.conditions = [];
        this.scorer = new Scorer();
        this.cache = new SeedCache({ maxSize: 50000 });
        this.limit = pLimit(this.searchConfig.concurrency || 4);
        this.logger = logger.getChildLogger('scanner');
        this._aborted = false;
    }

    /**
     * 添加条件
     * @param {BaseCondition} condition
     * @returns {boolean} 是否成功添加
     */
    addCondition(condition) {
        if (!condition) {
            this.logger.debug('Skipped null condition');
            return false;
        }

        this.conditions.push(condition);
        this.logger.debug(`Added condition: ${condition.getDescription()}`);
        return true;
    }

    /**
     * 执行种子搜索
     * @param {Object} options - 搜索选项
     * @returns {Promise<Array>} 排序后的结果
     */
    async scan(options = {}) {
        const {
            minSeed = this.searchConfig.seedRange.min,
            maxSeed = this.searchConfig.seedRange.max,
            topN = this.searchConfig.topResults || 5,
            minScore = this.searchConfig.minScore || 0,
            progressCallback = null
        } = options;

        this.logger.info(`Starting scan: ${minSeed} - ${maxSeed}`, {
            concurrency: this.searchConfig.concurrency,
            conditions: this.conditions.length,
            topN,
            minScore
        });

        const results = [];
        const total = maxSeed - minSeed + 1;
        let processed = 0;
        const startTime = Date.now();
        const chunkSize = 1000; // 分块大小，平衡内存和进度更新

        try {
            // 分块处理，避免内存爆炸
            for (let chunkStart = minSeed; chunkStart <= maxSeed; chunkStart += chunkSize) {
                if (this._aborted) {
                    this.logger.warn('Scan aborted by user');
                    break;
                }

                const chunkEnd = Math.min(chunkStart + chunkSize - 1, maxSeed);
                const tasks = [];

                // 创建当前块的任务
                for (let seed = chunkStart; seed <= chunkEnd; seed++) {
                    tasks.push(this.limit(() => this._evaluateSeed(BigInt(seed))));
                }

                // 批量执行
                const chunkResults = await Promise.all(tasks);

                // 收集有效结果
                for (const result of chunkResults) {
                    if (result && result.totalScore >= minScore) {
                        results.push(result);
                    }
                }

                // 更新进度
                processed += (chunkEnd - chunkStart + 1);
                if (progressCallback) {
                    progressCallback({
                        processed,
                        total,
                        percent: ((processed / total) * 100).toFixed(2),
                        elapsed: Date.now() - startTime,
                        found: results.length,
                        rate: (processed / ((Date.now() - startTime) / 1000)).toFixed(0)
                    });
                }

                // 早期退出：如果已找到足够多高分结果
                if (this._shouldEarlyExit(results, topN, minScore)) {
                    this.logger.info('Early exit: sufficient high-quality results found');
                    break;
                }
            }

            // 排序并返回前 N 个
            const sorted = results
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, topN);

            const elapsed = Date.now() - startTime;
            this.logger.info(`Scan complete: ${processed} seeds in ${elapsed}ms, ${results.length} matches`);

            return sorted.map((result, index) => ({
                rank: index + 1,
                seed: result.seed.toString(),
                score: result.totalScore,
                breakdown: result.breakdown,
                details: result.details,
                timestamp: result.timestamp
            }));

        } catch (error) {
            this.logger.error('Scan failed:', error);
            throw handleError(error, 'seed_scan');
        }
    }

    /**
     * 评估单个种子
     * @private
     */
    async _evaluateSeed(seed) {
        try {
            // 缓存检查
            const cacheKey = `${seed}_${this._getConditionHash()}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }

            // 预检：快速过滤
            for (const condition of this.conditions) {
                if (!(await condition.preCheck?.(seed, this.gameConfig))) {
                    return null;
                }
            }

            // 详细评估
            const breakdown = {};
            let totalScore = 0;
            const details = {};

            for (const condition of this.conditions) {
                // 为条件提供完整的 gameData（包含季节和年份信息）
                // 从配置中获取第一个条件的季节/年份参数作为默认值
                const firstCondParams = this.conditions[0]?.params || {};
                const gameData = {
                    ...this.gameConfig,
                    season: firstCondParams.season || 'spring',
                    year: firstCondParams.year || 1
                };
                const result = await condition.evaluate(seed, gameData);
                breakdown[condition.name] = result.score;
                details[condition.name] = result.details;
                totalScore += result.score;
            }

            // 计算最终得分
            const finalScore = this.scorer.calculate(totalScore, breakdown, this.conditions);

            if (finalScore <= 0) {
                return null;
            }

            const result = {
                seed,
                totalScore: finalScore,
                breakdown,
                details,
                timestamp: Date.now()
            };

            // 缓存结果
            this.cache.set(cacheKey, result);

            return result;

        } catch (error) {
            this.logger.debug(`Error evaluating seed ${seed}:`, error.message);
            return null; // 静默失败，不影响其他种子
        }
    }

    /**
     * 生成条件哈希（用于缓存键）
     * @private
     */
    _getConditionHash() {
        return this.conditions
            .map(c => `${c.name}:${c.weight}:${JSON.stringify(c.params)}`)
            .sort()
            .join('|');
    }

    /**
     * 判断是否应提前退出
     * @private
     */
    _shouldEarlyExit(results, topN, minScore) {
        if (results.length < topN * 5) return false;

        // 如果前 topN 个结果分数都很高且稳定
        const topScores = results
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, topN)
            .map(r => r.totalScore);

        if (topScores.length < topN) return false;

        const avgTop = topScores.reduce((a, b) => a + b, 0) / topN;
        const threshold = this.searchConfig.earlyExitThreshold || 0.3;

        // 如果最低分也达到平均分的 (1-threshold)，认为已找到优质结果
        return topScores[topScores.length - 1] >= avgTop * (1 - threshold);
    }

    /**
     * 中止扫描
     */
    abort() {
        this._aborted = true;
        this.logger.info('Scan abort requested');
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            conditions: this.conditions.length,
            cacheSize: this.cache.size,
            cacheHits: this.cache.hits,
            cacheMisses: this.cache.misses
        };
    }
}

module.exports = SeedScanner;