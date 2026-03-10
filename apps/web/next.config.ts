import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agent-control-tower/domain"],
};

export default nextConfig;
