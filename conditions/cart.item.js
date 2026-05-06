/**
 * 旅行商物品条件 - 1:1 复刻 Stardew Predictor 1.6 逻辑
 * 对应源码函数：predictCart_1_6(), getCartItem(), getRandomItems()
 */
const BaseCondition = require('./base.condition');
const { getRandomSeed, CSRandom, getHashFromString } = require('../core/rng.adapter');

class CartItemCondition extends BaseCondition {
    constructor() {
        super('cartItem', 8);
        // 1.6 旅行商基础物品池（ID 2-789，符合价格/类型过滤的常见物品）
        // 注意：价格是动态生成的，不能在模块加载时固定 - 必须在模拟时使用 RNG 实时计算
        this.basicItemIds = [
            16, 24, 78, 88, 90, 128, 132, 136, 140, 144, 154, 164, 188, 190, 192, 248, 250, 254, 256, 258,
            260, 262, 264, 266, 268, 270, 272, 276, 278, 280, 281, 282, 284, 300, 304, 306, 329, 330, 334,
            335, 340, 342, 344, 346, 348, 368, 369, 370, 371, 376, 378, 380, 382, 384, 386, 396, 398, 400,
            402, 404, 406, 408, 410, 412, 414, 416, 418, 420, 421, 422, 424, 425, 426, 428, 430, 433, 436,
            438, 440, 442, 444, 446, 453, 455, 459, 463, 464, 465, 466, 472, 473, 474, 475, 476, 477, 478,
            479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 495, 496, 497,
            498, 499, 591, 593, 595, 597, 599, 604, 605, 606, 607, 608, 609, 610, 611, 612, 613, 614, 618,
            621, 628, 629, 630, 631, 632, 633, 634, 635, 636, 637, 638, 645, 648, 649, 651, 684, 685, 686,
            687, 691, 692, 693, 694, 695, 698, 699, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710,
            715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728, 729, 730, 731, 732, 733, 734
        ];
    }

    validateParams(params) {
        const result = super.validateParams(params);
        if (!result.valid) return result;

        const validSeasons = ['spring', 'summer', 'fall', 'winter'];
        if (!params?.season || !validSeasons.includes(params.season.toLowerCase())) {
            result.errors.push(`Invalid season. Must be one of: ${validSeasons.join(', ')}`);
        }
        if (!params?.items || !Array.isArray(params.items) || params.items.length === 0) {
            result.errors.push('items must be a non-empty array');
        }
        if (params.weekOffset !== undefined && (!Number.isInteger(params.weekOffset) || params.weekOffset < 0)) {
            result.errors.push('weekOffset must be a non-negative integer');
        }
        return result;
    }

    async evaluate(seed, gameData) {
        const {
            season,
            year,
            items,
            mustHave = false,
            weekOffset = 0
        } = this.params;

        const seasonIndex = ['spring', 'summer', 'fall', 'winter'].indexOf(season.toLowerCase());
        if (seasonIndex < 0) return { score: -100, details: { error: 'Invalid season' } };

        let foundItems = [];
        let score = 0;

        // 旅行商通常在周五 (5) 和周日 (7) 出现
        const cartDays = [5, 7];

        // 检查指定周数
        for (const dayOffset of cartDays) {
            const dayOfYear = (seasonIndex * 28) + dayOffset + ((year - 1) * 112) + (weekOffset * 7);
            const cartItems = await this._simulateCart1_6(seed, dayOfYear, items);

            for (const item of cartItems) {
                if (this._includesIgnoreCase(item.name, items)) {
                    foundItems.push({
                        day: dayOffset + weekOffset * 7,
                        item: item.name,
                        price: item.price,
                        quantity: item.quantity
                    });
                    score += 15;
                }
            }
        }

        // 评分逻辑
        if (mustHave) {
            score = foundItems.length > 0 ? (100 + foundItems.length * 5) : -100;
        } else {
            score = foundItems.length * 10;
        }

        return {
            score: score * this.weight,
            details: {
                found: foundItems,
                expected: items,
                season: `${season} Y${year}`,
                visitsChecked: cartDays.map(d => `Day ${d}`),
                matched: foundItems.length > 0
            }
        };
    }

