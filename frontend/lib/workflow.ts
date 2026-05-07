import type { WorkflowEvent, WorkflowResponse } from "@/lib/types";

export const VISIBLE_STAGES = [
  "ENRICHED",
  "ASSESSMENT",
  "TRIAGE",
  "GAINS",
  "SUMMARY",
  "EMAIL"
] as const;

export function sortEvents(events: WorkflowEvent[]): WorkflowEvent[] {
  return [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function normalizeStage(stage: string): string {
  const normalized = stage.toUpperCase();
  const stageMap: Record<string, string> = {
    RAW: "RAW",
    ENRICHED: "ENRICHED",
    ASSESSMENT: "ASSESSMENT",
    TRIAGE: "TRIAGE",
    GAINS: "GAINS",
    SUMMARY: "SUMMARY",
    EMAIL: "EMAIL",
    NOTIFIER: "EMAIL"
  };

  return stageMap[normalized] ?? normalized;
}

export function groupByRun(events: WorkflowEvent[]): Record<string, WorkflowEvent[]> {
  return events.reduce<Record<string, WorkflowEvent[]>>((acc, event) => {
    const runId = event.run_id ?? "legacy-run";

    if (!acc[runId]) {
      acc[runId] = [];
    }

    acc[runId].push(event);
    return acc;
  }, {});
}

function getPayload(event: WorkflowEvent | undefined): Record<string, unknown> | null {
  if (!event || !event.payload || typeof event.payload !== "object") {
    return null;
  }

  return event.payload as Record<string, unknown>;
}

function getLatestEventForStage(events: WorkflowEvent[], stage: string): WorkflowEvent | undefined {
  const target = stage.toUpperCase();
  return [...sortEvents(events)].reverse().find((event) => normalizeStage(event.stage) === target);
}

export function getActualStageSet(events: WorkflowEvent[]): Set<string> {
  return new Set(events.map((event) => normalizeStage(event.stage)));
}

export function getDerivedStageSet(events: WorkflowEvent[]): Set<string> {
  const stageSet = getActualStageSet(events);
  const rawPayload = getPayload(getLatestEventForStage(events, "RAW"));
  const enrichedPayload = getPayload(getLatestEventForStage(events, "ENRICHED"));
  const summaryPayload = getPayload(getLatestEventForStage(events, "SUMMARY"));

  const hasLegacyAssessment =
    !stageSet.has("ASSESSMENT") &&
    Boolean(
      rawPayload?.assessment ||
        enrichedPayload?.assessment ||
        enrichedPayload?.condition
    );
  if (hasLegacyAssessment) {
    stageSet.add("ASSESSMENT");
  }

  const hasLegacyEmail =
    !stageSet.has("EMAIL") &&
    (summaryPayload?.email_sent === true || typeof summaryPayload?.email_sent_at === "string");
  if (hasLegacyEmail) {
    stageSet.add("EMAIL");
  }

  return stageSet;
}

export function countVisibleEvents(events: WorkflowEvent[]): number {
  return events.filter((event) => normalizeStage(event.stage) !== "RAW").length;
}

export function isAssessmentPending(events: WorkflowEvent[]): boolean {
  const stageSet = getDerivedStageSet(events);
  return stageSet.has("ENRICHED") && !stageSet.has("ASSESSMENT");
}

export function isAssessmentDone(events: WorkflowEvent[]): boolean {
  return getDerivedStageSet(events).has("ASSESSMENT");
}

export function isRunComplete(events: WorkflowEvent[]): boolean {
  const actualStageSet = getActualStageSet(events);
  const derivedStageSet = getDerivedStageSet(events);

  return derivedStageSet.has("EMAIL") || (!actualStageSet.has("ASSESSMENT") && derivedStageSet.has("SUMMARY"));
}

export function workflowMatchesAssessmentFilter(
  workflow: WorkflowResponse | null | undefined,
  filter: "all" | "pending" | "done"
): boolean {
  if (filter === "all") {
    return true;
  }

  if (!workflow || workflow.events.length === 0) {
    return false;
  }

  const runs = Object.values(groupByRun(workflow.events));

  if (filter === "pending") {
    return runs.some((events) => isAssessmentPending(events));
  }

  return runs.some((events) => isAssessmentDone(events));
}
