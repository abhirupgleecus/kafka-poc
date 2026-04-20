"use client";

import { StageView } from "@/components/StageView";
import type { WorkflowEvent } from "@/lib/types";

const STAGES = ["ENRICHED", "TRIAGE", "GAINS", "SUMMARY"] as const;

interface RunGroupProps {
  upc: string;
  runId: string;
  events: WorkflowEvent[];
  onReplay: (upc: string, runId: string) => Promise<void>;
  onRerun: (upc: string, runId: string) => Promise<void>;
  replayLoading: Record<string, boolean>;
  rerunLoading: Record<string, boolean>;
}

function sortEvents(events: WorkflowEvent[]): WorkflowEvent[] {
  return [...events].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

// Map old stage names to new ones
function mapStageName(stage: string): string {
  const stageMap: Record<string, string> = {
    "RAW": "ENRICHED",
    "ENRICHED": "ENRICHED",
    "TRIAGE": "TRIAGE",
    "SUMMARY": "SUMMARY",
    "GAINS": "GAINS"
  };
  return stageMap[stage.toUpperCase()] || stage.toUpperCase();
}

export function RunGroup({
  upc,
  runId,
  events,
  onReplay,
  onRerun,
  replayLoading,
  rerunLoading
}: RunGroupProps) {
  const sortedEvents = sortEvents(events).filter(event => event.stage.toUpperCase() !== "RAW");
  const stageSet = new Set(sortedEvents.map((event) => mapStageName(event.stage)));
  const replayKey = `${upc}:${runId}:replay`;
  const rerunKey = `${upc}:${runId}:rerun`;
  const isReplaying = replayLoading[replayKey] === true;
  const isRerunning = rerunLoading[rerunKey] === true;

  const hasSummary = stageSet.has("SUMMARY");
  const hasEnriched = stageSet.has("ENRICHED");

  const completedInSequence = STAGES.reduce((count, stage, index) => {
    if (index > count) {
      return count;
    }
    return stageSet.has(stage) ? count + 1 : count;
  }, 0);

  const progressPercent = (completedInSequence / STAGES.length) * 100;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run ID</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-800">{runId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onReplay(upc, runId)}
            disabled={isReplaying || !hasSummary}
            className="rounded-lg border border-accent-500/30 bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-600 transition hover:bg-accent-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isReplaying ? "Loading Replay..." : "Replay"}
          </button>
          <button
            type="button"
            onClick={() => onRerun(upc, runId)}
            disabled={isRerunning || !hasEnriched}
            className="rounded-lg border border-brand-500/30 bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRerunning ? "Rerunning..." : "Rerun"}
          </button>
        </div>
      </div>

      {!hasSummary ? (
        <p className="mt-3 text-xs text-slate-500">Replay will unlock after this run reaches Final Summary stage.</p>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STAGES.map((stage) => {
            const done = stageSet.has(stage);
            return (
              <div
                key={stage}
                className={`rounded-lg border px-2 py-1 text-center text-[11px] font-semibold ${
                  done
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {stage} - {done ? "DONE" : "PENDING"}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {sortedEvents.map((event, index) => (
          <StageView key={`${event.stage}-${event.timestamp}-${index}`} event={event} />
        ))}
      </div>
    </section>
  );
}



