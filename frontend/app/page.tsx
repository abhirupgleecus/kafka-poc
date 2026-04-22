"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { InputSection } from "@/components/InputSection";
import { ReplayHistoryModal } from "@/components/ReplayHistoryModal";
import { WorkflowList } from "@/components/WorkflowList";
import { fetchWorkflow, produceUpc, replayStage, rerunStage } from "@/lib/api";
import { readKnownUpcs, writeKnownUpcs } from "@/lib/storage";
import type { ReplayResponse, WorkflowResponse } from "@/lib/types";

function getWorkflowTimestamp(workflow: WorkflowResponse | null | undefined): number {
  if (!workflow || workflow.events.length === 0) {
    return 0;
  }

  return Math.max(...workflow.events.map((event) => new Date(event.timestamp).getTime()));
}

function hasInFlightRuns(workflow: WorkflowResponse | null | undefined): boolean {
  if (!workflow || workflow.events.length === 0) {
    return false;
  }

  const stagesByRun = new Map<string, Set<string>>();

  for (const event of workflow.events) {
    const runId = event.run_id ?? "legacy-run";
    const stage = event.stage.toUpperCase();

    if (!stagesByRun.has(runId)) {
      stagesByRun.set(runId, new Set<string>());
    }

    stagesByRun.get(runId)?.add(stage);
  }

  for (const stages of stagesByRun.values()) {
    if (!stages.has("SUMMARY")) {
      return true;
    }
  }

  return false;
}

