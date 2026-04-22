"use client";

import { WorkflowCard } from "@/components/WorkflowCard";
import type { WorkflowResponse } from "@/lib/types";

interface WorkflowListProps {
  upcs: string[];
  workflows: Record<string, WorkflowResponse | null>;
  loadingByUpc: Record<string, boolean>;
  errorByUpc: Record<string, string | null>;
  replayLoading: Record<string, boolean>;
  rerunLoading: Record<string, boolean>;
  onReplay: (upc: string, runId: string) => Promise<void>;
  onRerun: (upc: string, runId: string) => Promise<void>;
}

export function WorkflowList({
  upcs,
  workflows,
  loadingByUpc,
  errorByUpc,
  replayLoading,
  rerunLoading,
  onReplay,
  onRerun
}: WorkflowListProps) {
  return (
    <section className="mx-auto mt-8 w-full max-w-6xl">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-ink">Workflow History</h2>
      </div>

      {upcs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
          <p className="text-sm text-slate-600">No UPC workflows yet. Submit a UPC above to start the pipeline.</p>
          <p className="mt-2 text-xs text-slate-500">
            The UI stores loaded UPCs in local browser storage since the backend does not expose a global list endpoint.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {upcs.map((upc) => (
            <WorkflowCard
              key={upc}
              upc={upc}
              workflow={workflows[upc] ?? null}
              loading={loadingByUpc[upc] ?? false}
              error={errorByUpc[upc] ?? null}
              onReplay={onReplay}
              replayLoading={replayLoading}
              onRerun={onRerun}
              rerunLoading={rerunLoading}
            />
          ))}
        </div>
      )}
    </section>
  );
}

