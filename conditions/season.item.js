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
    _predictNightEvent(seed, dayOfYear, year, dayAdjust, greenhouseUnlocked = false) {
        // 第 30 天固定地震
        if (dayOfYear === 30) return 'Earthquake';

        // predictor.js: rng = new CSRandom(getRandomSeed(day + 1 + dayAdjust, save.gameID / 2));
        // 注意参数顺序：第一个参数是 day+1+dayAdjust，第二个是 gameID/2
        // seed 是 BigInt，需要转换为 Number
        const rng = new CSRandom(getRandomSeed(dayOfYear + 1 + dayAdjust, Number(seed / 2n)));

        // 预滚动 10 次 (predictNight 中的 for(var i=0; i<10; i++) rng.NextDouble();)
        for (let i = 0; i < 10; i++) rng.NextDouble();

        const month = Math.floor((dayOfYear - 1) / 28) % 4; // 0=春，1=夏，2=秋，3=冬

        // 温室解锁检查：如果解锁了，会多一次 RNG 调用用于风暴判定
        let couldBeWindstorm = false;
        if (greenhouseUnlocked) {
            couldBeWindstorm = rng.NextDouble() < 0.1;
        }

        // 下一个随机数用于事件判定
        const nextRoll = rng.NextDouble();

        // 如果没有温室，复用 nextRoll 作为风暴判定
        if (!greenhouseUnlocked) {
            couldBeWindstorm = nextRoll < 0.1;
        }

        // 严格按 predictor 顺序判定
        // Fairy: nextRoll < 0.01 且不是冬季 (month%4 < 3)
        if (nextRoll < 0.01 && month < 3) return 'Fairy';
        
        // Witch: 需要 (day + 1 + dayAdjust) > 20
        if (rng.NextDouble() < 0.01 && (dayOfYear + 1 + dayAdjust) > 20) return 'Witch';
        
        // Meteor: 需要 (day + 1 + dayAdjust) > 5
        if (rng.NextDouble() < 0.01 && (dayOfYear + 1 + dayAdjust) > 5) return 'Meteor';
        
        // Stone Owl: 固定概率 0.005
        if (rng.NextDouble() < 0.005) return 'Stone Owl';
        
        // Strange Capsule: 固定概率 0.008 且年份 > 1
        if (rng.NextDouble() < 0.008 && year > 1) return 'Strange Capsule';

        return null; // 无事件
    }
}

module.exports = SeasonItemCondition;