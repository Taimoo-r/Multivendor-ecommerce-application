// Cache-aside for public catalogue reads.
//
//   L1  in-process Map, a few seconds    absorbs hot keys, works without Redis
//   L2  Redis, shared by every instance   the source of cached truth
//
// Protection:
//   stampede     single-flight per process (one loader call per key at a time)
//                + a Redis lock across processes for background refreshes
//   breakdown    stale-while-revalidate: past the soft TTL we serve the stale value
//                immediately and refresh in the background, so nobody waits
//   avalanche    TTL jitter so keys written together do not expire together
//   penetration  "not found" is cached too (shorter TTL)
const { getRedis, redisReady } = require("./redis");

const L1 = new Map(); // key -> { entry, l1Exp }
const L1_MAX = 1000;
const inflight = new Map(); // key -> Promise<entry>
const localVersions = new Map(); // namespace -> number (used when Redis is down)

const jitter = (ms) => Math.round(ms * (0.9 + Math.random() * 0.2));

const remember = (key, entry, l1Seconds) => {
  if (L1.size >= L1_MAX) L1.delete(L1.keys().next().value); // drop the oldest
  L1.set(key, { entry, l1Exp: Date.now() + l1Seconds * 1000 });
};

const redisGet = async (key) => {
  if (!redisReady()) return null;
  try {
    const raw = await getRedis().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const redisSet = async (key, entry, ttlMs) => {
  if (!redisReady()) return;
  try {
    await getRedis().set(key, JSON.stringify(entry), "PX", ttlMs);
  } catch {
    /* cache write failures are not request failures */
  }
};

// Across instances only one process refreshes a stale key; without Redis, single-flight
// inside this process is the guard.
const tryLock = async (key, ms) => {
  if (!redisReady()) return true;
  try {
    return (await getRedis().set(`lock:${key}`, "1", "PX", ms, "NX")) === "OK";
  } catch {
    return true;
  }
};

const load = (key, ttl, loader, opts) => {
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const value = await loader();
    const missing = value === null || value === undefined;
    const life = (missing ? opts.negativeTtl : ttl) * 1000;
    const entry = { v: missing ? null : value, softExp: Date.now() + jitter(life) };
    await redisSet(key, entry, (missing ? opts.negativeTtl : opts.swr) * 1000);
    remember(key, entry, Math.min(opts.l1, missing ? opts.negativeTtl : ttl));
    return entry;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
};

/**
 * cached(key, ttlSeconds, loader, opts) -> { value, status }
 * status is "hit", "stale" (served while refreshing) or "miss".
 */
async function cached(key, ttl, loader, opts = {}) {
  const o = { swr: ttl * 10, l1: 5, negativeTtl: 30, ...opts };
  const now = Date.now();

  const local = L1.get(key);
  if (local && local.l1Exp > now) return { value: local.entry.v, status: "hit" };

  const entry = (await redisGet(key)) || local?.entry || null;
  if (entry && entry.softExp > now) {
    remember(key, entry, o.l1);
    return { value: entry.v, status: "hit" };
  }
  if (entry) {
    // stale: answer now, refresh once in the background
    if (!inflight.has(key) && (await tryLock(key, 5000))) {
      load(key, ttl, loader, o).catch((e) => console.error("cache refresh failed", key, e.message));
    }
    return { value: entry.v, status: "stale" };
  }
  const fresh = await load(key, ttl, loader, o);
  return { value: fresh.v, status: "miss" };
}

async function del(...keys) {
  keys.forEach((k) => L1.delete(k));
  if (!redisReady() || !keys.length) return;
  try {
    await getRedis().del(...keys);
  } catch {
    /* ignore */
  }
}

// Namespaced invalidation: list keys embed a version, so bumping it orphans every
// cached page at once without having to find and delete them.
async function version(ns) {
  if (redisReady()) {
    try {
      return Number(await getRedis().get(`ver:${ns}`)) || 0;
    } catch {
      /* fall through */
    }
  }
  return localVersions.get(ns) || 0;
}

async function bump(ns) {
  localVersions.set(ns, (localVersions.get(ns) || 0) + 1);
  for (const k of L1.keys()) if (k.startsWith(`${ns}:`)) L1.delete(k);
  if (!redisReady()) return;
  try {
    await getRedis().incr(`ver:${ns}`);
  } catch {
    /* ignore */
  }
}

// Sends a cached result with an X-Cache header so hit rates are observable.
const sendCached = (res, { value, status }, body) => {
  res.set("X-Cache", status.toUpperCase());
  res.json(body(value));
};

module.exports = { cached, del, version, bump, sendCached };
