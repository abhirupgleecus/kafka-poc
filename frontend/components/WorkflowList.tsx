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
  timeFilter: "today" | "week" | "month" | "all";
  onTimeFilterChange: (value: "today" | "week" | "month" | "all") => void;
  assessmentFilter: "all" | "pending" | "done";
  onAssessmentFilterChange: (value: "all" | "pending" | "done") => void;
  onSubmitAssessment: (upc: string, runId: string, payload: any) => Promise<void>;
  assessmentLoading: Record<string, boolean>;
}

export function WorkflowList({
  upcs,
  workflows,
  loadingByUpc,
  errorByUpc,
  replayLoading,
  rerunLoading,
  onReplay,
  onRerun,
  timeFilter,
  onTimeFilterChange,
  assessmentFilter,
  onAssessmentFilterChange,
  onSubmitAssessment,
  assessmentLoading
}: WorkflowListProps) {
  return (
    <section className="mx-auto mt-8 w-full max-w-6xl">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-ink">Workflow History</h2>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="time-filter" className="text-xs font-semibold uppercase text-slate-500">
              Time:
            </label>
            <select
              id="time-filter"
              value={timeFilter}
              onChange={(e) => onTimeFilterChange(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500"
            >
              <option value="all">Show All</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="assessment-filter" className="text-xs font-semibold uppercase text-slate-500">
              Assessment:
            </label>
            <select
              id="assessment-filter"
              value={assessmentFilter}
              onChange={(e) => onAssessmentFilterChange(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500"
            >
              <option value="all">Any Status</option>
              <option value="pending">Pending</option>
              <option value="done">Completed</option>
            </select>
          </div>
        </div>
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
              onSubmitAssessment={onSubmitAssessment}
              assessmentLoading={assessmentLoading}
            />
          ))}
        </div>
      )}
    </section>
  );
}