export default function HomePage() {
  const [knownUpcs, setKnownUpcs] = useState<string[]>([]);
  const [hasLoadedKnownUpcs, setHasLoadedKnownUpcs] = useState(false);
  const [workflows, setWorkflows] = useState<Record<string, WorkflowResponse | null>>({});
  const [loadingByUpc, setLoadingByUpc] = useState<Record<string, boolean>>({});
  const [backgroundLoadingByUpc, setBackgroundLoadingByUpc] = useState<Record<string, boolean>>({});
  const [errorByUpc, setErrorByUpc] = useState<Record<string, string | null>>({});
  const [replayLoading, setReplayLoading] = useState<Record<string, boolean>>({});
  const [rerunLoading, setRerunLoading] = useState<Record<string, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [filterUpc, setFilterUpc] = useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [replayModalData, setReplayModalData] = useState<ReplayResponse | null>(null);

  const refreshWorkflow = useCallback(async (upc: string, isBackground = false): Promise<WorkflowResponse | null> => {
    if (isBackground) {
      setBackgroundLoadingByUpc((prev) => ({ ...prev, [upc]: true }));
    } else {
      setLoadingByUpc((prev) => ({ ...prev, [upc]: true }));
    }
    setErrorByUpc((prev) => ({ ...prev, [upc]: null }));

    try {
      const workflow = await fetchWorkflow(upc);
      setWorkflows((prev) => ({ ...prev, [upc]: workflow }));
      return workflow;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch workflow";
      setErrorByUpc((prev) => ({ ...prev, [upc]: message }));
      setWorkflows((prev) => ({ ...prev, [upc]: null }));
      return null;
    } finally {
      if (isBackground) {
        setBackgroundLoadingByUpc((prev) => ({ ...prev, [upc]: false }));
      } else {
        setLoadingByUpc((prev) => ({ ...prev, [upc]: false }));
      }
    }
  }, []);

  useEffect(() => {
    const storedUpcs = readKnownUpcs();
    setKnownUpcs(storedUpcs);
    setHasLoadedKnownUpcs(true);

    storedUpcs.forEach((upc) => {
      void refreshWorkflow(upc);
    });
  }, [refreshWorkflow]);

  useEffect(() => {
    if (!hasLoadedKnownUpcs) {
      return;
    }

    writeKnownUpcs(knownUpcs);
  }, [knownUpcs, hasLoadedKnownUpcs]);

  useEffect(() => {
    if (knownUpcs.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      const targets = knownUpcs.filter((upc) => {
        if (loadingByUpc[upc] || backgroundLoadingByUpc[upc]) {
          return false;
        }

        return hasInFlightRuns(workflows[upc]);
      });

      if (targets.length === 0) {
        return;
      }

      void Promise.all(targets.map((upc) => refreshWorkflow(upc, true)));
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [knownUpcs, workflows, loadingByUpc, refreshWorkflow]);

  const sortedUpcs = useMemo(() => {
    const list = filterUpc ? [filterUpc] : knownUpcs;
    return [...list].sort((a, b) => {
      return getWorkflowTimestamp(workflows[b]) - getWorkflowTimestamp(workflows[a]);
    });
  }, [knownUpcs, workflows, filterUpc]);

  const handleProduce = useCallback(
    async (upc: string) => {
      setIsSubmitting(true);
      setSubmitMessage(null);
      setSubmitError(null);
      setActionMessage(null);
      setActionError(null);

      try {
        await produceUpc({ upc });

        setKnownUpcs((prev) => (prev.includes(upc) ? prev : [upc, ...prev]));
        setSubmitMessage(`UPC ${upc} submitted. RAW stage event created.`);

        await refreshWorkflow(upc);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit UPC";
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [refreshWorkflow]
  );

  const handleLoadHistory = useCallback(
    async (upc: string) => {
      setIsLoadingHistory(true);
      setSubmitMessage(null);
      setSubmitError(null);
      setActionMessage(null);
      setActionError(null);

      try {
        const workflow = await refreshWorkflow(upc);

        if (!workflow) {
          setSubmitError(`No workflow history found for UPC ${upc}.`);
          return;
        }

        setKnownUpcs((prev) => (prev.includes(upc) ? prev : [upc, ...prev]));
        setFilterUpc(upc);
        setSubmitMessage(`Loaded workflow history for UPC ${upc}.`);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [refreshWorkflow]
  );

  const handleReplay = useCallback(
    async (upc: string, runId: string) => {
      const key = `${upc}:${runId}:replay`;

      setReplayLoading((prev) => ({ ...prev, [key]: true }));
      setActionMessage(null);
      setActionError(null);

      try {
        const result = await replayStage({ upc, run_id: runId });
        setReplayModalData(result);
        setActionMessage(`Loaded replay history for UPC ${upc} run ${runId}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Replay failed";
        setActionError(message);
      } finally {
        setReplayLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    []
  );

  const handleRerun = useCallback(
    async (upc: string, runId: string) => {
      const key = `${upc}:${runId}:rerun`;

      setRerunLoading((prev) => ({ ...prev, [key]: true }));
      setActionMessage(null);
      setActionError(null);

      try {
        const result = await rerunStage({ upc, run_id: runId });
        setActionMessage(
          `Rerun started for UPC ${upc}. New run_id: ${result.run_id}. Condition: ${result.condition}.`
        );
        await refreshWorkflow(upc);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Rerun failed";
        setActionError(message);
      } finally {
        setRerunLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [refreshWorkflow]
  );

  const handleRefresh = useCallback(
    async (upc: string) => {
      await refreshWorkflow(upc);
    },
    [refreshWorkflow]
  );

  return (
    <main className="px-4 py-10 sm:px-6">
      <InputSection
        onSubmit={handleProduce}
        onLoadHistory={handleLoadHistory}
        loadingSubmit={isSubmitting}
        loadingLoad={isLoadingHistory}
        message={submitMessage}
        error={submitError}
        filterUpc={filterUpc}
        onClearFilter={() => setFilterUpc(null)}
      />

      {actionMessage ? (
        <p className="mx-auto mt-4 w-full max-w-6xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMessage}
        </p>
      ) : null}

      {actionError ? (
        <p className="mx-auto mt-4 w-full max-w-6xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {actionError}
        </p>
      ) : null}

      <WorkflowList
        upcs={sortedUpcs}
        workflows={workflows}
        loadingByUpc={loadingByUpc}
        errorByUpc={errorByUpc}
        replayLoading={replayLoading}
        rerunLoading={rerunLoading}
        onRefresh={handleRefresh}
        onReplay={handleReplay}
        onRerun={handleRerun}
      />

      <ReplayHistoryModal data={replayModalData} onClose={() => setReplayModalData(null)} />
    </main>
  );
}
