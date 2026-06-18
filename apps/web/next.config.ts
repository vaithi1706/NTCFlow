import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["@dkflow/shared"],
  allowedDevOrigins: ["http://72.61.173.123:3000"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  // Local dev only: proxy /api/* to the backend (mirrors nginx in production).
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:4001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
