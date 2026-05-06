/**
 * 条件基类 - 所有条件模块需继承此类
 * 实现策略模式，确保可扩展性
 */
const logger = require('../utils/logger');

class BaseCondition {
    /**
     * @param {string} name - 条件名称
     * @param {number} defaultWeight - 默认权重
     */
    constructor(name, defaultWeight = 1) {
        this.name = name;
        this.weight = defaultWeight;
        this.enabled = true;
        this.params = {};
        this.logger = logger.getChildLogger(`condition:${name}`);
    }

    /**
     * 初始化条件
     * @param {Object} params - 配置参数
     * @returns {this}
     */
    init(params) {
        this.params = params || {};
        if (typeof this.params.weight === 'number' && this.params.weight >= 0) {
            this.weight = this.params.weight;
        }
        if (typeof this.params.enabled === 'boolean') {
            this.enabled = this.params.enabled;
        }
        return this;
    }

    /**
     * 评估单个种子 - 子类必须实现
     * @param {bigint} seed - 游戏种子
     * @param {Object} gameData - 游戏上下文
     * @returns {Promise<{score: number, details: Object}>}
     */
    async evaluate(seed, gameData) {
        throw new Error(`Condition ${this.name} must implement evaluate()`);
    }

    /**
     * 快速预检 - 用于早期剪枝（可选实现）
     * @param {bigint} seed
     * @param {Object} gameData
     * @returns {Promise<boolean>} true=可能满足，可继续评估；false=肯定不满足，跳过
     */
    async preCheck(seed, gameData) {
        return true;
    }

    /**
     * 获取条件描述（用于日志和输出）
     * @returns {string}
     */
    getDescription() {
        return `${this.name} [weight:${this.weight}]`;
    }

    /**
     * 验证参数
     * @param {Object} params
     * @returns {{valid: boolean, errors: string[]}}
     */
    validateParams(params) {
        const errors = [];
        if (params && typeof params !== 'object') {
            errors.push('params must be an object');
        }
        return { valid: errors.length === 0, errors };
    }

    /**
     * 辅助：检查值是否在数组中（忽略大小写）
     * @param {string} value
     * @param {string[]} array
     * @returns {boolean}
     */
    _includesIgnoreCase(value, array) {
        if (!value || !Array.isArray(array)) return false;
        const lower = value.toLowerCase();
        return array.some(item => item?.toLowerCase() === lower);
    }

    /**
     * 辅助：安全获取参数
     * @param {string} key
     * @param {*} defaultValue
     * @returns {*}
     */
    _getParam(key, defaultValue) {
        return this.params?.[key] ?? defaultValue;
    }
}

module.exports = BaseCondition;