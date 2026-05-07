"use client";

import { memo } from "react";

import { StageView } from "@/components/StageView";
import type { ProductAssessment, WorkflowEvent } from "@/lib/types";
import {
  VISIBLE_STAGES,
  getDerivedStageSet,
  isAssessmentPending,
  isRunComplete,
  normalizeStage,
  sortEvents
} from "@/lib/workflow";

interface RunGroupProps {
  upc: string;
  runId: string;
  events: WorkflowEvent[];
  onReplay: (upc: string, runId: string) => Promise<void>;
  onRerun: (upc: string, runId: string) => Promise<void>;
  onSubmitAssessment: (upc: string, runId: string, payload: ProductAssessment) => Promise<void>;
  replayLoading: Record<string, boolean>;
  rerunLoading: Record<string, boolean>;
  assessmentLoading: Record<string, boolean>;
}

function RunGroupComponent({
  upc,
  runId,
  events,
  onReplay,
  onRerun,
  onSubmitAssessment,
  replayLoading,
  rerunLoading,
  assessmentLoading
}: RunGroupProps) {
  const sortedEvents = sortEvents(events).filter((event) => normalizeStage(event.stage) !== "RAW");
  const stageSet = getDerivedStageSet(events);
  const replayKey = `${upc}:${runId}:replay`;
  const rerunKey = `${upc}:${runId}:rerun`;
  const assessmentKey = `${upc}:${runId}:assessment`;
  const isReplaying = replayLoading[replayKey] === true;
  const isRerunning = rerunLoading[rerunKey] === true;
  const isSavingAssessment = assessmentLoading[assessmentKey] === true;
  const hasEnriched = stageSet.has("ENRICHED");
  const assessmentPending = isAssessmentPending(events);
  const replayUnlocked = isRunComplete(events);

  const completedInSequence = VISIBLE_STAGES.reduce((count, stage, index) => {
    if (index > count) {
      return count;
    }

    return stageSet.has(stage) ? count + 1 : count;
  }, 0);

  const isComplete = completedInSequence === VISIBLE_STAGES.length;
  // If not complete, the next stage after the last completed one is "In Progress"
  const progressPercent = isComplete
    ? 100
    : ((completedInSequence + 0.5) / VISIBLE_STAGES.length) * 100;

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
            disabled={isReplaying || !replayUnlocked}
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

      {!replayUnlocked ? (
        <p className="mt-3 text-xs text-slate-500">
          Replay will unlock after this run reaches the final Email stage.
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-in-out ${isComplete ? "bg-emerald-500" : "bg-brand-600"
              }`}
            style={{ width: `${progressPercent}%` }}
          />
          {!isComplete ? (
            <div
              className="absolute inset-0 animate-shimmer rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {VISIBLE_STAGES.map((stage, index) => {
            const isDone = stageSet.has(stage);
            const isInProgress = !isDone && index === completedInSequence;

            return (
              <div
                key={stage}
                className={`rounded-lg border px-2 py-1 text-center text-[10px] font-bold uppercase tracking-tight transition-all duration-300 ${isDone
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : isInProgress
                      ? "animate-pulse border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-100 bg-slate-50 text-slate-400"
                  }`}
              >
                {stage}
                <span className="block text-[9px] opacity-80">
                  {isDone
                    ? "Done"
                    : isInProgress
                      ? stage === "ASSESSMENT"
                        ? "Waiting for submission"
                        : "In Progress"
                      : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {sortedEvents.map((event, index) => {
          const normalizedStage = normalizeStage(event.stage);
          return (
            <StageView
              key={`${event.stage}-${event.timestamp}-${index}`}
              event={event}
              assessmentStatus={
                normalizedStage === "ENRICHED"
                  ? stageSet.has("ASSESSMENT")
                    ? "COMPLETED"
                    : "PENDING"
                  : undefined
              }
              onSubmitAssessment={
                normalizedStage === "ENRICHED" && assessmentPending
                  ? (payload) => onSubmitAssessment(upc, runId, payload)
                  : undefined
              }
              assessmentLoading={normalizedStage === "ENRICHED" ? isSavingAssessment : false}
            />
          );
        })}
      </div>
    </section>
  );
}

export const RunGroup = memo(RunGroupComponent);
