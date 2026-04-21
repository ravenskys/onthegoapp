import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disabled: React Compiler + dev bundler can stall first-page compile on some setups; re-enable after verifying dev works.
  reactCompiler: false,
  distDir,
};

export default nextConfig;
