"use client";

import { memo, useMemo, useState } from "react";

import { RunGroup } from "@/components/RunGroup";
import type { WorkflowEvent, WorkflowResponse } from "@/lib/types";
import { countVisibleEvents, isAssessmentDone, isAssessmentPending } from "@/lib/workflow";

interface WorkflowCardProps {
  upc: string;
  workflow: WorkflowResponse | null;
  loading: boolean;
  error: string | null;
  onReplay: (upc: string, runId: string) => Promise<void>;
  replayLoading: Record<string, boolean>;
  onRerun: (upc: string, runId: string) => Promise<void>;
  rerunLoading: Record<string, boolean>;
  onSubmitAssessment: (upc: string, runId: string, payload: any) => Promise<void>;
  assessmentLoading: Record<string, boolean>;
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

function WorkflowCardComponent({
  upc,
  workflow,
  loading,
  error,
  onReplay,
  replayLoading,
  onRerun,
  rerunLoading,
  onSubmitAssessment,
  assessmentLoading
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
  const eventCount = workflow ? countVisibleEvents(workflow.events) : 0;

  const overallStatus = useMemo(() => {
    if (groupedRuns.length === 0) return null;
    // We check if ANY run is pending, otherwise if ANY is done
    const runs = groupedRuns.map(g => g.events);
    if (runs.some(isAssessmentPending)) return "PENDING";
    if (runs.some(isAssessmentDone)) return "COMPLETED";
    return null;
  }, [groupedRuns]);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">UPC</p>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-ink">{upc}</h3>
            {overallStatus && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  overallStatus === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                Assessment {overallStatus === "COMPLETED" ? "Complete" : "Pending"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {runCount} run{runCount === 1 ? "" : "s"} - {eventCount} event{eventCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
                  onSubmitAssessment={onSubmitAssessment}
                  assessmentLoading={assessmentLoading}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export const WorkflowCard = memo(WorkflowCardComponent);
