import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../../api/src/routers/_app.js";

export type { AppRouter };

export const trpc = createTRPCReact<AppRouter>();

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  try {
    const res = await fetch("/api/trpc/auth.refreshToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { refreshToken } }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    const result = data?.result?.data?.json;
    if (!result?.accessToken) return false;

    localStorage.setItem("accessToken", result.accessToken);
    localStorage.setItem("refreshToken", result.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function getRefreshPromise(): Promise<boolean> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }
  return refreshPromise!;
}

function getAuthHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const API_URL =
  typeof window !== "undefined"
    ? "" // Browser: use relative URLs through nginx
    : "http://127.0.0.1:4000"; // SSR: direct to API server

function createBatchLink() {
  return httpBatchLink({
    url: `${API_URL}/api/trpc`,
    transformer: superjson,
    headers: getAuthHeaders,
    async fetch(url, options) {
      let res = await fetch(url, options);

      // If 401, try to refresh token and retry once
      if (res.status === 401 && typeof window !== "undefined") {
        const refreshed = await getRefreshPromise();
        if (refreshed) {
          // Retry with new token
          const newHeaders = new Headers(options?.headers);
          const newToken = localStorage.getItem("accessToken");
          if (newToken) {
            newHeaders.set("Authorization", `Bearer ${newToken}`);
          }
          res = await fetch(url, { ...options, headers: newHeaders });
        } else {
          // Refresh failed — force logout
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          localStorage.removeItem("workspaceId");
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      }

      return res;
    },
  });
}

export function getTRPCLinks() {
  return [createBatchLink()];
}

// Vanilla client for use outside React (e.g. in auth pages before provider)
export const trpcVanilla = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      transformer: superjson,
      headers: getAuthHeaders,
    }),
  ],
});

export function isTRPCError(error: unknown): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError;
}
