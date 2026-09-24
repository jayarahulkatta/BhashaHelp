import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Turbopack is used automatically in dev mode (next dev --turbopack).
     We removed the explicit turbopack config block because it caused
     Google Fonts resolution failures during `next build` on some machines. */
};

export default nextConfig;
