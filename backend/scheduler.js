require('dotenv').config();
const cron = require('node-cron');
const { runPipeline } = require('./generator');

const INTERVAL_HOURS = parseInt(process.env.SCHEDULE_INTERVAL_HOURS || '6', 10);

// Convert hours to cron expression: every N hours at minute 0
function hoursToCron(h) {
  if (h <= 1)  return '0 * * * *';          // every hour
  if (h <= 23) return `0 */${h} * * *`;     // every N hours
  return '0 0 * * *';                        // once a day
}

const cronExpr = hoursToCron(INTERVAL_HOURS);
console.log(`[Scheduler] ⏰ Scheduled generation every ${INTERVAL_HOURS}h  (cron: "${cronExpr}")`);

let isRunning = false;

async function scheduledRun() {
  if (isRunning) {
    console.log('[Scheduler] ⏭  Previous run still in progress — skipping.');
    return;
  }
  isRunning = true;
  const startedAt = new Date().toISOString();
  console.log(`\n[Scheduler] 🚀 Auto-generation triggered at ${startedAt}`);
  try {
    const result = await runPipeline();
    console.log(`[Scheduler] ✅ Done — ${result.idea}  →  ${result.liveUrl}`);
  } catch (err) {
    console.error(`[Scheduler] ❌ Run failed: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

// Register the cron job
cron.schedule(cronExpr, scheduledRun, { timezone: 'UTC' });

// Also run immediately on startup
console.log('[Scheduler] ▶  Running initial generation on startup…');
scheduledRun();
