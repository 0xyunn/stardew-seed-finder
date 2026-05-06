/**
 * 缓存管理器 - LRU 缓存避免重复计算
 */
const logger = require('../utils/logger');

class SeedCache {
    /**
     * @param {Object} options
     * @param {number} options.maxSize - 最大缓存条目数
     */
    constructor({ maxSize = 50000 } = {}) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.hits = 0;
        this.misses = 0;
        this.logger = logger.getChildLogger('cache');
    }

    /**
     * 获取缓存
     * @param {string} key
     * @returns {*}
     */
    get(key) {
        const item = this.cache.get(key);
        if (item) {
            // LRU: 移动到末尾（最近使用）
            this.cache.delete(key);
            this.cache.set(key, item);
            this.hits++;
            return item;
        }
        this.misses++;
        return null;
    }

    /**
     * 设置缓存
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
        // 如果已存在，先删除以更新位置
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // 如果超出容量，删除最旧的 10%
        if (this.cache.size >= this.maxSize) {
            const deleteCount = Math.max(1, Math.floor(this.maxSize * 0.1));
            const keys = Array.from(this.cache.keys());
            for (let i = 0; i < deleteCount; i++) {
                this.cache.delete(keys[i]);
            }
            this.logger.debug(`Cache trimmed: removed ${deleteCount} entries`);
        }

        this.cache.set(key, value);
    }

    /**
     * 清除缓存
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        this.logger.info(`Cache cleared: ${size} entries removed`);
    }

    /**
     * 获取统计信息
     */
    get stats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : 'N/A'
        };
    }

    /**
     * 删除特定键
     * @param {string} key
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * 检查是否存在
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.cache.has(key);
    }
}

module.exports = { SeedCache };