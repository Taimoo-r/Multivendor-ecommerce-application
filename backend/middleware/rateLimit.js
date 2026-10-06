// Sliding-window rate limiting (the "sliding log" variant).
//
// Each key is a Redis sorted set of request timestamps. A Lua script trims entries
// older than the window, counts what is left and (if allowed) records this request,
// all atomically, so concurrent requests on several servers cannot both squeeze
// under the limit. Unlike a fixed window there is no burst at the window edge.
//
// If Redis is unavailable the same algorithm runs in process memory. That is per
// instance (N servers = N x the limit) and resets on restart, which is why Redis
// is the real store and memory only a fallback.
const crypto = require("crypto");
const { getRedis, redisReady } = require("../lib/redis");
const ErrorHandler = require("../utils/ErrorHandler");

const SLIDING_WINDOW = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local mode   = ARGV[4]
local member = ARGV[5]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
local allowed = 1
if mode == 'consume' then
  if count < limit then
    redis.call('ZADD', key, now, member)
    count = count + 1
  else
    allowed = 0
  end
elseif mode == 'add' then
  redis.call('ZADD', key, now, member)
  count = count + 1
end
redis.call('PEXPIRE', key, window)
local retry = 0
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  if oldest[2] then retry = tonumber(oldest[2]) + window - now end
end
return { allowed, count, retry }
`;

const memory = new Map(); // key -> number[] (timestamps)
const memoryWindow = (key, now, windowMs, limit, mode) => {
  const hits = (memory.get(key) || []).filter((t) => t > now - windowMs);
  let allowed = 1;
  if (mode === "consume") {
    if (hits.length < limit) hits.push(now);
    else allowed = 0;
  } else if (mode === "add") hits.push(now);
  memory.set(key, hits);
  if (memory.size > 50_000) memory.delete(memory.keys().next().value);
  const retry = hits.length >= limit ? hits[0] + windowMs - now : 0;
  return [allowed, hits.length, retry];
};

async function slidingWindow(key, windowMs, limit, mode) {
  const now = Date.now();
  if (redisReady()) {
    try {
      const member = `${now}-${crypto.randomBytes(4).toString("hex")}`;
      return await getRedis().eval(SLIDING_WINDOW, 1, key, now, windowMs, limit, mode, member);
    } catch {
      /* fall back to memory */
    }
  }
  return memoryWindow(key, now, windowMs, limit, mode);
}

const tooMany = (res, limit, retryMs, message) => {
  const retryAfter = Math.max(1, Math.ceil(retryMs / 1000));
  res.set("Retry-After", String(retryAfter));
  res.set("RateLimit-Limit", String(limit));
  res.set("RateLimit-Remaining", "0");
  return new ErrorHandler(message || "Too many requests, please slow down", 429, {
    code: "RATE_LIMITED",
    retryAfter,
  });
};

const ipKey = (req) => req.ip;

/**
 * Count every request: rejects once `max` requests were made in the last `windowMs`.
 */
const rateLimit = ({ name, windowMs, max, key = ipKey, message }) =>
  async (req, res, next) => {
    const id = key(req);
    if (!id) return next();
    const [allowed, count, retry] = await slidingWindow(`rl:${name}:${id}`, windowMs, max, "consume");
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - count)));
    if (!allowed) return next(tooMany(res, max, retry, message));
    next();
  };

/**
 * Count only failed attempts (e.g. wrong passwords), and throttle before blocking:
 * after `delayAfter` failures each further attempt is delayed (500 ms, 1 s, 2 s ... up to
 * 4 s), and at `max` failures the key is blocked until the oldest failure leaves the window.
 */
const failureLimit = ({ name, windowMs, max, delayAfter = max, key, message }) =>
  async (req, res, next) => {
    const id = key(req);
    if (!id) return next();
    const rkey = `rl:${name}:${id}`;
    const [, count, retry] = await slidingWindow(rkey, windowMs, max, "peek");
    if (count >= max) return next(tooMany(res, max, retry, message));

    res.on("finish", () => {
      if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 429) {
        slidingWindow(rkey, windowMs, max, "add").catch(() => {});
      }
    });

    if (count >= delayAfter) {
      const wait = Math.min(500 * 2 ** (count - delayAfter), 4000);
      await new Promise((r) => setTimeout(r, wait));
    }
    next();
  };

// keys
const byIp = ipKey;
const account = (req) => (req.seller ? `s:${req.seller._id}` : req.user ? `u:${req.user._id}` : null);
// sign-in: the email being tried; password change: the signed-in account
const byIpAndEmail = (req) =>
  `${req.ip}:${String(req.body?.email || "").trim().toLowerCase() || account(req) || ""}`;
const byEmail = (req) => String(req.body?.email || "").trim().toLowerCase() || null;
const byUser = (req) => (req.user ? `u:${req.user._id}` : req.ip);
const bySeller = (req) => (req.seller ? `s:${req.seller._id}` : req.ip);
const byAccount = (req) => account(req) || req.ip;

const MIN = 60_000;
const HOUR = 60 * MIN;

// The limits used across the API (see the audit's rate limit table).
const limits = {
  api: rateLimit({ name: "api", windowMs: MIN, max: 300, key: byIp }),
  loginFailures: failureLimit({
    name: "login-fail",
    windowMs: 15 * MIN,
    max: 5,
    delayAfter: 3,
    key: byIpAndEmail,
    message: "Too many failed sign-in attempts. Try again in a few minutes.",
  }),
  loginIp: rateLimit({ name: "login-ip", windowMs: 15 * MIN, max: 30, key: byIp }),
  signup: rateLimit({ name: "signup", windowMs: HOUR, max: 5, key: byIp }),
  forgotEmail: rateLimit({ name: "forgot-email", windowMs: HOUR, max: 3, key: byEmail }),
  forgotIp: rateLimit({ name: "forgot-ip", windowMs: HOUR, max: 10, key: byIp }),
  tokenLink: rateLimit({ name: "token-link", windowMs: HOUR, max: 10, key: byIp }),
  refresh: rateLimit({ name: "refresh", windowMs: MIN, max: 30, key: byIp }),
  browse: rateLimit({ name: "browse", windowMs: MIN, max: 120, key: byIp }),
  quote: rateLimit({ name: "quote", windowMs: MIN, max: 30, key: byIp }),
  couponLookup: rateLimit({ name: "coupon", windowMs: MIN, max: 10, key: byIp }),
  checkout: rateLimit({ name: "checkout", windowMs: MIN, max: 10, key: byUser }),
  review: rateLimit({ name: "review", windowMs: HOUR, max: 5, key: byUser }),
  sellerWrite: rateLimit({ name: "seller-write", windowMs: MIN, max: 120, key: bySeller }),
  upload: rateLimit({ name: "upload", windowMs: HOUR, max: 30, key: byAccount }),
};

module.exports = { rateLimit, failureLimit, limits, slidingWindow };
