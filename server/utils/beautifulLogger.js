const winston = require('winston');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Beautiful console formatter
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const timeColor = chalk.gray(`[${timestamp}]`);
        const serviceTag = service ? chalk.blue(`[${service}]`) : '';
        
        let levelIcon = '';
        let levelColor = '';
        
        switch (level) {
            case 'error':
                levelIcon = '❌';
                levelColor = chalk.red;
                break;
            case 'warn':
                levelIcon = '⚠️ ';
                levelColor = chalk.yellow;
                break;
            case 'info':
                levelIcon = '✅';
                levelColor = chalk.green;
                break;
            case 'debug':
                levelIcon = '🔍';
                levelColor = chalk.cyan;
                break;
            default:
                levelIcon = 'ℹ️ ';
                levelColor = chalk.white;
        }
        
        const metaString = Object.keys(meta).length > 0 ? chalk.dim(` ${JSON.stringify(meta)}`) : '';
        
        return `${timeColor} ${levelIcon} ${serviceTag} ${levelColor(message)}${metaString}`;
    })
);

// File format (simpler for log files)
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console({
            format: consoleFormat,
            level: 'info'
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: fileFormat
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: fileFormat
        })
    ]
});

// Beautiful Logger Class
class BeautifulLogger {
    constructor(serviceName = 'SYSTEM') {
        this.serviceName = serviceName;
    }

    info(message, meta = {}) {
        logger.info(message, { service: this.serviceName, ...meta });
    }

    success(message, meta = {}) {
        logger.info(message, { service: this.serviceName, ...meta });
    }

    warn(message, meta = {}) {
        logger.warn(message, { service: this.serviceName, ...meta });
    }

    error(message, meta = {}) {
        logger.error(message, { service: this.serviceName, ...meta });
    }

    debug(message, meta = {}) {
        logger.debug(message, { service: this.serviceName, ...meta });
    }

    // Special methods for specific scenarios
    serviceStarted(serviceName, details = {}) {
        this.info(`${serviceName} started`, details);
    }

    serviceError(serviceName, error, details = {}) {
        this.error(`${serviceName} error: ${error.message}`, { 
            stack: error.stack, 
            ...details 
        });
    }

    liquidation(loanId, details = {}) {
        this.info(`Liquidation executed for Loan ${loanId}`, details);
    }

    interestAccrual(loanCount, totalInterest) {
        this.info(`Daily interest accrual completed`, {
            loansProcessed: loanCount,
            totalInterest: `₹${totalInterest}`
        });
    }

    loanWarning(loanId, userId, currentLTV) {
        this.warn(`Loan approaching liquidation`, {
            loanId,
            userId,
            currentLTV: `${currentLTV}%`,
            threshold: '90%'
        });
    }

    // ASCII Art and Banners
    startupBanner() {
        const banner = chalk.cyan(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║        🚀 ₿itTrade Server v2.0 - Loan Management System     ║
    ║             Bitcoin Trading & Collateralized Loans          ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
        `);
        console.log(banner);
    }

    separator() {
        console.log(chalk.gray('════════════════════════════════════════════════════════════════'));
    }

    serviceStatus(services) {
        console.log(chalk.cyan('\n📊 Service Status Dashboard'));
        this.separator();
        
        Object.entries(services).forEach(([name, status]) => {
            const icon = status === 'running' ? '✅' : status === 'stopped' ? '❌' : '⚠️ ';
            const color = status === 'running' ? chalk.green : status === 'stopped' ? chalk.red : chalk.yellow;
            const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            console.log(`${icon} ${displayName}: ${color(status)}`);
        });
        
        this.separator();
    }

    table(title, data) {
        console.log(chalk.cyan(`\n📋 ${title}`));
        this.separator();
        
        data.forEach(row => {
            console.log(`${row.icon || '•'} ${row.label}: ${chalk.bold(row.value)}`);
        });
        
        this.separator();
    }

    liquidationSummary(results) {
        console.log(chalk.yellow('\n⚡ Liquidation Monitor Results'));
        this.separator();
        
        results.forEach(result => {
            const { loanId, userId, btcSold, inrReceived, newLtv, liquidationType } = result;
            
            console.log(`🔧 Loan ${loanId}:`);
            console.log(`   👤 User: ${userId}`);
            console.log(`   🪙 BTC Sold: ${btcSold} BTC`);
            console.log(`   💰 INR Received: ₹${inrReceived.toLocaleString()}`);
            console.log(`   📊 New LTV: ${newLtv.toFixed(2)}%`);
            console.log(`   🎯 Type: ${liquidationType}`);
            console.log();
        });
        
        this.separator();
    }

    processingIndicator(message, items = []) {
        console.log(chalk.blue(`\n🔄 ${message}`));
        items.forEach(item => {
            console.log(`   ${item.icon || '•'} ${item.text}`);
        });
        console.log();
    }

    completionSummary(message, stats = {}) {
        console.log(chalk.green(`\n✅ ${message}`));
        Object.entries(stats).forEach(([key, value]) => {
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            console.log(`   📊 ${displayKey}: ${chalk.bold(value)}`);
        });
        console.log();
    }
}

// Export singleton instances for different services
module.exports = {
    BeautifulLogger,
    systemLogger: new BeautifulLogger('SYSTEM'),
    liquidationLogger: new BeautifulLogger('LIQUIDATION'),
    interestLogger: new BeautifulLogger('INTEREST'),
    loanLogger: new BeautifulLogger('LOAN'),
    bitcoinLogger: new BeautifulLogger('BITCOIN'),
    dbLogger: new BeautifulLogger('DATABASE'),
    authLogger: new BeautifulLogger('AUTH'),
    adminLogger: new BeautifulLogger('ADMIN')
};
