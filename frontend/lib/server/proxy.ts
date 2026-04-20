import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let cachedBackendBase: string | null = null;

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const raw = readFileSync(filePath, "utf-8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (key) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function resolveBackendBase(): string {
  if (cachedBackendBase) {
    return cachedBackendBase;
  }

  const rootEnv = parseEnvFile(path.resolve(process.cwd(), "..", ".env"));
  const backendEnv = parseEnvFile(path.resolve(process.cwd(), "..", "backend", ".env"));

  cachedBackendBase =
    process.env.BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    rootEnv.BACKEND_API_BASE_URL ??
    backendEnv.BACKEND_API_BASE_URL ??
    rootEnv.NEXT_PUBLIC_API_BASE_URL ??
    backendEnv.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:8000";

  return cachedBackendBase;
}

export function backendUrl(pathname: string): string {
  return `${resolveBackendBase()}${pathname}`;
}

export async function proxyJson(pathname: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(backendUrl(pathname), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = await response.json();
    return Response.json(json, { status: response.status });
  }

  const text = await response.text();
  return new Response(text, { status: response.status });
}
