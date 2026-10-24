// bot.js — Core FF Bot Logic

const FreeFireAPI = require('@arbakti_store/freefire-api');
const { simulateMovement, humanDelay, randomBetween, sleep } = require('./movement');
const config = require('./config.json');

class FFBot {
  constructor(account, logger) {
    this.uid = account.uid;
    this.password = account.password;
    this.api = new FreeFireAPI();
    this.logger = logger;
    this.matchesPlayed = 0;
    this.running = false;
    this.deviceId = this.generateDeviceId();
  }

  generateDeviceId() {
    // Unique fingerprint per bot instance
    const chars = 'abcdef0123456789';
    let id = '';
    for (let i = 0; i < 16; i++) {
      id += chars[randomBetween(0, chars.length - 1)];
    }
    return id;
  }

  async login() {
    try {
      this.logger.info(`[Bot ${this.uid}] Logging in...`);
      await this.api.login(this.uid, this.password);
      this.logger.info(`[Bot ${this.uid}] Login successful`);
      await humanDelay(config.delays.between_actions_min, config.delays.between_actions_max);
      return true;
    } catch (err) {
      this.logger.error(`[Bot ${this.uid}] Login failed: ${err.message}`);
      return false;
    }
  }

  async joinGuild(guildId) {
    try {
      this.logger.info(`[Bot ${this.uid}] Sending guild request to: ${guildId}`);
      
      // Get player profile first (to verify login is active)
      const profile = await this.api.getPlayerProfile(this.uid);
      this.logger.info(`[Bot ${this.uid}] Profile confirmed: ${profile?.nickname || 'unknown'}`);

      await humanDelay(config.delays.between_actions_min, config.delays.between_actions_max);

      // Guild join request — uses internal API endpoint
      // Note: update this endpoint after packet capture if needed
      if (this.api.joinGuild) {
        await this.api.joinGuild(guildId);
        this.logger.info(`[Bot ${this.uid}] Guild request sent`);
      } else {
        this.logger.warn(`[Bot ${this.uid}] joinGuild method not available in this API version`);
        this.logger.info(`[Bot ${this.uid}] Proceeding with match simulation only`);
      }

      return true;
    } catch (err) {
      this.logger.error(`[Bot ${this.uid}] Guild join failed: ${err.message}`);
      return false;
    }
  }

  async playMatch() {
    try {
      this.logger.info(`[Bot ${this.uid}] Starting match #${this.matchesPlayed + 1}`);

      // Wait before match (simulate queue time)
      await humanDelay(config.delays.after_join_min, config.delays.after_join_max);

      // Simulate match movement (3-5 minutes)
      const matchDuration = randomBetween(180000, 300000);
      await simulateMovement(this.logger, matchDuration);

      this.matchesPlayed++;
      this.logger.info(`[Bot ${this.uid}] Match #${this.matchesPlayed} complete`);

      // Rest between matches
      const restTime = randomBetween(
        config.delays.between_matches_min,
        config.delays.between_matches_max
      );
      this.logger.info(`[Bot ${this.uid}] Resting ${restTime / 1000}s before next match`);
      await sleep(restTime);

      return true;
    } catch (err) {
      this.logger.error(`[Bot ${this.uid}] Match error: ${err.message}`);
      return false;
    }
  }

  async run(totalMatches) {
    this.running = true;
    this.logger.info(`[Bot ${this.uid}] Starting — Target: ${totalMatches} matches`);

    const loggedIn = await this.login();
    if (!loggedIn) {
      this.logger.error(`[Bot ${this.uid}] Cannot start — login failed`);
      this.running = false;
      return;
    }

    await this.joinGuild(config.target_guild_id);

    while (this.running && this.matchesPlayed < totalMatches) {
      await this.playMatch();
      
      if (!this.running) break;
    }

    this.logger.info(`[Bot ${this.uid}] Done — Played ${this.matchesPlayed} matches`);
    this.running = false;
  }

  stop() {
    this.running = false;
    this.logger.info(`[Bot ${this.uid}] Stop signal received`);
  }
}

module.exports = FFBot;
