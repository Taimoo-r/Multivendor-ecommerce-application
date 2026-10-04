import axios from "axios";

// In production Nginx serves the app and the API from one origin; in dev Vite proxies /api.
const base = import.meta.env.VITE_API_BASE || "";

export const api = axios.create({
  baseURL: `${base}/api/v1`,
  withCredentials: true,
});

export const errMsg = (e) =>
  e?.response?.data?.message || e?.message || "Something went wrong";

// Uploaded images are served by the API at /uploads/<filename>.
export const imgUrl = (name) => (name ? `${base}/uploads/${name}` : "");
