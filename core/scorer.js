/**
 * 评分引擎 - 计算种子综合得分
 */
const logger = require('../utils/logger');

class Scorer {
    /**
     * 计算最终得分
     * @param {number} rawScore - 原始总分
     * @param {Object} breakdown - 各条件得分明细
     * @param {Array} conditions - 条件列表
     * @returns {number} 归一化后的最终得分 (0-1000)
     */
    calculate(rawScore, breakdown, conditions) {
        if (rawScore < 0) return 0; // 负分直接归零

        // 1. 权重归一化
        const totalWeight = conditions.reduce((sum, c) => sum + c.weight, 0);
        if (totalWeight === 0) return Math.min(1000, rawScore);

        const weightedScore = rawScore / totalWeight;

        // 2. 惩罚机制：关键条件未满足
        const criticalFailures = Object.entries(breakdown)
            .filter(([_, score]) => score < -50)
            .length;

        if (criticalFailures > 0) {
            // 每个关键失败乘以0.1的惩罚
            return Math.max(0, weightedScore * Math.pow(0.1, criticalFailures));
        }

        // 3. 奖励机制：多维度均衡
        const positiveScores = Object.values(breakdown).filter(s => s > 0);
        if (positiveScores.length >= conditions.length * 0.8 && conditions.length > 1) {
            // 80%以上条件都满足，额外奖励10-20%
            const bonus = 1 + (positiveScores.length / conditions.length) * 0.2;
            return Math.min(1000, weightedScore * bonus);
        }

        // 4. S型曲线归一化到0-1000
        return this._sigmoidNormalize(weightedScore, 0, 1000);
    }

    /**
     * S型曲线归一化
     * @private
     */
    _sigmoidNormalize(value, min, max) {
        // 将值映射到0-1（假设100分为满分基准）
        const normalized = Math.max(0, Math.min(1, value / 100));
        // S型曲线：中等分数更分散，极端分数更集中
        const steepness = 5;
        const midpoint = 0.5;
        const sigmoid = 1 / (1 + Math.exp(-steepness * (normalized - midpoint)));
        return min + sigmoid * (max - min);
    }

    /**
     * 生成评分报告
     * @param {Object} seedResult
     * @returns {Object}
     */
    generateReport(seedResult) {
        return {
            seed: seedResult.seed.toString(),
            totalScore: seedResult.totalScore.toFixed(2),
            grade: this._getGrade(seedResult.totalScore),
            breakdown: Object.entries(seedResult.breakdown || {})
                .map(([condition, score]) => ({
                    condition,
                    score: score.toFixed(2),
                    grade: this._getGrade(score)
                })),
            highlights: this._extractHighlights(seedResult.details || {})
        };
    }

    /**
     * 获取等级标识
     * @private
     */
    _getGrade(score) {
        if (score >= 900) return 'S+';
        if (score >= 800) return 'S';
        if (score >= 700) return 'A';
        if (score >= 600) return 'B';
        if (score >= 400) return 'C';
        if (score >= 200) return 'D';
        return 'F';
    }

    /**
     * 提取亮点信息
     * @private
     */
    _extractHighlights(details) {
        const highlights = [];

        for (const [condition, detail] of Object.entries(details)) {
            if (detail?.found?.length > 0) {
                highlights.push(`${condition}: Found ${detail.found.length} item(s)`);
            }
            if (detail?.matched === true) {
                highlights.push(`${condition}: ✓ Matched`);
            }
            if (detail?.inRange === true) {
                highlights.push(`${condition}: ✓ In range`);
            }
        }

        return highlights;
    }

    /**
     * 比较两个结果
     * @param {Object} a
     * @param {Object} b
     * @returns {number}
     */
    static compare(a, b) {
        return b.totalScore - a.totalScore;
    }
}

module.exports = Scorer;