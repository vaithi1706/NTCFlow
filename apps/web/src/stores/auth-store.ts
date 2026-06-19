import { create } from "zustand";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  workspaceId: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string, workspaceId?: string) => void;
  setUser: (user: AuthUser | null) => void;
  setWorkspaceId: (id: string) => void;
  logout: () => void;
  hydrateFromStorage: () => boolean;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function parseJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function silentRefresh() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/trpc/auth.refreshToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { refreshToken } }),
    });

    if (!res.ok) {
      // Refresh failed — session expired
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return;
    }

    const data = await res.json();
    const result = data?.result?.data?.json;
    if (result?.accessToken) {
      localStorage.setItem("accessToken", result.accessToken);
      localStorage.setItem("refreshToken", result.refreshToken);
      scheduleRefresh(result.accessToken);
    }
  } catch {
    // Network error — retry in 30s
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(silentRefresh, 30_000);
  }
}

function scheduleRefresh(accessToken: string) {
  if (refreshTimer) clearTimeout(refreshTimer);

  const exp = parseJwtExp(accessToken);
  if (!exp) return;

  // Refresh 5 minutes before expiry (or at least 10s from now)
  const refreshIn = Math.max(exp - Date.now() - 5 * 60 * 1000, 10_000);
  refreshTimer = setTimeout(silentRefresh, refreshIn);
}

function clearSession() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("workspaceId");
  localStorage.removeItem("user");
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  workspaceId: null,

  setAuth: (user, accessToken, refreshToken, workspaceId) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    if (workspaceId) localStorage.setItem("workspaceId", workspaceId);
    localStorage.setItem("user", JSON.stringify(user));
    set({ user, isAuthenticated: true, workspaceId: workspaceId || null });
    scheduleRefresh(accessToken);
  },

  setUser: (user) => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    set({ user, isAuthenticated: !!user });
  },

  setWorkspaceId: (id) => {
    localStorage.setItem("workspaceId", id);
    set({ workspaceId: id });
  },

  logout: () => {
    // Revoke refresh token on server (best-effort)
    const rt = localStorage.getItem("refreshToken");
    if (rt) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/trpc/auth.logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { refreshToken: rt } }),
      }).catch(() => {});
    }
    clearSession();
    set({ user: null, isAuthenticated: false, workspaceId: null });
  },

  hydrateFromStorage: () => {
    const token = localStorage.getItem("accessToken");
    const userStr = localStorage.getItem("user");
    const workspaceId = localStorage.getItem("workspaceId");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);

        // Check if access token is expired
        const exp = parseJwtExp(token);
        if (exp && exp < Date.now()) {
          // Token expired — try silent refresh immediately
          const refreshToken = localStorage.getItem("refreshToken");
          if (refreshToken) {
            // Set state optimistically (refresh will happen in background)
            set({ user, isAuthenticated: true, workspaceId });
            silentRefresh();
            return true;
          }
          // No refresh token — force re-login
          clearSession();
          return false;
        }

        set({ user, isAuthenticated: true, workspaceId });
        scheduleRefresh(token);
        return true;
      } catch {
        clearSession();
        return false;
      }
    }
    return false;
  },
}));
