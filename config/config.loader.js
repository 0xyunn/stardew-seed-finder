/**
 * 配置加载器 - 支持默认值合并和验证
 */
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const logger = require('../utils/logger');

class ConfigLoader {
    /**
     * 默认配置
     */
    static get DEFAULT_CONFIG() {
        return {
            search: {
                seedRange: { min: 1, max: 2147483647 },
                concurrency: 4,
                topResults: 5,
                earlyExitThreshold: 0.3,
                minScore: 0
            },
            game: {
                version: '1.6',
                useLegacyRandom: false,
                farmType: 'Standard'
            },
            conditions: []
        };
    }

    /**
     * 加载配置文件
     * @param {string} configPath - 配置文件路径
     * @returns {Object} 合并后的配置
     */
    static load(configPath) {
        let userConfig = {};

        // 读取用户配置
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                userConfig = JSON.parse(content);
                logger.info(`Loaded config from: ${configPath}`);
            } catch (error) {
                logger.error(`Failed to parse config file: ${error.message}`);
                throw new Error(`Invalid config file: ${configPath}`);
            }
        } else {
            logger.warn(`Config file not found: ${configPath}, using defaults`);
        }

        // 深度合并配置
        const config = _.mergeWith(
            {},
            this.DEFAULT_CONFIG,
            userConfig,
            (objValue, srcValue) => {
                // 数组不合并，直接替换
                if (Array.isArray(srcValue)) {
                    return srcValue;
                }
            }
        );

        // 验证配置
        this.validate(config);

        return config;
    }

    /**
     * 验证配置
     * @param {Object} config - 待验证配置
     */
    static validate(config) {
        const errors = [];

        // 验证种子范围
        const { seedRange } = config.search;
        if (!Number.isInteger(seedRange.min) || !Number.isInteger(seedRange.max)) {
            errors.push('seedRange.min and seedRange.max must be integers');
        }
        if (seedRange.min < 1 || seedRange.max > 2147483647) {
            errors.push('seedRange must be between 1 and 2147483647');
        }
        if (seedRange.min > seedRange.max) {
            errors.push('seedRange.min cannot be greater than seedRange.max');
        }

        // 验证并发数
        if (!Number.isInteger(config.search.concurrency) || config.search.concurrency < 1) {
            errors.push('concurrency must be a positive integer');
        }

        // 验证条件
        if (!Array.isArray(config.conditions)) {
            errors.push('conditions must be an array');
        } else {
            config.conditions.forEach((cond, index) => {
                if (!cond.type) {
                    errors.push(`Condition #${index + 1} missing required field: type`);
                }
                if (cond.weight !== undefined && (!Number.isFinite(cond.weight) || cond.weight < 0)) {
                    errors.push(`Condition #${index + 1} weight must be a non-negative number`);
                }
            });
        }

        // 验证游戏版本
        const validVersions = ['1.2', '1.3', '1.4', '1.5', '1.6'];
        if (!validVersions.includes(config.game.version)) {
            errors.push(`Invalid game version: ${config.game.version}`);
        }

        if (errors.length > 0) {
            throw new Error(`Config validation failed:\n  - ${errors.join('\n  - ')}`);
        }

        logger.debug('Config validation passed');
    }

    /**
     * 生成配置模板
     * @param {string} outputPath - 输出路径
     */
    static generateTemplate(outputPath = 'config/example.config.json') {
        const template = {
            search: {
                seedRange: {
                    min: 50000000,
                    max: 50010000,
                    description: "Random seed range to search"
                },
                concurrency: 4,
                topResults: 5,
                earlyExitThreshold: 0.3,
                minScore: 100
            },
            game: {
                version: "1.6",
                useLegacyRandom: false,
                farmType: "Standard"
            },
            conditions: [
                {
                    type: "season_item",
                    enabled: true,
                    weight: 10,
                    description: "Check for specific items in a season",
                    params: {
                        season: "spring",
                        year: 1,
                        items: ["Red Cabbage"],
                        mustHave: true
                    }
                },
                {
                    type: "rain_days",
                    enabled: true,
                    weight: 5,
                    description: "Check rain day count in a season",
                    params: {
                        season: "spring",
                        year: 1,
                        minDays: 5,
                        maxDays: null
                    }
                }
            ]
        };

        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(template, null, 2), 'utf8');
        logger.info(`Config template generated: ${outputPath}`);
    }
}

module.exports = ConfigLoader;