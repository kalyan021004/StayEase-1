// The ONLY place that talks to fetch(). Every resource file (auth.js, pgs.js...)
// goes through request(), which:
//   - prefixes the API base URL
//   - attaches the JWT automatically
//   - turns { error: "..." } responses into an ApiError carrying the server's
//     real message and status code (so screens can show "Room is already full")
//   - tells the auth layer when a token is rejected (401) so the user is logged out

const BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "stayease.token";

let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.requestId = body && body.requestId;
  }
}

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) - session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

function buildQuery(params) {
  if (!params) return "";
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.append(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function request(path, { method = "GET", body, params, signal, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}${buildQuery(params)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Can't reach StayEase right now. Check your internet connection and try again.", 0);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message =
      (data && data.error) ||
      (res.status === 429
        ? "Too many attempts. Please wait a few minutes and try again."
        : res.status >= 500
          ? "Something went wrong on our side. Please try again."
          : `Request failed (${res.status})`);
    if (res.status === 401 && auth && token && unauthorizedHandler) unauthorizedHandler(message);
    throw new ApiError(message, res.status, data);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body: body ?? {} }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  del: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};
