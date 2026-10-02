import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // core and theme ship TypeScript source from the workspace; Next compiles them.
  transpilePackages: ["@bunktab/core", "@bunktab/theme"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
};

export default nextConfig;
