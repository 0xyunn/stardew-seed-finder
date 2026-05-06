#!/usr/bin/env node
/**
 * Stardew Seed Finder - Main Entry Point
 * Backend-only multi-condition seed search program
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const logger = require('./utils/logger');
const ConditionRegistry = require('./conditions');
const SeedScanner = require('./core/seed.scanner');
const ConfigLoader = require('./config/config.loader');
const ResultFormatter = require('./output/result.formatter');

// 命令行配置
program
    .name('stardew-seed-finder')
    .description('Multi-condition Stardew Valley seed searcher (backend only)')
    .version('1.0.0')
    .option('-c, --config <path>', 'Path to config file', 'config/default.config.json')
    .option('-o, --output <path>', 'Output file path', 'results.json')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-l, --list-conditions', 'List available condition types')
    .option('-d, --dry-run', 'Validate config without running search')
    .parse();

const options = program.opts();

// 启用详细日志
if (options.verbose) {
    process.env.LOG_LEVEL = 'debug';
}

/**
 * 主函数
 */
async function main() {
    const startTime = Date.now();

    try {
        logger.info('🎮 Stardew Seed Finder starting...');

        // 1. 列出条件类型（如果请求）
        if (options.listConditions) {
            ConditionRegistry.loadFromDirectory(path.join(__dirname, 'conditions'));
            console.log('\n📋 Available condition types:');
            ConditionRegistry.getAvailableTypes().forEach(type => {
                console.log(`  - ${type}`);
            });
            process.exit(0);
        }

        // 2. 加载配置
        logger.info(`📄 Loading config: ${options.config}`);
        const config = ConfigLoader.load(options.config);

        // 3. 验证配置（干跑模式）
        if (options.dryRun) {
            logger.info('✅ Config validation passed (dry run)');
            console.log('Config is valid. Use without --dry-run to run actual search.');
            process.exit(0);
        }

        // 4. 初始化条件系统
        logger.info('🔧 Initializing condition system...');
        ConditionRegistry.loadFromDirectory(path.join(__dirname, 'conditions'));

        // 5. 创建扫描器
        const scanner = new SeedScanner(config);

        // 6. 注册条件实例
        let activeConditions = 0;
        for (const condConfig of config.conditions) {
            const condition = ConditionRegistry.create(condConfig);
            if (scanner.addCondition(condition)) {
                activeConditions++;
            }
        }

        if (activeConditions === 0) {
            logger.warn('⚠️  No conditions enabled - all seeds will score 0');
        } else {
            logger.info(`✅ Loaded ${activeConditions} active condition(s)`);
        }

        // 7. 执行搜索（带进度回调）
        console.log('\n🔍 Scanning seeds...');
        const results = await scanner.scan({
            progressCallback: (progress) => {
                // 简单进度显示
                const bar = '█'.repeat(Math.floor(progress.percent / 5)) +
                    '░'.repeat(20 - Math.floor(progress.percent / 5));
                process.stdout.write(
                    `\r📊 [${bar}] ${progress.percent}% | Found: ${progress.found} | ` +
                    `Elapsed: ${Math.floor(progress.elapsed / 1000)}s`
                );
            }
        });

        console.log('\n');

        // 8. 输出结果
        if (results.length === 0) {
            logger.warn('⚠️  No matching seeds found');
            console.log('❌ No seeds matched your criteria.');
            console.log('💡 Try: relaxing conditions, expanding seed range, or reducing weight thresholds');
        } else {
            logger.info(`✅ Found ${results.length} matching seed(s)`);

            // 格式化输出
            const output = ResultFormatter.format(results, {
                meta: {
                    timestamp: new Date().toISOString(),
                    config: options.config,
                    conditions: config.conditions.filter(c => c.enabled).map(c => c.type),
                    seedRange: config.search.seedRange,
                    gameVersion: config.game.version
                }
            });

            // 写入文件
            fs.writeFileSync(options.output, JSON.stringify(output, null, 2), 'utf8');
            logger.info(`💾 Results saved to: ${options.output}`);

            // 控制台摘要
            console.log('\n🏆 Top Results:');
            results.forEach((r, i) => {
                console.log(`\n#${r.rank} Seed: ${r.seed}`);
                console.log(`   Score: ${r.score.toFixed(2)} | Grade: ${getGrade(r.score)}`);
                
                // 展示详细条件信息
                if (r.details && Object.keys(r.details).length > 0) {
                    console.log(`   Conditions Met:`);
                    for (const [condName, condDetails] of Object.entries(r.details)) {
                        if (condDetails) {
                            // 根据不同条件类型格式化输出
                            let conditionDesc = '';
                            
                            if (condName.includes('CartItem') || condName.includes('cartItem')) {
                                const items = condDetails.items || condDetails.found || [];
                                conditionDesc = `[Cart Item] Items: ${items.join(', ')}`;
                            } else if (condName.includes('WeatherRain') || condName.includes('weatherRain')) {
                                const days = condDetails.rainDays || condDetails.days || 'N/A';
                                const minDays = condDetails.minDays || 'N/A';
                                conditionDesc = `[Weather Rain] Days: ${days} (Min: ${minDays})`;
                            } else if (condName.includes('SeasonItem') || condName.includes('seasonItem')) {
                                const events = condDetails.events || condDetails.found || [];
                                conditionDesc = `[Season Event] Events: ${events.join(', ')}`;
                            } else {
                                // 通用格式
                                const found = condDetails.found || condDetails.value || 'N/A';
                                conditionDesc = `[${condName}] ${JSON.stringify(found)}`;
                            }
                            
                            const weight = r.breakdown?.[condName] !== undefined ? `(Weight: ${r.breakdown[condName]})` : '';
                            console.log(`   - ${conditionDesc} ${weight}`);
                        }
                    }
                }
                
                console.log('------------------------------------------------------------');
            });
        }

        // 9. 性能统计
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const range = config.search.seedRange;
        const total = range.max - range.min + 1;
        logger.info(`⏱️  Processed ${total.toLocaleString()} seeds in ${elapsed}s`);
        logger.info(`⚡ Average: ${((total / elapsed) | 0).toLocaleString()} seeds/sec`);

    } catch (error) {
        logger.fatal('💥 Application error:', error);
        console.error('\n❌ Fatal error:', error.message);
        if (error.stack && process.env.LOG_LEVEL === 'debug') {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

/**
 * 获取等级标识
 */
function getGrade(score) {
    if (score >= 900) return 'S+';
    if (score >= 800) return 'S';
    if (score >= 700) return 'A';
    if (score >= 600) return 'B';
    if (score >= 400) return 'C';
    if (score >= 200) return 'D';
    return 'F';
}

// 启动
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, getGrade };