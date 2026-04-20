import type {
  ProduceRequest,
  ReplayRequest,
  ReplayResponse,
  RerunRequest,
  RerunResponse,
  WorkflowResponse
} from "@/lib/types";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch {
    throw new Error("Network error while contacting API");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const data = (await response.json()) as { detail?: string };
      if (data?.detail) {
        message = data.detail;
      }
    } catch {
      // Keep default message if body is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function produceUpc(payload: ProduceRequest): Promise<void> {
  await apiFetch("/api/produce", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function replayStage(payload: ReplayRequest): Promise<ReplayResponse> {
  return apiFetch<ReplayResponse>("/api/replay", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function rerunStage(payload: RerunRequest): Promise<RerunResponse> {
  return apiFetch<RerunResponse>("/api/rerun", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchWorkflow(upc: string): Promise<WorkflowResponse> {
  return apiFetch<WorkflowResponse>(`/api/workflow/${encodeURIComponent(upc)}`);
}
