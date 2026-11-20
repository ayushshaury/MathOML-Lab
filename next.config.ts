import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone mode when explicitly requested (e.g. Docker); Vercel uses native deployment
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) return [];
    return [
      {
        source: "/api/remote/:path*",
        destination: `${backendUrl.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
