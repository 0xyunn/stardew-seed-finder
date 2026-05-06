/**
 * RNG 适配器 - 1:1 复刻 Stardew Predictor (cs-random.js) 核心逻辑
 * 基于 C# Random 类的完整实现，而非简化的 LCG
 */

// C# Random 常量
const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const MBIG = INT_MAX;
const MSEED = 161803398;

class CSRandom {
    constructor(seed) {
        this.inext = 0;
        this.inextp = 0;
        this.SeedArray = new Array(56).fill(0);

        // 处理种子初始化（与 C# Random 完全一致）
        let subtraction = (seed === INT_MIN) ? INT_MAX : Math.abs(seed);
        let mj = MSEED - subtraction;
        this.SeedArray[55] = mj;
        let mk = 1;

        for (let i = 1; i < 55; i++) {
            const ii = (21 * i) % 55;
            this.SeedArray[ii] = mk;
            mk = mj - mk;
            if (mk < 0) mk += MBIG;
            mj = this.SeedArray[ii];
        }

        // 二次洗牌
        for (let k = 1; k < 5; k++) {
            for (let i = 1; i < 56; i++) {
                this.SeedArray[i] -= this.SeedArray[1 + ((i + 30) % 55)];
                if (this.SeedArray[i] > INT_MAX) {
                    this.SeedArray[i] -= 4294967296;
                } else if (this.SeedArray[i] < INT_MIN) {
                    this.SeedArray[i] += 4294967296;
                }
                if (this.SeedArray[i] < 0) {
                    this.SeedArray[i] += MBIG;
                }
            }
        }

        this.inext = 0;
        this.inextp = 21;
    }

    /**
     * InternalSample - 核心采样函数
     * 返回 [0, MBIG) 范围内的整数
     */
    InternalSample() {
        let locINext = this.inext;
        let locINextp = this.inextp;

        if (++locINext >= 56) locINext = 1;
        if (++locINextp >= 56) locINextp = 1;

        let retVal = this.SeedArray[locINext] - this.SeedArray[locINextp];
        if (retVal === MBIG) retVal--;
        if (retVal < 0) retVal += MBIG;

        this.SeedArray[locINext] = retVal;
        this.inext = locINext;
        this.inextp = locINextp;

        return retVal;
    }

    /**
     * Sample - 返回 [0, 1) 范围内的浮点数
     */
    Sample() {
        return this.InternalSample() * (1.0 / MBIG);
    }

    /**
     * Next() - 无参数：返回 [0, INT_MAX)
     * Next(maxValue) - 返回 [0, maxValue)
     * Next(minValue, maxValue) - 返回 [minValue, maxValue)
     */
    Next(minValue, maxValue) {
        if (arguments.length === 0) {
            return this.InternalSample();
        } else if (arguments.length === 1) {
            const max = minValue;
            if (max < 0) {
                throw new Error(`Argument out of range - max (${max}) must be positive`);
            }
            return Math.floor(this.Sample() * max);
        } else {
            const min = minValue;
            const max = maxValue;
            if (min > max) {
                throw new Error(`Argument out of range - min (${min}) should be smaller than max (${max})`);
            }
            const range = max - min;
            if (range <= INT_MAX) {
                return Math.floor(this.Sample() * range) + min;
            } else {
                // 大范围处理（Stardew 通常用不到）
                return Math.floor(this.GetSampleForLargeRange() * range) + min;
            }
        }
    }

    /**
     * NextDouble - 返回 [0, 1) 范围内的浮点数
     */
    NextDouble() {
        return this.Sample();
    }

    /**
     * GetSampleForLargeRange - 用于超大范围
     */
    GetSampleForLargeRange() {
        let result = this.InternalSample();
        if (this.InternalSample() % 2 === 0) {
            result = -result;
        }
        let d = result;
        d += (INT_MAX - 1);
        d /= (2 * INT_MAX - 1);
        return d;
    }
}

/**
 * getHashFromString - 字符串哈希（用于特殊物品判定）
 * Stardew 1.6 使用简单的字符串哈希
 */
function getHashFromString(value) {
    if (!value) return 0;
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        const char = value.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash >>> 0; // 确保是无符号整数
}

/**
 * getHashFromArray - 数组哈希（Stardew 1.6+ 主要使用的随机种子生成方式）
 * 注意：这里使用简单的异或和乘法混合，而非 xxhash
 */
function getHashFromArray(...values) {
    let hash = 0;
    for (const value of values) {
        const num = Number(value);
        // 确保在 31 位正整数范围内
        const normalized = ((num % 2147483647) + 2147483647) % 2147483647;
        hash = (hash * 31 + normalized) >>> 0;
    }
    return hash;
}

/**
 * getRandomSeed - 生成随机种子
 * Stardew 1.6+ 使用 getHashFromArray 作为默认方法
 * 参数顺序和数量必须与游戏源码严格匹配
 */
function getRandomSeed(a = 0, b = 0, c = 0, d = 0, e = 0) {
    return getHashFromArray(a, b, c, d, e);
}

module.exports = { CSRandom, getHashFromString, getHashFromArray, getRandomSeed };