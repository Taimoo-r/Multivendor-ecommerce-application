// Token lifecycle for buyers ("user") and sellers ("shop").
//
//   access token   JWT { id, sid, kind }, valid 15 minutes, HttpOnly cookie on "/"
//   refresh token  random 256-bit value, HttpOnly + SameSite=Strict cookie scoped to the
//                  refresh/logout routes; only its SHA-256 hash is stored (Session)
//
// Every refresh rotates the refresh token. Presenting a token that was already rotated
// means two parties hold it (theft or a replay), so the whole session is revoked, except
// within a 10 s grace window, which covers two tabs or a retried request refreshing at once.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Session = require("../model/session");
const { getRedis, redisReady } = require("../lib/redis");

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GRACE_MS = 10_000;

const COOKIES = {
  user: { access: "token", refresh: "rt", path: "/api/v1/user" },
  shop: { access: "seller_token", refresh: "srt", path: "/api/v1/shop" },
};

const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");
const newRefreshToken = () => crypto.randomBytes(32).toString("base64url");
const base = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
});

const signAccess = (kind, subjectId, sid) =>
  jwt.sign({ id: String(subjectId), sid: String(sid), kind }, process.env.JWT_SECRET_KEY, {
    expiresIn: ACCESS_TTL_S,
  });

// The access cookie outlives its JWT on purpose: when the JWT expires the browser still
// sends it, the API answers 401 TOKEN_EXPIRED, and the client knows to refresh.
function setCookies(res, kind, access, refresh) {
  const c = COOKIES[kind];
  res.cookie(c.access, access, { ...base(), path: "/", maxAge: REFRESH_TTL_MS });
  if (refresh) {
    res.cookie(c.refresh, refresh, { ...base(), sameSite: "strict", path: c.path, maxAge: REFRESH_TTL_MS });
  }
}

function clearCookies(res, kind) {
  const c = COOKIES[kind];
  res.clearCookie(c.access, { ...base(), path: "/" });
  res.clearCookie(c.refresh, { ...base(), sameSite: "strict", path: c.path });
}

async function startSession(req, res, kind, subjectId) {
  const refresh = newRefreshToken();
  const session = await Session.create({
    kind,
    subject: subjectId,
    tokenHash: hash(refresh),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: (req.get("user-agent") || "").slice(0, 200),
    ip: req.ip,
  });
  setCookies(res, kind, signAccess(kind, subjectId, session._id), refresh);
  return session;
}

// Revoked session ids are remembered in Redis for one access-token lifetime, so a
// stolen access token stops working at logout instead of 15 minutes later.
async function markRevoked(sids) {
  if (!redisReady() || !sids.length) return;
  try {
    const multi = getRedis().multi();
    sids.forEach((sid) => multi.set(`revoked:${sid}`, "1", "EX", ACCESS_TTL_S));
    await multi.exec();
  } catch {
    /* the session record is still revoked; refresh will fail */
  }
}

async function isRevoked(sid) {
  if (!redisReady()) return false; // fail open: refresh still checks the database
  try {
    return (await getRedis().exists(`revoked:${sid}`)) === 1;
  } catch {
    return false;
  }
}

async function revokeSession(sid) {
  await Session.updateOne({ _id: sid, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await markRevoked([String(sid)]);
}

async function revokeAll(kind, subjectId, exceptSid) {
  const filter = { kind, subject: subjectId, revokedAt: null };
  if (exceptSid) filter._id = { $ne: exceptSid };
  const sessions = await Session.find(filter, "_id");
  if (!sessions.length) return 0;
  await Session.updateMany({ _id: { $in: sessions.map((s) => s._id) } }, { $set: { revokedAt: new Date() } });
  await markRevoked(sessions.map((s) => String(s._id)));
  return sessions.length;
}

/**
 * Rotate the refresh token in the request. Returns { ok: true, subject } or { code }.
 */
async function rotate(req, res, kind) {
  const presented = req.cookies[COOKIES[kind].refresh];
  if (!presented) return { code: "NO_SESSION" };
  const h = hash(presented);
  const now = new Date();
  const next = newRefreshToken();

  // Atomic: of two concurrent refreshes with the same token, only one matches.
  const session = await Session.findOneAndUpdate(
    { kind, tokenHash: h, revokedAt: null, expiresAt: { $gt: now } },
    {
      $set: {
        prevHash: h,
        tokenHash: hash(next),
        rotatedAt: now,
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      },
    },
    { new: true }
  );
  if (session) {
    setCookies(res, kind, signAccess(kind, session.subject, session._id), next);
    return { ok: true, subject: session.subject };
  }

  const previous = await Session.findOne({ kind, prevHash: h });
  if (previous && !previous.revokedAt && now - previous.rotatedAt < GRACE_MS) {
    // The other request already rotated; the browser's cookie jar has the new refresh
    // token, so only a fresh access token is needed here.
    setCookies(res, kind, signAccess(kind, previous.subject, previous._id));
    return { ok: true, subject: previous.subject, grace: true };
  }
  if (previous) {
    await revokeSession(previous._id);
    return { code: "REFRESH_REUSED" };
  }
  return { code: "SESSION_INVALID" };
}

// The session id behind a request, from the access token (even if expired) or,
// failing that, the refresh cookie.
async function currentSessionId(req, kind) {
  const c = COOKIES[kind];
  const access = req.cookies[c.access];
  if (access) {
    try {
      const p = jwt.verify(access, process.env.JWT_SECRET_KEY, { ignoreExpiration: true });
      if (p.sid && p.kind === kind) return p.sid;
    } catch {
      /* fall through */
    }
  }
  const refresh = req.cookies[c.refresh];
  if (refresh) {
    const h = hash(refresh);
    const s = await Session.findOne({ kind, $or: [{ tokenHash: h }, { prevHash: h }] }, "_id");
    if (s) return s._id;
  }
  return null;
}

module.exports = {
  ACCESS_TTL_S,
  COOKIES,
  startSession,
  rotate,
  revokeSession,
  revokeAll,
  isRevoked,
  clearCookies,
  currentSessionId,
};
