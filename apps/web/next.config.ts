import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@stackoperator/shared",
    "@stackoperator/database",
    "@stackoperator/github",
    "@stackoperator/stack-core",
    "@stackoperator/config",
    "@stackoperator/decision-engine",
  ],
  serverExternalPackages: ["@prisma/client", "pino", "pg-boss", "prisma"],
};

export default nextConfig;
