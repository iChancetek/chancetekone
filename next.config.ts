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
    const partnerApiCors = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, POST, DELETE, HEAD, OPTIONS" },
      {
        key: "Access-Control-Allow-Headers",
        value: "Authorization, x-api-key, x-famio-api-key, x-chancetek-api-key, x-strideiq-api-key, x-strideiq-partner-key, x-admin-email, x-user-id, x-user-email, Range, Accept, Origin, Content-Type",
      },
      {
        key: "Access-Control-Expose-Headers",
        value: "Content-Range, Content-Length, Accept-Ranges, ETag, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Partner-Platform, X-StrideIQ-Partner",
      },
    ];
    return [
      { source: "/sw.js", headers: [...noStore, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/manifest.webmanifest", headers: noStore },
      {
        source: "/images/:path*",
        headers: [...staticAssetCache, { key: "Access-Control-Allow-Origin", value: "*" }],
      },
      { source: "/audio/:path*", headers: corsHeaders },
      { source: "/videos/:path*", headers: corsHeaders },
      { source: "/api/strideiq/:path*", headers: partnerApiCors },
      { source: "/api/v1/:path*", headers: partnerApiCors },
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
