const winston = require('winston');
const chalk = require('chalk');

// Define log levels and colors
const logLevels = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'cyan',
};

// Create Winston logger
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, service }) => {
            const color = logLevels[level] || 'white';
            const serviceTag = service ? chalk.blue(`[${service}]`) : '';
            return `${chalk.gray(`[${timestamp}]`)} ${serviceTag} ${chalk[color](level.toUpperCase())}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ],
});

// Create enhanced logger with specialized methods
function createServiceLogger(serviceName) {
    const baseLogger = logger.child({ service: serviceName });
    
    return {
        info: (message, meta) => {
            baseLogger.info(meta ? `${message} ${JSON.stringify(meta)}` : message);
        },
        warn: (message, meta) => {
            baseLogger.warn(meta ? `${message} ${JSON.stringify(meta)}` : message);
        },
        error: (message, error) => {
            if (error && error.stack) {
                baseLogger.error(`${message} - ${error.message}`);
                baseLogger.debug(error.stack);
            } else {
                baseLogger.error(message);
            }
        },
        debug: (message, meta) => {
            baseLogger.debug(meta ? `${message} ${JSON.stringify(meta)}` : message);
        },
        success: (message, meta) => {
            const coloredMessage = chalk.green(`✅ ${message}`);
            baseLogger.info(meta ? `${coloredMessage} ${JSON.stringify(meta)}` : coloredMessage);
        },
        serviceStarted: (serviceName, config) => {
            const coloredMessage = chalk.green(`🚀 ${serviceName} started successfully`);
            baseLogger.info(coloredMessage);
            if (config && typeof config === 'object') {
                Object.entries(config).forEach(([key, value]) => {
                    baseLogger.info(`   ${chalk.cyan(key)}: ${chalk.white(value)}`);
                });
            }
        },
        interestAccrual: (message, data) => {
            const coloredMessage = chalk.yellow(`💰 ${message}`);
            baseLogger.info(data ? `${coloredMessage} ${JSON.stringify(data)}` : coloredMessage);
        },
        liquidation: (message, data) => {
            const coloredMessage = chalk.red(`⚠️ ${message}`);
            baseLogger.info(data ? `${coloredMessage} ${JSON.stringify(data)}` : coloredMessage);
        },
        table: (title, data) => {
            baseLogger.info(chalk.blue.bold(`📊 ${title}`));
            if (data && typeof data === 'object') {
                Object.entries(data).forEach(([key, value]) => {
                    baseLogger.info(`   ${chalk.cyan(key)}: ${chalk.white(value)}`);
                });
            }
        },
        startup: (message) => {
            const coloredMessage = chalk.green.bold(`🎯 ${message}`);
            baseLogger.info(coloredMessage);
        },
        banner: (lines) => {
            if (Array.isArray(lines)) {
                lines.forEach(line => {
                    baseLogger.info(chalk.cyan(line));
                });
            } else {
                baseLogger.info(chalk.cyan(lines));
            }
        }
    };
}

// Legacy wrapper functions for backward compatibility
function logInfo(message, meta = '') {
    logger.info(`${message} ${meta}`);
}

function logWarning(message, meta = '') {
    logger.warn(`${message} ${meta}`);
}

function logError(message, meta = '') {
    logger.error(`${message} ${meta}`);
}

function logDebug(message, meta = '') {
    logger.debug(`${message} ${meta}`);
}

// Create service-specific loggers
const systemLogger = createServiceLogger('SYSTEM');
const bitcoinDataLogger = createServiceLogger('BITCOIN');
const dcaLogger = createServiceLogger('DCA');
const limitOrderLogger = createServiceLogger('LIMIT_ORDER');
const loanLogger = createServiceLogger('LOAN');
const liquidationLogger = createServiceLogger('LIQUIDATION');

// Export logging functions and categories
module.exports = {
    logInfo,
    logWarning,
    logError,
    logDebug,
    systemLogger,
    bitcoinDataLogger,
    dcaLogger,
    limitOrderLogger,
    loanLogger,
    liquidationLogger
};

