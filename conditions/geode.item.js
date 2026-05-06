/**
 * 晶球物品条件 - 检查敲晶球是否出指定物品
 */
const BaseCondition = require('./base.condition');
const { getRandomSeed, CSRandom } = require('../core/rng.adapter');

class GeodeItemCondition extends BaseCondition {
    constructor() {
        super('geode_item', 7);
        // 晶球内容映射（简化版）
        this.geodeContents = {
            'Geode': ['Alamite', 'Calcite', 'Jamborite', 'Nekoite', 'Orpiment', 'Petrified Slime', 'Thunder Egg'],
            'Frozen Geode': ['Aerinite', 'Dolomite', 'Esperite', 'Fluorapatite', 'Geminite', 'Kyanite', 'Lunarite'],
            'Magma Geode': ['Bixite', 'Helvite', 'Jagoite', 'Neptunite', 'Lemon Stone', 'Ocean Stone', 'Ghost Crystal'],
            'Omni Geode': ['Prismatic Shard', 'Diamond', 'Ancient Doll', 'Dwarf Gadget'] // 简化
        };
    }

    validateParams(params) {
        const result = super.validateParams(params);
        if (!result.valid) return result;

        const validGeodes = ['Geode', 'Frozen Geode', 'Magma Geode', 'Omni Geode'];
        if (params.geodeType && !validGeodes.includes(params.geodeType)) {
            result.errors.push(`Invalid geodeType. Must be one of: ${validGeodes.join(', ')}`);
        }

        if (!params?.items || !Array.isArray(params.items)) {
            result.errors.push('items must be an array');
        }

        if (params.crackCount !== undefined &&
            (!Number.isInteger(params.crackCount) || params.crackCount < 1)) {
            result.errors.push('crackCount must be a positive integer');
        }

        return result;
    }

    async evaluate(seed, gameData) {
        const {
            items,
            geodeType = 'Omni Geode',
            crackCount = 1,
            mustHave = false,
            playerIndex = 0 // 多人游戏玩家索引
        } = this.params;

        let foundItems = [];
        let score = 0;

        // 模拟敲指定数量的晶球
        for (let i = 1; i <= crackCount; i++) {
            const result = await this._crackGeode(seed, i, geodeType, gameData, playerIndex);

            if (result?.itemName && this._includesIgnoreCase(result.itemName, items)) {
                foundItems.push({
                    crackNumber: i,
                    item: result.itemName,
                    geode: result.geodeType
                });
                // 稀有物品加分
                const rarityBonus = this._getRarityBonus(result.itemName);
                score += 15 + rarityBonus;
            }
        }

        // 评分
        if (mustHave) {
            score = foundItems.length > 0 ? 100 + foundItems.length * 3 : -80;
        } else {
            score = foundItems.length * 12;
        }

        return {
            score: score * this.weight,
            details: {
                found: foundItems,
                expected: items,
                geodeType,
                crackCount,
                matched: foundItems.length > 0
            }
        };
    }

    /**
     * 模拟敲晶球
     */
    async _crackGeode(seed, crackNumber, geodeType, gameData, playerIndex) {
        // 使用 predictor 的 RNG 逻辑
        const rngSeed = getRandomSeed(
            crackNumber,
            seed / BigInt(2),
            BigInt(playerIndex) % BigInt(10000)
        );
        const rng = new CSRandom(rngSeed);

        // 预热的随机调用（复刻游戏逻辑）
        const prewarm = rng.Next(1, 10);
        for (let i = 0; i < prewarm; i++) {
            rng.NextDouble();
        }

        // 选择物品
        const contents = this.geodeContents[geodeType] || [];
        if (contents.length === 0) return null;

        const itemIndex = rng.Next(contents.length);
        const itemName = contents[itemIndex];

        // 特殊：极低概率出棱镜碎片
        if (geodeType === 'Omni Geode' && rng.NextDouble() < 0.008 && crackNumber > 15) {
            return { itemName: 'Prismatic Shard', geodeType };
        }

        return { itemName, geodeType };
    }

    /**
     * 物品稀有度加分
     */
    _getRarityBonus(itemName) {
        const rare = ['Prismatic Shard', 'Diamond', 'Ancient Doll', 'Dwarf Gadget'];
        const uncommon = ['Thunder Egg', 'Ghost Crystal', 'Ocean Stone'];

        const name = itemName?.toLowerCase();
        if (rare.some(r => name?.includes(r.toLowerCase()))) return 25;
        if (uncommon.some(u => name?.includes(u.toLowerCase()))) return 10;
        return 0;
    }

    getDescription() {
        const { items, geodeType, crackCount, mustHave } = this.params;
        return `geode_item: ${mustHave ? 'Must get' : 'Bonus for'} [${items?.join(', ')}] from ${crackCount}x ${geodeType}`;
    }
}

module.exports = GeodeItemCondition;