/**
 * 新条件模板 - 复制此文件创建新条件
 * 文件名格式: your.condition.name.js (snake_case)
 */
const BaseCondition = require('./base.condition');
// 根据需要导入其他模块
// const { getRandomSeed, CSRandom } = require('../core/rng.adapter');

class YourConditionName extends BaseCondition {
    constructor() {
        // 参数: 条件类型标识, 默认权重
        super('your_condition_type', 10);
    }

    /**
     * 验证配置参数
     */
    validateParams(params) {
        const result = super.validateParams(params);
        if (!result.valid) return result;

        // 添加你的参数验证
        // 示例:
        // if (!params?.yourRequiredField) {
        //   result.errors.push('Missing required field: yourRequiredField');
        // }
        // if (params?.yourNumberField && !Number.isFinite(params.yourNumberField)) {
        //   result.errors.push('yourNumberField must be a number');
        // }

        return result;
    }

    /**
     * 评估单个种子 - 核心逻辑
     * @returns {Promise<{score: number, details: Object}>}
     */
    async evaluate(seed, gameData) {
        // 实现你的评估逻辑
        // 使用 this.params 访问配置参数
        // 使用 this._getParam(key, default) 安全获取参数

        // 示例逻辑:
        const targetValue = this._getParam('targetValue', 0);
        const actualValue = await this._calculateValue(seed, gameData);

        let score = 0;
        if (actualValue >= targetValue) {
            score = 100; // 满足条件
        } else {
            score = Math.max(0, 100 - (targetValue - actualValue) * 10); // 按比例扣分
        }

        return {
            score: score * this.weight, // 乘以权重
            details: {
                actual: actualValue,
                target: targetValue,
                met: actualValue >= targetValue
                // 添加其他调试信息
            }
        };
    }

    /**
     * 快速预检 - 可选，用于早期剪枝提升性能
     * @returns {Promise<boolean>}
     */
    async preCheck(seed, gameData) {
        // 实现快速检查逻辑（应在1ms内完成）
        // 返回 false 可跳过详细评估
        return true;
    }

    /**
     * 获取条件描述（用于日志和输出）
     */
    getDescription() {
        // 返回人类可读的描述
        return `your_condition_type: ${JSON.stringify(this.params)}`;
    }

    /**
     * 你的辅助方法
     */
    async _calculateValue(seed, gameData) {
        // 实现你的计算逻辑
        // 可以复用 RNG 适配器:
        // const rng = new CSRandom(getRandomSeed(...));
        // return rng.Next(1, 100);

        return 0; // 示例返回值
    }
}

module.exports = YourConditionName;