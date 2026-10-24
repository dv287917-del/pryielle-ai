// index.js — FF Glory Bot Entry Point

const winston = require('winston');
const FFBot = require('./bot');
const config = require('./config.json');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'bot.log' })
  ]
});

// Get match count from command line args or config
const totalMatches = parseInt(process.argv[2]) || config.matches_to_play;

logger.info(`FF Glory Bot Starting`);
logger.info(`Target Guild: ${config.target_guild_id}`);
logger.info(`Total Matches: ${totalMatches}`);
logger.info(`Bot Accounts: ${config.accounts.length}`);

// Launch all bots
const bots = config.accounts.map(account => new FFBot(account, logger));

async function runAll() {
  // Run all bots in parallel
  const promises = bots.map(bot => bot.run(totalMatches));
  
  try {
    await Promise.all(promises);
    logger.info('All bots finished');
    process.exit(0);
  } catch (err) {
    logger.error(`Fatal error: ${err.message}`);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  logger.info('Stopping all bots...');
  bots.forEach(bot => bot.stop());
  setTimeout(() => process.exit(0), 2000);
});

runAll();
