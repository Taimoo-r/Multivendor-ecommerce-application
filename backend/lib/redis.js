const Redis = require("ioredis");

// One shared connection. Redis is an accelerator here, never a dependency:
// every caller has a fallback, so the app keeps working (slower) when Redis is down.
let client = null;
let ready = false;

const getRedis = () => {
  if (client || !process.env.REDIS_URL) return client;
  client = new Redis(process.env.REDIS_URL, {
    connectTimeout: 2000,
    commandTimeout: 250, // a slow Redis must not slow requests down
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false, // fail fast while disconnected instead of queueing
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  client.on("ready", () => {
    ready = true;
    console.log("Redis connected");
  });
  client.on("close", () => {
    if (ready) console.warn("Redis connection closed; falling back");
    ready = false;
  });
  client.on("error", () => {
    // the close handler logs once; ioredis keeps retrying in the background
  });
  return client;
};

const redisReady = () => ready;

module.exports = { getRedis, redisReady };
