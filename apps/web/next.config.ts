import path from "node:path";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import type { NextConfig } from "next";

dotenvExpand.expand(dotenv.config({ path: path.resolve(__dirname, "../../.env") }));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@axon/db", "@axon/shared"],
  devIndicators: false,
  // Slim production image: .next/standalone becomes a self-contained server
  // with only runtime deps. apps/web/Dockerfile depends on this.
  output: "standalone",
};

export default nextConfig;
