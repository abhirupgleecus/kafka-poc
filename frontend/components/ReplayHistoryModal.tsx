"use client";

import { useEffect } from "react";

import { JsonViewer } from "@/components/JsonViewer";
import type { ReplayResponse } from "@/lib/types";

interface ReplayHistoryModalProps {
  data: ReplayResponse | null;
  onClose: () => void;
}

function renderJsonOrEmpty(value: Record<string, unknown> | null) {
  if (!value) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
        No data available.
      </div>
    );
  }

  return <JsonViewer data={value} />;
}

export function ReplayHistoryModal({ data, onClose }: ReplayHistoryModalProps) {
  useEffect(() => {
    if (!data) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [data, onClose]);

  if (!data) {
    return null;
  }

  const completedCount = data.stages.filter((stage) => stage.status === "COMPLETED").length;
  const completionPercent =
    data.stages.length > 0 ? Math.round((completedCount / data.stages.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Replay History"
    >
      <div
        className="mx-auto flex w-full max-w-7xl flex-col rounded-2xl border border-slate-200 bg-white shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 rounded-t-2xl border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Replay History
              </p>
              <h3 className="text-xl font-bold text-ink">UPC {data.upc}</h3>
              <p className="mt-1 break-all font-mono text-xs text-slate-600">{data.run_id}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="self-start rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              aria-label="Close replay modal"
            >
              Close
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
              <span>
                Completed: <span className="font-semibold text-slate-800">{completedCount}</span> /{" "}
                {data.stages.length}
              </span>
              <span className="font-semibold text-brand-700">{completionPercent}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
        </header>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {data.stages.map((stage, index) => (
              <article key={`${stage.stage}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Stage {index + 1}
                    </p>
                    <h4 className="text-sm font-bold text-ink">{stage.stage}</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      {stage.timestamp
                        ? new Date(stage.timestamp).toLocaleString()
                        : "Timestamp unavailable"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      stage.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700"
                        : "border border-dashed border-slate-300 bg-white text-slate-500"
                    }`}
                  >
                    {stage.status}
                  </span>
            </div>

                <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                  <span className="font-semibold text-slate-800">Notes:</span> {stage.notes || "No notes."}
                </p>

                <div className="mt-4 grid gap-3">
                  <section>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Input Payload
                    </p>
                    {stage.input ? (
                      <JsonViewer data={stage.input} className="max-h-56" />
                    ) : (
                      renderJsonOrEmpty(stage.input)
                    )}
                  </section>

                  <section>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Output Payload
                    </p>
                    {stage.output ? (
                      <JsonViewer data={stage.output} className="max-h-56" />
                    ) : (
                      renderJsonOrEmpty(stage.output)
                    )}
                  </section>
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 rounded-b-2xl border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Close Replay
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
