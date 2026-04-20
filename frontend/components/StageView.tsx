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
  const isGainsStage = event.stage.toUpperCase() === "GAINS";

  const formattedTime = useMemo(() => {
    const value = new Date(event.timestamp);
    if (Number.isNaN(value.getTime())) {
      return event.timestamp;
    }

    return value.toLocaleString();
  }, [event.timestamp]);

  const hasGains = useMemo(() => {
    return (
      isGainsStage &&
      payload &&
      ("market_demand" in payload ||
        "resale_potential" in payload ||
        "refurbishment_complexity" in payload ||
        "expected_roi" in payload)
    );
  }, [isGainsStage, payload]);

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

      {!isGainsStage ? (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 marker:text-brand-600">
            Payload JSON
          </summary>
          <div className="mt-3">
            <JsonViewer data={event.payload} />
          </div>
        </details>
      ) : null}
    </article>
  );
}
