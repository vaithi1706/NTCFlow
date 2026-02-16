export const APP_NAME = "DKFlow";
export const API_URL =
  typeof window !== "undefined"
    ? "" // Browser: relative URLs through nginx
    : "http://127.0.0.1:4000"; // SSR: direct to API
