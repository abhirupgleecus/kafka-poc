import type { NextConfig } from "next";

function parseAllowedOrigins(): string[] {
  const raw = process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

const allowedDevOrigins = Array.from(
  new Set(["localhost", "127.0.0.1", "192.168.1.30", ...parseAllowedOrigins()])
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins
};

export default nextConfig;
