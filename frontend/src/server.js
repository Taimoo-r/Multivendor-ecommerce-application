// Relative URLs: in production Nginx proxies /api and /uploads to the Node server.
// For local dev, set VITE_API_BASE=http://localhost:8000 in frontend/.env.local
const base = import.meta.env.VITE_API_BASE || "";
export const server = `${base}/api/v1`;
export const backendUrl = `${base}/uploads/`;
