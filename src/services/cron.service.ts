import { CronJob } from "cron";

// Every month on the 1st at midnight
const monthlyLimitResetJob = new CronJob("0 0 1 * *", () => {
  // Task to be executed
  console.log("Monthly limit reset job executed at midnight on the 1st");
}).start();

// Every day at midnight
const dailyLimitResetJob = new CronJob("0 0 * * *", () => {
  // Task to be executed
  console.log("Daily limit reset job executed at midnight");
}).start();
