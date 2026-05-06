/**
 * RNG 适配器 - 1:1 复刻 Stardew Predictor 核心逻辑
 */
const bigInt = require('big-integer');
const XXH = require('xxhashjs');

class CSRandom {
    constructor(seed) {
        // Stardew 使用 31 位正整数种子
        this._state = ((Number(seed) % 2147483647) + 2147483647) % 2147483647;
    }

    Next(max) {
        if (max <= 0) return 0;
        // 线性同余生成器 (LCG)
        this._state = (this._state * 1103515245 + 12345) & 0x7FFFFFFF;
        return Math.abs(this._state) % max;
    }

    NextDouble() {
        return this.Next(10000) / 10000;
    }
}

function getHashFromString(value) {
    if (!value) return 0;
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    return XXH.h32(0).update(data).digest().toNumber() >>> 0;
}

function getHashFromArray(...values) {
    const mod = 2147483647;
    const array = new Int32Array(values.map(v => ((Number(v) % mod) + mod) % mod));
    return XXH.h32(0).update(array.buffer).digest().toNumber() >>> 0;
}

function getRandomSeed(a = 0, b = 0, c = 0, d = 0, e = 0) {
    // Stardew 1.6+ 默认使用 getHashFromArray
    return getHashFromArray(a, b, c, d, e);
}

module.exports = { CSRandom, getHashFromString, getHashFromArray, getRandomSeed };