    /**
     * 1:1 复刻 Stardew 1.6 旅行商库存生成逻辑
     * @param {bigint} seed - 游戏种子
     * @param {number} dayOfYear - 年中的第几天
     * @param {string[]} targetItems - 用户要查找的物品
     * @returns {Array} 匹配到的物品列表
     */
    async _simulateCart1_6(seed, dayOfYear, targetItems) {
        const matches = [];
        // 源码：new CSRandom(getRandomSeed(offset + days[i] + save.dayAdjust, save.gameID/2))
        // 注意：seed/2 必须转换为 Number，因为 BigInt 除法会向下取整
        const rngSeed = getRandomSeed(Number(dayOfYear), Number(seed / 2n));
        const rng = new CSRandom(rngSeed);

        const seasonIndex = Math.floor((dayOfYear - 1) / 28) % 4;
        let hasRareSeed = false;

        // 1. 基础物品 10 个槽位 - 严格按 Stardew 1.6 getRandomItems 逻辑
        // 源码：getRandomItems(rng, "objects", 2, 789, true, true, true, 10)
        const selectedItems = this._getRandomItems(rng, 2, 789, 10);

        for (const itemId of selectedItems) {
            // 动态计算价格 - 这是关键！不能用固定价格
            const basePrice = this._getItemBasePrice(itemId);
            // 源码价格逻辑：Math.max(rng.Next(1, 11) * 100, rng.Next(3, 6) * basePrice)
            const priceMultiplier1 = rng.Next(1, 11) * 100;
            const priceMultiplier2 = rng.Next(3, 6) * basePrice;
            const price = Math.max(priceMultiplier1, priceMultiplier2);
            
            // 10% 概率数量为 5
            const qty = rng.NextDouble() < 0.1 ? 5 : 1;

            const itemName = this._getItemName(itemId);
            if (this._includesIgnoreCase(itemName, targetItems)) {
                matches.push({ name: itemName, price, quantity: qty, itemId });
            }
            if (itemId === 434) hasRareSeed = true; // 434 = Rare Seed
        }

        // 2. 特殊物品判定 - 使用独立 RNG 种子
        const baseSyncSeed = dayOfYear;

        // Rare Seed (春夏季补充，如果基础池没出现)
        if (seasonIndex < 2 && !hasRareSeed) {
            const rngRareSeed = new CSRandom(getRandomSeed(getHashFromString('cart_raresesed'), Number(seed), baseSyncSeed));
            if (rngRareSeed.NextDouble() < 0.5 && this._includesIgnoreCase('Rare Seed', targetItems)) {
                const price = Math.max(rngRareSeed.Next(1, 11) * 100, rngRareSeed.Next(3, 6) * 1000);
                matches.push({ name: 'Rare Seed', price, quantity: 1, itemId: 434 });
            }
        }

        // Rarecrow / Snowman (秋冬季)
        if (seasonIndex >= 2) {
            const rngRarecrow = new CSRandom(getRandomSeed(getHashFromString('cart_rarecrow'), Number(seed), baseSyncSeed));
            if (rngRarecrow.NextDouble() < 0.4 && this._includesIgnoreCase('Rarecrow', targetItems)) {
                const price = Math.max(rngRarecrow.Next(1, 11) * 100, rngRarecrow.Next(3, 6) * 4000);
                matches.push({ name: 'Rarecrow (Snowman)', price, quantity: 1, itemId: 777 });
            }
        }

        // Coffee Bean (秋冬季)
        if (seasonIndex > 1) {
            const rngCoffee = new CSRandom(getRandomSeed(getHashFromString('cart_coffeebean'), Number(seed), baseSyncSeed));
            if (rngCoffee.NextDouble() < 0.25 && this._includesIgnoreCase('Coffee Bean', targetItems)) {
                const price = Math.max(rngCoffee.Next(1, 11) * 100, rngCoffee.Next(3, 6) * 2500);
                matches.push({ name: 'Coffee Bean', price, quantity: 1, itemId: 773 });
            }
        }

        // Red Fez
        const rngFez = new CSRandom(getRandomSeed(getHashFromString('cart_fez'), Number(seed), baseSyncSeed));
        if (rngFez.NextDouble() < 0.1 && this._includesIgnoreCase('Red Fez', targetItems)) {
            const price = Math.max(rngFez.Next(1, 11) * 100, rngFez.Next(3, 6) * 8000);
            matches.push({ name: 'Red Fez', price, quantity: 1, itemId: 778 });
        }

        // Catalogues & Tea Set & Skill Book (按需判定)
        if (targetItems.some(t => t.toLowerCase().includes('catalogue') || t.toLowerCase().includes('tea set') || t.toLowerCase().includes('book'))) {
            const rngCatalogues = [
                { key: 'cart_jojacatalogue', name: 'Joja Catalogue', basePrice: 30000, chance: 0.1 },
                { key: 'cart_junimocatalogue', name: 'Junimo Catalogue', basePrice: 70000, chance: 0.1 },
                { key: 'cart_retrocatalogue', name: 'Retro Catalogue', basePrice: 110000, chance: 0.1 },
                { key: 'cart_teaset', name: 'Tea Set', basePrice: 1000000, chance: 0.1 },
                { key: 'cart_skillbook', name: 'Skill Book', basePrice: 6000, chance: 0.05 }
            ];

            for (const spec of rngCatalogues) {
                const rngSpec = new CSRandom(getRandomSeed(getHashFromString(spec.key), Number(seed), baseSyncSeed));
                if (rngSpec.NextDouble() < spec.chance && this._includesIgnoreCase(spec.name, targetItems)) {
                    const price = Math.max(rngSpec.Next(1, 11) * 100, rngSpec.Next(3, 6) * spec.basePrice);
                    matches.push({ name: spec.name, price, quantity: 1 });
                }
            }
        }

        return matches;
    }

