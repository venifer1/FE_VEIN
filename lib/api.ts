import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { authBridge } from "@/store/auth";
import type { ApiErrorBody, AuthTokens } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export const api: AxiosInstance = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// Mock adapter (lazy import keeps mock code out of prod bundles when unused).
if (USE_MOCK) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { mockAdapter } = require("./mockAdapter");
  api.defaults.adapter = mockAdapter;
}

// Attach access token.
api.interceptors.request.use((config) => {
  const token = authBridge.getAccess();
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

// 401 -> refresh once -> retry; else clear + go to login.
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = authBridge.getRefresh();
  if (!refresh) return null;
  try {
    // Use a bare axios call to avoid recursive interceptors.
    const resp = await axios.post<{ data: AuthTokens }>(
      `${BASE}/auth/refresh`,
      { refresh_token: refresh },
      USE_MOCK ? { adapter: api.defaults.adapter } : undefined,
    );
    const tokens = resp.data.data;
    authBridge.setSession(tokens.access_token, tokens.refresh_token, tokens.user);
    return tokens.access_token;
  } catch {
    return null;
  }
}

/**
 * Proactively exchange a persisted refresh token for an access token on app
 * load. The access token is in-memory only, so after a full page reload it's
 * gone; calling this before queries fire avoids a burst of 401s. No-op when
 * already authenticated or not logged in.
 */
export async function bootstrapAuth(): Promise<void> {
  if (USE_MOCK) return;
  if (authBridge.getAccess()) return;
  if (!authBridge.getRefresh()) return;
  if (!refreshing) refreshing = doRefresh();
  await refreshing.finally(() => {
    refreshing = null;
  });
}

api.interceptors.response.use(
  (resp) => resp,
  async (error: AxiosError<{ error?: ApiErrorBody }>) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const isAuthEndpoint =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/refresh");

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      if (!refreshing) refreshing = doRefresh();
      const newToken = await refreshing.finally(() => {
        refreshing = null;
      });
      if (newToken) {
        const headers = AxiosHeaders.from(original.headers);
        headers.set("Authorization", `Bearer ${newToken}`);
        original.headers = headers;
        return api(original);
      }
      authBridge.clear();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
    }
    return Promise.reject(error);
  },
);

// Helpers -------------------------------------------------
export function extractError(err: unknown): ApiErrorBody {
  const ax = err as AxiosError<{ error?: ApiErrorBody }>;
  if (ax?.response?.data?.error) return ax.response.data.error;
  return {
    code: "NETWORK_ERROR",
    message: ax?.message ?? "네트워크 오류가 발생했습니다.",
  };
}

export interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown> & { next_cursor?: string | null; freshness?: string; unread_count?: number; trace_id?: string };
}

export { USE_MOCK, BASE };
