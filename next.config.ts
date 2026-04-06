import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  distDir,
};

export default nextConfig;