    /**
     * 模拟 getRandomItems - 从 ID 范围内选择指定数量的物品
     * @param {CSRandom} rng - RNG 实例
     * @param {number} minId - 最小 ID
     * @param {number} maxId - 最大 ID
     * @param {number} count - 选择数量
     * @returns {number[]} 选中的物品 ID 列表
     */
    _getRandomItems(rng, minId, maxId, count) {
        const validIds = this.basicItemIds.filter(id => id >= minId && id <= maxId);
        // Fisher-Yates 洗牌算法的前 count 步
        const result = [];
        const available = [...validIds];
        
        for (let i = 0; i < count && available.length > 0; i++) {
            const index = rng.Next(available.length);
            result.push(available[index]);
            // 移除已选项（用最后一个元素替换）
            available[index] = available[available.length - 1];
            available.pop();
        }
        
        return result;
    }

    /**
     * 获取物品基础价格（简化版）
     */
    _getItemBasePrice(itemId) {
        const priceMap = {
            16: 50, 24: 80, 78: 100, 88: 150, 90: 200,
            434: 1000, // Rare Seed
            773: 2500, // Coffee Bean
            777: 4000, // Rarecrow
            778: 8000  // Red Fez
        };
        return priceMap[itemId] || 100;
    }

    /**
     * 获取物品名称（简化版）
     */
    _getItemName(itemId) {
        const nameMap = {
            16: 'Parsnip', 24: 'Garlic', 78: 'Wild Horseradish',
            434: 'Rare Seed', 773: 'Coffee Bean', 777: 'Rarecrow', 778: 'Red Fez'
        };
        return nameMap[itemId] || `Item_${itemId}`;
    }

    getDescription() {
        const { season, year, items, weekOffset } = this.params;
        return `cartItem: [${items?.join(', ')}] at ${season} Y${year} week ${weekOffset || '1'}`;
    }
}

module.exports = CartItemCondition;
