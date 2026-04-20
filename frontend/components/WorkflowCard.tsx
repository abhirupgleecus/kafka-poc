"use client";

import { useMemo, useState } from "react";

import { RunGroup } from "@/components/RunGroup";
import type { WorkflowEvent, WorkflowResponse } from "@/lib/types";

interface WorkflowCardProps {
  upc: string;
  workflow: WorkflowResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: (upc: string) => Promise<void>;
  onReplay: (upc: string, runId: string) => Promise<void>;
  replayLoading: Record<string, boolean>;
  onRerun: (upc: string, runId: string) => Promise<void>;
  rerunLoading: Record<string, boolean>;
}

function groupByRun(events: WorkflowEvent[]): Record<string, WorkflowEvent[]> {
  return events.reduce<Record<string, WorkflowEvent[]>>((acc, event) => {
    const runId = event.run_id ?? "legacy-run";

    if (!acc[runId]) {
      acc[runId] = [];
    }

    acc[runId].push(event);
    return acc;
  }, {});
}

function runLastTimestamp(events: WorkflowEvent[]): number {
  return Math.max(...events.map((event) => new Date(event.timestamp).getTime()));
}

export function WorkflowCard({
  upc,
  workflow,
  loading,
  error,
  onRefresh,
  onReplay,
  replayLoading,
  onRerun,
  rerunLoading
}: WorkflowCardProps) {
  const [expanded, setExpanded] = useState(true);

  const groupedRuns = useMemo(() => {
    if (!workflow) {
      return [] as Array<{ runId: string; events: WorkflowEvent[] }>;
    }

    const grouped = groupByRun(workflow.events);

    return Object.entries(grouped)
      .map(([runId, events]) => ({ runId, events }))
      .sort((a, b) => runLastTimestamp(b.events) - runLastTimestamp(a.events));
  }, [workflow]);

  const runCount = groupedRuns.length;
  const eventCount = workflow?.events.length ?? 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">UPC</p>
          <h3 className="text-xl font-bold text-ink">{upc}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {runCount} run{runCount === 1 ? "" : "s"} - {eventCount} event{eventCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRefresh(upc)}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4">
          {loading ? <p className="text-sm text-slate-600">Loading workflow...</p> : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}

          {!loading && !error && groupedRuns.length === 0 ? (
            <p className="text-sm text-slate-500">No workflow events found for this UPC yet.</p>
          ) : null}

          {!loading && !error && groupedRuns.length > 0 ? (
            <div className="grid gap-4">
              {groupedRuns.map((group) => (
                <RunGroup
                  key={group.runId}
                  upc={upc}
                  runId={group.runId}
                  events={group.events}
                  onReplay={onReplay}
                  replayLoading={replayLoading}
                  onRerun={onRerun}
                  rerunLoading={rerunLoading}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}




