import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["firebase-admin"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate, max-age=0" },
    ];
    const staticAssetCache = [
      { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
    ];
    const corsHeaders = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Range, Accept, Origin, Content-Type" },
    ];
    return [
      { source: "/sw.js", headers: [...noStore, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/manifest.webmanifest", headers: noStore },
      { source: "/images/:path*", headers: staticAssetCache },
      { source: "/audio/:path*", headers: corsHeaders },
      { source: "/videos/:path*", headers: corsHeaders },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
