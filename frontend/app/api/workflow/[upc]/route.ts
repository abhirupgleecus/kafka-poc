import { proxyJson } from "@/lib/server/proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ upc: string }> }
): Promise<Response> {
  const { upc } = await context.params;

  return proxyJson(`/workflow/${encodeURIComponent(upc)}`, {
    method: "GET"
  });
}
