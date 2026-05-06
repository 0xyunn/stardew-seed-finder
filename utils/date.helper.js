/**
 * 日期工具 - Stardew 日期计算辅助
 */

/**
 * 获取一年中的第几天 (1-112)
 * @param {number} seasonIndex - 0=春,1=夏,2=秋,3=冬
 * @param {number} day - 1-28
 * @param {number} year - 年份
 * @returns {number}
 */
function getDayOfYear(seasonIndex, day, year = 1) {
    return (seasonIndex * 28) + day + ((year - 1) * 112);
}

/**
 * 解析一年中的天数
 * @param {number} dayOfYear
 * @returns {{season: string, day: number, year: number}}
 */
function parseDayOfYear(dayOfYear) {
    const year = Math.floor((dayOfYear - 1) / 112) + 1;
    const dayInYear = (dayOfYear - 1) % 112 + 1;
    const seasonIndex = Math.floor((dayInYear - 1) / 28);
    const day = ((dayInYear - 1) % 28) + 1;

    const seasons = ['spring', 'summer', 'fall', 'winter'];
    return {
        season: seasons[seasonIndex],
        day,
        year,
        seasonIndex
    };
}

/**
 * 检查是否是节日
 * @param {number} dayOfYear
 * @returns {string|null} 节日名称或 null
 */
function getFestival(dayOfYear) {
    const festivals = {
        13: 'Egg Festival',
        24: 'Flower Dance',
        39: 'Luau',
        56: 'Moonlight Jellies',
        72: 'Stardew Valley Fair',
        83: "Spirit's Eve",
        92: 'Festival of Ice',
        109: 'Winter Star'
    };
    return festivals[dayOfYear % 112] || null;
}

/**
 * 检查是否下雨天（基础概率，不考虑运气等）
 * @param {number} dayOfYear
 * @param {string} season
 * @returns {boolean}
 */
function isPotentialRainDay(dayOfYear, season) {
    // 节日不降雨
    if (getFestival(dayOfYear)) return false;

    // 冬季概率略低
    if (season === 'winter') return Math.random() < 0.15;

    // 夏季概率随日期增加
    if (season === 'summer') {
        const dayInSeason = ((dayOfYear - 1) % 28) + 1;
        return Math.random() < (0.12 + 0.003 * (dayInSeason - 1));
    }

    // 春秋基础概率
    return Math.random() < 0.183;
}

module.exports = {
    getDayOfYear,
    parseDayOfYear,
    getFestival,
    isPotentialRainDay
};