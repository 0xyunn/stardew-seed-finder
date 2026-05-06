/**
 * 日志系统 - 基于 winston 的分级日志
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 自定义格式
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// 控制台输出格式（彩色）
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return `${timestamp} ${level}: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
        }`;
    })
);

// 创建主 logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'stardew-seed-finder' },
    transports: [
        // 错误日志单独文件
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            zippedArchive: true
        }),
        // 所有日志
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            level: 'debug',
            maxsize: 20 * 1024 * 1024,
            maxFiles: 10,
            zippedArchive: true
        })
    ]
});

// 开发环境输出到控制台
if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'info',
        stderrLevels: ['error', 'fatal']
    }));
}

// 添加子 logger 方法
logger.getChildLogger = function(name) {
    return logger.child({ component: name });
};

// 未捕获异常处理
process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught Exception', {
        message: error.message,
        stack: error.stack,
        pid: process.pid,
        memory: process.memoryUsage()
    });
    // 优雅退出
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise
    });
});

// 优雅关闭
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down...');
    logger.close(() => process.exit(0));
});

module.exports = logger;