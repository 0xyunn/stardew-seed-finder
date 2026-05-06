const BaseCondition = require('./base.condition');
const { getRandomSeed, CSRandom, getHashFromString } = require('../core/rng.adapter');

class WeatherRainCondition extends BaseCondition {
    constructor() { super('weatherRain', 5); }

    validateParams(params) {
        const result = super.validateParams(params);
        const validSeasons = ['spring', 'summer', 'fall', 'winter'];
        if (!params?.season || !validSeasons.includes(params.season.toLowerCase())) {
            result.errors.push('Invalid season');
        }
        return result;
    }

    async evaluate(seed, gameData) {
        const { minDays = 0, maxDays = 28 } = this.params;
        // 从 gameData 获取季节信息，如果没有则使用 params 中的
        const season = gameData?.season || this.params.season;
        const year = gameData?.year || this.params.year || 1;
        
        if (!season) {
            return { score: -100, details: { error: 'Season is required' } };
        }
        
        const seasonIndex = ['spring', 'summer', 'fall', 'winter'].indexOf(season.toLowerCase());
        let rainCount = 0;
        const rainDays = [];
        const dayAdjust = 0; // 新游戏默认为 0

        for (let day = 1; day <= 28; day++) {
            const dayOfYear = (seasonIndex * 28) + day + ((year - 1) * 112);

            // 节日绝对不下雨
            if (this._isFestival(dayOfYear)) continue;

            let isRainy = false;
            if (seasonIndex === 1) { // Summer
                // predictor.js 逻辑: getRandomSeed(day-1, gameID/2, getHashFromString("summer_rain_chance"))
                const rng = new CSRandom(getRandomSeed(dayOfYear - 1 + dayAdjust, seed / 2, getHashFromString('summer_rain_chance')));
                const rainChance = 0.12 + 0.003 * (day - 1);
                isRainy = rng.NextDouble() < rainChance;
            } else {
                // predictor.js 逻辑: getRandomSeed(getHashFromString("location_weather"), gameID, day-1)
                const rng = new CSRandom(getRandomSeed(getHashFromString('location_weather'), seed, dayOfYear - 1 + dayAdjust));
                isRainy = rng.NextDouble() < 0.183;
            }

            if (isRainy) {
                rainCount++;
                rainDays.push(day);
            }
        }

        // 评分逻辑
        let score = 0;
        const inRange = rainCount >= minDays && (maxDays === null || rainCount <= maxDays);
        if (inRange) {
            score = 100;
            // 奖励：接近理想中间值
            const ideal = maxDays === null ? minDays : (minDays + maxDays) / 2;
            score += Math.max(0, 20 - Math.abs(rainCount - ideal) * 2);
        } else if (rainCount < minDays) {
            score = Math.max(0, 50 - (minDays - rainCount) * 10);
        } else {
            score = Math.max(0, 80 - (rainCount - maxDays) * 5);
        }

        return {
            score: score * this.weight,
            details: { actual: rainCount, rainDays, expected: `${minDays}-${maxDays || '∞'}`, inRange }
        };
    }

    _isFestival(dayOfYear) {
        // predictor.js 中的节日列表
        return [13, 24, 39, 56, 72, 83, 92, 109].includes(dayOfYear % 112);
    }
}

module.exports = WeatherRainCondition;