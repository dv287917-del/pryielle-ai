// movement.js — Human-like random movement simulation

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return (Math.random() * (max - min) + min).toFixed(4);
}

// Random map coordinates for IND region maps
const MAP_ZONES = {
  bermuda: [
    { x: 1200, y: 800, name: "Clock Tower" },
    { x: 2100, y: 1500, name: "Peak" },
    { x: 800,  y: 2000, name: "Pochinok" },
    { x: 3000, y: 900,  name: "Bimasakti" },
    { x: 1800, y: 2800, name: "Shipyard" },
    { x: 2600, y: 2200, name: "Graveyard" },
    { x: 500,  y: 1200, name: "Mars Electric" },
    { x: 2900, y: 1900, name: "Hangar" }
  ],
  purgatory: [
    { x: 1000, y: 1000, name: "Zion" },
    { x: 2000, y: 500,  name: "Crossfire" },
    { x: 1500, y: 2000, name: "Brasilia" },
    { x: 800,  y: 1800, name: "Sentosa" }
  ]
};

async function simulateMovement(logger, matchDurationMs = 180000) {
  const map = Math.random() > 0.5 ? "bermuda" : "purgatory";
  const zones = MAP_ZONES[map];
  const startTime = Date.now();

  logger.info(`[Movement] Map: ${map}, Duration: ${matchDurationMs / 1000}s`);

  // Pick random landing zone
  const landingZone = zones[randomBetween(0, zones.length - 1)];
  logger.info(`[Movement] Landing at: ${landingZone.name}`);

  await sleep(randomBetween(8000, 15000)); // Plane + parachute time

  let currentX = landingZone.x + randomBetween(-100, 100);
  let currentY = landingZone.y + randomBetween(-100, 100);

  // Simulate looting phase (first 60s)
  logger.info(`[Movement] Looting phase started`);
  const lootActions = randomBetween(4, 8);
  for (let i = 0; i < lootActions; i++) {
    const moveX = currentX + randomBetween(-200, 200);
    const moveY = currentY + randomBetween(-200, 200);
    logger.info(`[Movement] Moving to (${moveX}, ${moveY})`);
    currentX = moveX;
    currentY = moveY;
    await sleep(randomBetween(3000, 7000));
  }

  // Random shoot (deal some damage so not flagged as AFK)
  const shootCount = randomBetween(1, 3);
  for (let s = 0; s < shootCount; s++) {
    logger.info(`[Movement] Firing weapon (${randomBetween(10, 45)} damage)`);
    await sleep(randomBetween(1000, 3000));
  }

  // Move toward safe zone randomly
  logger.info(`[Movement] Moving toward safe zone`);
  const zoneMoves = randomBetween(3, 6);
  for (let z = 0; z < zoneMoves; z++) {
    const nextZone = zones[randomBetween(0, zones.length - 1)];
    logger.info(`[Movement] Heading to: ${nextZone.name}`);
    currentX = nextZone.x + randomBetween(-150, 150);
    currentY = nextZone.y + randomBetween(-150, 150);
    await sleep(randomBetween(8000, 20000));

    if (Date.now() - startTime > matchDurationMs * 0.8) break;
  }

  logger.info(`[Movement] Match simulation complete`);
}

async function humanDelay(min, max) {
  const delay = randomBetween(min, max);
  await sleep(delay);
  return delay;
}

module.exports = { simulateMovement, humanDelay, randomBetween, sleep };
