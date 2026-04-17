import path from "node:path";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import type { NextConfig } from "next";

dotenvExpand.expand(dotenv.config({ path: path.resolve(__dirname, "../../.env") }));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@axon/db", "@axon/shared"],
};

export default nextConfig;
