const cron = require('node-cron');
const accrueInterestDaily = require('../jobs/accrueInterestDaily');

/**
 * Job Scheduler
 *
 * Manages all scheduled background jobs for the application.
 */
class JobScheduler {
  static start() {
    console.log('Starting job scheduler...');

    // Daily interest accrual at 12:01 AM
    cron.schedule('1 0 * * *', async () => {
      console.log('Running scheduled daily interest accrual job...');
      await accrueInterestDaily();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    // For testing purposes - run every minute (comment out in production)
    // cron.schedule('* * * * *', async () => {
    //   console.log('Running test interest accrual job...');
    //   await accrueInterestDaily();
    // });

    console.log('Job scheduler started successfully.');
  }

  static async runInterestAccrual() {
    console.log('Manually triggering interest accrual job...');
    await accrueInterestDaily();
  }
}

module.exports = JobScheduler;
