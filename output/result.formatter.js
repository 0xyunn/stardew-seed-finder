/**
 * 结果格式化器 - 输出结果处理
 */

class ResultFormatter {
    /**
     * 格式化搜索结果
     * @param {Array} results - 扫描结果
     * @param {Object} options - 格式化选项
     * @returns {Object}
     */
    static format(results, options = {}) {
        const {
            meta = {},
            includeBreakdown = true,
            includeDetails = true,
            compact = false
        } = options;

        return {
            meta: {
                generated: new Date().toISOString(),
                version: '1.0.0',
                ...meta
            },
            summary: {
                totalFound: results.length,
                topSeed: results[0]?.seed || null,
                topScore: results[0]?.score?.toFixed(2) || null,
                averageScore: results.length > 0
                    ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(2)
                    : null
            },
            results: results.map((result, index) =>
                this._formatResult(result, index + 1, { includeBreakdown, includeDetails, compact })
            )
        };
    }

    /**
     * 格式化单个结果
     * @private
     */
    static _formatResult(result, rank, options) {
        const { includeBreakdown, includeDetails, compact } = options;

        const formatted = {
            rank,
            seed: result.seed,
            score: parseFloat(result.score.toFixed(2)),
            grade: this._getGrade(result.score)
        };

        if (includeBreakdown && result.breakdown) {
            formatted.breakdown = Object.entries(result.breakdown)
                .filter(([_, score]) => score !== 0)
                .reduce((acc, [condition, score]) => {
                    acc[condition] = {
                        score: parseFloat(score.toFixed(2)),
                        grade: this._getGrade(score)
                    };
                    return acc;
                }, {});
        }

        if (includeDetails && result.details && !compact) {
            formatted.details = result.details;
        }

        if (result.timestamp) {
            formatted.evaluatedAt = new Date(result.timestamp).toISOString();
        }

        return formatted;
    }

    /**
     * 获取等级
     * @private
     */
    static _getGrade(score) {
        if (score >= 900) return 'S+';
        if (score >= 800) return 'S';
        if (score >= 700) return 'A';
        if (score >= 600) return 'B';
        if (score >= 400) return 'C';
        if (score >= 200) return 'D';
        return 'F';
    }

    /**
     * 导出为 CSV
     * @param {Array} results
     * @returns {string}
     */
    static toCSV(results) {
        if (results.length === 0) return '';

        const headers = ['rank', 'seed', 'score', 'grade'];
        // 动态添加 breakdown 列
        const allConditions = [...new Set(
            results.flatMap(r => Object.keys(r.breakdown || {}))
        )];

        const rows = [
            [...headers, ...allConditions.map(c => `${c}_score`)].join(','),
            ...results.map(r => {
                const values = [
                    r.rank,
                    r.seed,
                    r.score.toFixed(2),
                    this._getGrade(r.score)
                ];
                // 添加各条件得分
                for (const cond of allConditions) {
                    values.push(r.breakdown?.[cond]?.toFixed(2) || '0');
                }
                return values.join(',');
            })
        ];

        return rows.join('\n');
    }

    /**
     * 导出为 Markdown 表格
     * @param {Array} results
     * @param {number} limit - 限制显示数量
     * @returns {string}
     */
    static toMarkdown(results, limit = 10) {
        const limited = results.slice(0, limit);

        let md = `## Top ${limited.length} Seeds\n\n`;
        md += '| Rank | Seed | Score | Grade | Highlights |\n';
        md += '|------|------|-------|-------|------------|\n';

        for (const r of limited) {
            const highlights = Object.entries(r.details || {})
                .filter(([_, d]) => d?.found?.length > 0 || d?.matched)
                .map(([k, d]) => {
                    if (d.found?.length > 0) return `${k}×${d.found.length}`;
                    if (d.matched) return `✓${k}`;
                    return k;
                })
                .slice(0, 3)
                .join(', ');

            md += `| ${r.rank} | \`${r.seed}\` | ${r.score.toFixed(1)} | ${this._getGrade(r.score)} | ${highlights || '-'} |\n`;
        }

        return md;
    }
}

module.exports = ResultFormatter;