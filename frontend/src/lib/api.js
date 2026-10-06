import axios from "axios";

// In production Nginx serves the app and the API from one origin; in dev Vite proxies /api.
const base = import.meta.env.VITE_API_BASE || "";

export const api = axios.create({
  baseURL: `${base}/api/v1`,
  withCredentials: true,
});

export const errMsg = (e) =>
  e?.response?.data?.message || e?.data?.message || e?.message || "Something went wrong";

// Uploaded images are served by the API at /uploads/<filename>.
export const imgUrl = (name) => (name ? `${base}/uploads/${name}` : "");

/* ------------------------------------------------------------------ session refresh
 *
 * The access token lives 15 minutes. When the API answers 401 TOKEN_EXPIRED the request
 * waits for a refresh and is retried once. Refreshes are single-flight:
 *
 *   in this tab     every request that fails while a refresh is running awaits the same
 *                   promise, so ten parallel 401s cause one POST /refresh, not ten
 *   across tabs     navigator.locks makes the tabs take turns; a tab that gets the lock
 *                   right after another tab refreshed skips its own refresh, because the
 *                   cookies it shares with that tab are already new
 */
const refreshing = {}; // scope -> Promise
const STAMP = (scope) => `vz_refreshed_${scope}`;
const RECENT_MS = 5000;

const readStamp = (scope) => {
  try {
    return Number(localStorage.getItem(STAMP(scope))) || 0;
  } catch {
    return 0;
  }
};
const writeStamp = (scope) => {
  try {
    localStorage.setItem(STAMP(scope), String(Date.now()));
  } catch {
    /* storage unavailable: tabs just refresh on their own */
  }
};

const doRefresh = async (scope, failedAt) => {
  // another tab refreshed after our request failed: nothing to do, just retry
  if (readStamp(scope) > failedAt) return;
  await api.post(`/${scope}/refresh`, null, { _skipRefresh: true });
  writeStamp(scope);
};

export function refreshSession(scope, failedAt = Date.now() - RECENT_MS) {
  if (!refreshing[scope]) {
    const run = () => doRefresh(scope, failedAt);
    refreshing[scope] = (navigator.locks ? navigator.locks.request(`vz-refresh-${scope}`, run) : run()).finally(
      () => delete refreshing[scope]
    );
  }
  return refreshing[scope];
}

// The store registers what "signed out" means (clear the user or seller).
let onSessionExpired = () => {};
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

const SIGNED_OUT = new Set(["SESSION_REVOKED", "REFRESH_REUSED", "SESSION_INVALID", "NO_SESSION"]);

api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  const { code, scope } = response?.data || {};
  if (!config || response?.status !== 401 || !scope) throw error;

  if (code === "TOKEN_EXPIRED" && !config._retried && !config._skipRefresh) {
    config._retried = true;
    const failedAt = Date.now();
    try {
      await refreshSession(scope, failedAt - 1);
    } catch (refreshError) {
      onSessionExpired(scope, refreshError?.response?.data?.code);
      throw error;
    }
    return api(config);
  }
  if (SIGNED_OUT.has(code)) onSessionExpired(scope, code);
  throw error;
});
