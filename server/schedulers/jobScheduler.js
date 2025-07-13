const cron = require('node-cron');
const accrueInterestDaily = require('../jobs/accrueInterestDaily');
const { systemLogger } = require('../utils/beautifulLogger');

/**
 * Job Scheduler
 *
 * Manages all scheduled background jobs for the application.
 */
class JobScheduler {
  static jobs = new Map();
  static jobStatus = new Map();

  static start() {
    systemLogger.info('Starting job scheduler...');

    // Daily interest accrual at 12:01 AM IST
    const interestJob = cron.schedule('1 0 * * *', async () => {
      await this.runJobSafely('INTEREST_ACCRUAL', accrueInterestDaily);
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    this.jobs.set('INTEREST_ACCRUAL', interestJob);
    this.jobStatus.set('INTEREST_ACCRUAL', {
      lastRun: null,
      lastStatus: 'PENDING',
      lastError: null,
      runCount: 0
    });

    // For testing purposes - run every minute (comment out in production)
    // const testJob = cron.schedule('* * * * *', async () => {
    //   await this.runJobSafely('TEST_INTEREST_ACCRUAL', accrueInterestDaily);
    // });
    // this.jobs.set('TEST_INTEREST_ACCRUAL', testJob);

    systemLogger.success('Job scheduler started successfully');
    systemLogger.info('Scheduled jobs:', {
      interestAccrual: 'Daily at 12:01 AM IST',
      timezone: 'Asia/Kolkata'
    });
  }

  static async runJobSafely(jobName, jobFunction) {
    const startTime = Date.now();
    
    try {
      systemLogger.info(`Starting job: ${jobName}`);
      
      // Check if job is already running
      const status = this.jobStatus.get(jobName);
      if (status && status.lastStatus === 'RUNNING') {
        systemLogger.warn(`Job ${jobName} is already running, skipping`);
        return;
      }

      // Update job status
      this.jobStatus.set(jobName, {
        ...status,
        lastStatus: 'RUNNING',
        lastRun: new Date()
      });

      // Execute job with timeout
      const result = await Promise.race([
        jobFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Job timeout')), 300000) // 5 minutes timeout
        )
      ]);

      const duration = Date.now() - startTime;
      
      // Update success status
      this.jobStatus.set(jobName, {
        ...this.jobStatus.get(jobName),
        lastStatus: 'SUCCESS',
        lastError: null,
        runCount: (this.jobStatus.get(jobName)?.runCount || 0) + 1,
        lastDuration: duration
      });

      systemLogger.success(`Job ${jobName} completed successfully in ${duration}ms`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update error status
      this.jobStatus.set(jobName, {
        ...this.jobStatus.get(jobName),
        lastStatus: 'FAILED',
        lastError: error.message,
        runCount: (this.jobStatus.get(jobName)?.runCount || 0) + 1,
        lastDuration: duration
      });

      systemLogger.error(`Job ${jobName} failed after ${duration}ms`, {
        error: error.message,
        stack: error.stack
      });
      
      // Don't re-throw to prevent process crash
    }
  }

  static async runInterestAccrual() {
    systemLogger.info('Manually triggering interest accrual job...');
    return await this.runJobSafely('MANUAL_INTEREST_ACCRUAL', accrueInterestDaily);
  }

  static getJobStatus(jobName) {
    return this.jobStatus.get(jobName);
  }

  static getAllJobStatus() {
    const status = {};
    for (const [jobName, jobStatus] of this.jobStatus) {
      status[jobName] = jobStatus;
    }
    return status;
  }

  static stop() {
    systemLogger.info('Stopping job scheduler...');
    
    for (const [jobName, job] of this.jobs) {
      if (job && typeof job.stop === 'function') {
        job.stop();
        systemLogger.info(`Stopped job: ${jobName}`);
      }
    }
    
    this.jobs.clear();
    this.jobStatus.clear();
    systemLogger.success('Job scheduler stopped successfully');
  }
}

module.exports = JobScheduler;
