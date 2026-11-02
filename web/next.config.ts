import type { NextConfig } from "next";

/**
 * Static export: the whole site is pre-rendered to plain HTML/JS in `out/`
 * so it can be served by any static host (or opened via a file server).
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
