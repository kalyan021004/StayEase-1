// The ONLY place that talks to fetch().
// All resource files (auth.js, pgs.js, etc.) go through request().

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .replace(/\/$/, "");

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
      // Storage unavailable - session lasts until reload
    }
  },

  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore storage errors
    }
  },
};

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

function buildQuery(params) {
  if (!params) return "";

  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      qs.append(key, value);
    }
  });

  const queryString = qs.toString();

  return queryString ? `?${queryString}` : "";
}

export async function request(
  path,
  {
    method = "GET",
    body,
    params,
    signal,
    auth = true,
  } = {}
) {
  const headers = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token = tokenStore.get();

  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;

  try {
    res = await fetch(
      `${BASE_URL}${path}${buildQuery(params)}`,
      {
        method,
        headers,
        body:
          body !== undefined
            ? JSON.stringify(body)
            : undefined,
        signal,
      }
    );
  } catch (err) {
    if (err.name === "AbortError") {
      throw err;
    }

    throw new ApiError(
      "Can't reach StayEase right now. Check your internet connection and try again.",
      0
    );
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

    if (
      res.status === 401 &&
      auth &&
      token &&
      unauthorizedHandler
    ) {
      unauthorizedHandler(message);
    }

    throw new ApiError(message, res.status, data);
  }

  return data;
}

export const api = {
  get: (path, opts) =>
    request(path, {
      ...opts,
      method: "GET",
    }),

  post: (path, body, opts) =>
    request(path, {
      ...opts,
      method: "POST",
      body: body ?? {},
    }),

  patch: (path, body, opts) =>
    request(path, {
      ...opts,
      method: "PATCH",
      body,
    }),

  del: (path, opts) =>
    request(path, {
      ...opts,
      method: "DELETE",
    }),
};