import { create } from "zustand";
import type { User } from "@/lib/types";

const REFRESH_KEY = "vein_refresh_token";

interface AuthState {
  accessToken: string | null; // in-memory only
  user: User | null;
  hydrated: boolean;
  setSession: (access: string, refresh: string, user: User) => void;
  setAccessToken: (access: string) => void;
  getRefreshToken: () => string | null;
  clear: () => void;
  hydrate: () => void;
  isAuthenticated: () => boolean;
}

function persistRefresh(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(REFRESH_KEY, token);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  hydrated: false,

  setSession: (access, refresh, user) => {
    persistRefresh(refresh);
    set({ accessToken: access, user });
  },

  setAccessToken: (access) => set({ accessToken: access }),

  getRefreshToken: () => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  clear: () => {
    persistRefresh(null);
    set({ accessToken: null, user: null });
  },

  hydrate: () => set({ hydrated: true }),

  isAuthenticated: () => {
    const { accessToken, getRefreshToken } = get();
    return Boolean(accessToken) || Boolean(getRefreshToken());
  },
}));

// Non-hook accessors for the axios interceptor.
export const authBridge = {
  getAccess: () => useAuthStore.getState().accessToken,
  getRefresh: () => useAuthStore.getState().getRefreshToken(),
  setAccess: (t: string) => useAuthStore.getState().setAccessToken(t),
  setSession: (a: string, r: string, u: User) =>
    useAuthStore.getState().setSession(a, r, u),
  clear: () => useAuthStore.getState().clear(),
};
