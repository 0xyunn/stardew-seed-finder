/**
 * 条件注册中心 - 管理所有条件模块
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ConditionRegistry {
    constructor() {
        this.conditions = new Map();
        this._loaded = false;
    }

    /**
     * 注册条件类
     * @param {string} type - 条件类型标识
     * @param {Class} ConditionClass - 条件类构造函数
     */
    register(type, ConditionClass) {
        if (this.conditions.has(type)) {
            logger.warn(`Condition type "${type}" already registered, overwriting`);
        }
        this.conditions.set(type, ConditionClass);
        logger.debug(`Registered condition: ${type}`);
        return this;
    }

    /**
     * 批量加载条件模块
     * @param {string} dir - 条件模块目录
     */
    loadFromDirectory(dir) {
        if (this._loaded) return;

        const files = fs.readdirSync(dir);

        for (const file of files) {
            // 跳过非条件文件
            if (file === 'index.js' || file === 'base.condition.js' ||
                file === 'template.js' || !file.endsWith('.js')) {
                continue;
            }

            const filePath = path.join(dir, file);
            if (!fs.statSync(filePath).isFile()) continue;

            try {
                const ConditionClass = require(filePath);
                const instance = new ConditionClass();

                // 使用文件名作为类型标识 (snake_case -> camelCase)
                const type = path.basename(file, '.js')
                    .replace(/\.([a-z])/g, (_, c) => c.toUpperCase())
                    .replace(/^[a-z]/, c => c.toLowerCase());

                this.register(type, ConditionClass);
                logger.debug(`Loaded condition: ${type} from ${file}`);
            } catch (error) {
                logger.error(`Failed to load condition from ${file}:`, error);
            }
        }

        this._loaded = true;
        logger.info(`Loaded ${this.conditions.size} condition types`);
        return this;
    }

    /**
     * 创建条件实例
     * @param {Object} config - 条件配置
     * @returns {BaseCondition|null}
     */
    create(config) {
        if (!config?.type || config.enabled === false) {
            return null;
        }

        const ConditionClass = this.conditions.get(config.type);
        if (!ConditionClass) {
            logger.error(`Unknown condition type: ${config.type}. Available: ${Array.from(this.conditions.keys()).join(', ')}`);
            return null;
        }

        try {
            const instance = new ConditionClass();
            const validation = instance.validateParams(config.params);

            if (!validation.valid) {
                logger.error(`Invalid params for ${config.type}:`, validation.errors);
                return null;
            }

            return instance.init(config.params);
        } catch (error) {
            logger.error(`Failed to create condition ${config.type}:`, error);
            return null;
        }
    }

    /**
     * 获取所有可用条件类型
     * @returns {string[]}
     */
    getAvailableTypes() {
        return Array.from(this.conditions.keys());
    }

    /**
     * 获取条件描述
     * @param {string} type
     * @returns {string|null}
     */
    getDescription(type) {
        const ConditionClass = this.conditions.get(type);
        if (!ConditionClass) return null;

        try {
            const instance = new ConditionClass();
            return instance.getDescription();
        } catch {
            return type;
        }
    }
}

// 单例导出
const registry = new ConditionRegistry();
module.exports = registry;