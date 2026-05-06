const BaseCondition = require('./base.condition');
const { getRandomSeed, CSRandom } = require('../core/rng.adapter');

class SeasonItemCondition extends BaseCondition {
    constructor() { super('seasonItem', 10); }

    validateParams(params) {
        const result = super.validateParams(params);
        if (!params?.season || !['spring','summer','fall','winter'].includes(params.season.toLowerCase())) {
            result.errors.push('Invalid season');
        }
        if (params.items && !Array.isArray(params.items)) result.errors.push('items must be an array');
        return result;
    }

    async evaluate(seed, gameData) {
        const { season, year, items, mustHave = true, exactDay } = this.params;
        const seasonIndex = ['spring', 'summer', 'fall', 'winter'].indexOf(season.toLowerCase());
        let found = [];
        const dayAdjust = 0;

        const daysToCheck = exactDay ? [exactDay] : Array.from({length: 28}, (_, i) => i + 1);

        for (const day of daysToCheck) {
            const dayOfYear = (seasonIndex * 28) + day + ((year - 1) * 112);
            const event = this._predictNightEvent(seed, dayOfYear, year, dayAdjust);

            if (event) {
                // 忽略大小写和空格匹配
                const match = items.find(target =>
                    event.toLowerCase().replace(/ /g, '').includes(target.toLowerCase().replace(/ /g, '')) ||
                    target.toLowerCase().replace(/ /g, '').includes(event.toLowerCase().replace(/ /g, ''))
                );
                if (match) found.push({ day, event, matched: match });
            }
        }

        let score = 0;
        if (mustHave) {
            score = found.length > 0 ? (100 + found.length * 10) : -100;
        } else {
            score = found.length * 15;
        }

        return {
            score: score * this.weight,
            details: { found, expected: items, mustHave, matched: found.length > 0 }
        };
    }

    /**
     * 1:1 复刻 predictor.js 的 predictNight 逻辑
     */
    _predictNightEvent(seed, dayOfYear, year, dayAdjust) {
        // 第30天固定地震
        if (dayOfYear === 30) return 'Earthquake';

        // predictor.js: rng = new CSRandom(getRandomSeed(day + 1 + dayAdjust, save.gameID / 2));
        const rng = new CSRandom(getRandomSeed(dayOfYear + 1 + dayAdjust, seed / 2));

        // 预滚动 10 次 (predictNight 中的 for(var i=0; i<10; i++) rng.NextDouble();)
        for (let i = 0; i < 10; i++) rng.NextDouble();

        const month = Math.floor((dayOfYear - 1) / 28) % 4; // 0=春, 1=夏, 2=秋, 3=冬
        const nextRoll = rng.NextDouble();

        // 严格按 predictor 顺序判定
        if (nextRoll < 0.01 && month < 3) return 'Fairy';
        if (rng.NextDouble() < 0.01 && (dayOfYear + 1 + dayAdjust) > 20) return 'Witch';
        if (rng.NextDouble() < 0.01 && (dayOfYear + 1 + dayAdjust) > 5) return 'Meteor';
        if (rng.NextDouble() < 0.005) return 'Stone Owl';
        if (rng.NextDouble() < 0.008 && year > 1) return 'Strange Capsule';

        return null; // 无事件
    }
}

module.exports = SeasonItemCondition;