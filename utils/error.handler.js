/**
 * 异常处理器 - 统一错误处理和日志
 */
const logger = require('./logger');

/**
 * 错误类型枚举
 */
const ErrorTypes = {
    CONFIG: 'config_error',
    SEED_SCAN: 'seed_scan_error',
    CONDITION: 'condition_error',
    RNG: 'rng_error',
    FILE: 'file_error',
    UNKNOWN: 'unknown_error'
};

/**
 * 处理错误并记录日志
 * @param {Error} error
 * @param {string} type - 错误类型
 * @param {Object} context - 上下文信息
 * @returns {Error} 处理后的错误
 */
function handleError(error, type = ErrorTypes.UNKNOWN, context = {}) {
    const errorInfo = {
        type,
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version
    };

    // 分级记录
    if (type === ErrorTypes.CONFIG || type === ErrorTypes.FILE) {
        logger.error(`Configuration error: ${error.message}`, errorInfo);
    } else if (type === ErrorTypes.SEED_SCAN) {
        logger.warn(`Scan interrupted: ${error.message}`, errorInfo);
    } else {
        logger.error(`Unexpected error [${type}]: ${error.message}`, errorInfo);
    }

    // 返回友好的错误对象
    return new Error(`[${type}] ${error.message}`, { cause: error });
}

/**
 * 验证并转换错误
 * @param {*} value
 * @param {string} fieldName
 * @returns {void}
 * @throws {Error}
 */
function validate(value, fieldName) {
    if (value === undefined || value === null) {
        throw new Error(`${fieldName} is required`);
    }
    if (typeof value === 'string' && value.trim() === '') {
        throw new Error(`${fieldName} cannot be empty`);
    }
}

/**
 * 安全执行异步函数
 * @param {Function} fn
 * @param {string} operation
 * @returns {Promise<*|null>}
 */
async function safeExecute(fn, operation = 'operation') {
    try {
        return await fn();
    } catch (error) {
        logger.error(`${operation} failed: ${error.message}`);
        return null;
    }
}

/**
 * 重试执行
 * @param {Function} fn
 * @param {Object} options
 * @param {number} options.maxRetries - 最大重试次数
 * @param {number} options.delay - 重试间隔(ms)
 * @returns {Promise<*|null>}
 */
async function withRetry(fn, { maxRetries = 3, delay = 100 } = {}) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            logger.debug(`Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }

    throw lastError;
}

module.exports = {
    handleError,
    ErrorTypes,
    validate,
    safeExecute,
    withRetry
};