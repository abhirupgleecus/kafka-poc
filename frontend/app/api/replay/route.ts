import { proxyJson } from "@/lib/server/proxy";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  return proxyJson("/replay", {
    method: "POST",
    body: JSON.stringify(body)
  });
}
