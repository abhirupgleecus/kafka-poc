import { proxyJson } from "@/lib/server/proxy";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  return proxyJson("/assessment", {
    method: "POST",
    body: JSON.stringify(body)
  });
}
