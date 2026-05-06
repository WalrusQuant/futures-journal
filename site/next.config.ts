import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath: "/futures-journal",
  images: { unoptimized: true },
  outputFileTracingIncludes: {
    "/docs/**": ["../docs/**/*"],
  },
};

export default nextConfig;
