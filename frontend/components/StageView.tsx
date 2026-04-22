"use client";

import { useMemo } from "react";

import type { WorkflowEvent } from "@/lib/types";
import { JsonViewer } from "@/components/JsonViewer";

interface StageViewProps {
  event: WorkflowEvent;
}

export function StageView({ event }: StageViewProps) {
  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : null;
  const stage = event.stage.toUpperCase();
  const isEnriched = stage === "ENRICHED";
  const isTriage = stage === "TRIAGE";
  const isGains = stage === "GAINS";
  const isSummary = stage === "SUMMARY";

  const formattedTime = useMemo(() => {
    const value = new Date(event.timestamp);
    if (Number.isNaN(value.getTime())) {
      return event.timestamp;
    }

    return value.toLocaleString();
  }, [event.timestamp]);

  const hasGains = useMemo(() => {
    return (
      isGains &&
      payload &&
      ("market_demand" in payload ||
        "resale_potential" in payload ||
        "refurbishment_complexity" in payload ||
        "expected_roi" in payload)
    );
  }, [isGains, payload]);

  const renderValue = (value: unknown): string | null => {
    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }
    return null;
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {event.stage}
        </span>
        <time className="text-xs text-slate-500">{formattedTime}</time>
      </div>

      {isEnriched && payload && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-brand-900">
              {renderValue(payload.name) || renderValue(payload.product_name) || "Unknown Product"}
            </p>
            <p className="text-xs text-brand-700">
              Condition: <span className="font-semibold">{renderValue(payload.condition) || "N/A"}</span>
            </p>
          </div>
        </div>
      )}

      {isTriage && payload && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">
            Recommended Triage Path --&gt; <span className="font-bold">{renderValue(payload.decision) || renderValue(payload.triage_decision) || "PENDING"}</span>
          </p>
        </div>
      )}

      {hasGains && payload && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <h4 className="mb-3 font-semibold text-emerald-900">Gains Analysis</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {renderValue(payload.estimated_profit) !== null && (
              <div className="text-sm">
                <span className="text-emerald-700">Profit:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.estimated_profit)}%
                </span>
              </div>
            )}
            {renderValue(payload.market_demand) !== null && (
              <div className="text-sm">
                <span className="text-emerald-700">Market Demand:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.market_demand)}
                </span>
              </div>
            )}
            {renderValue(payload.resale_potential) !== null && (
              <div className="text-sm">
                <span className="text-emerald-700">Resale Potential:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.resale_potential)}
                </span>
              </div>
            )}
            {renderValue(payload.refurbishment_complexity) !== null && (
              <div className="text-sm">
                <span className="text-emerald-700">Refurbishment:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.refurbishment_complexity)}
                </span>
              </div>
            )}
            {renderValue(payload.expected_roi) !== null && (
              <div className="text-sm">
                <span className="text-emerald-700">Expected ROI:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.expected_roi)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {isSummary && payload && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-700 leading-relaxed">
            {renderValue(payload.summary) || renderValue(payload.final_summary) || "No summary available."}
          </p>
        </div>
      )}

      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 marker:text-brand-600">
          {isEnriched ? "View Enriched Product JSON" : "View JSON"}
        </summary>
        <div className="mt-3">
          <JsonViewer data={event.payload} />
        </div>
      </details>
    </article>
  );
}
