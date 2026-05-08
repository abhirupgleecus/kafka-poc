"use client";

import { useEffect, useMemo, useState } from "react";

import { AssessmentForm } from "@/components/AssessmentForm";
import { JsonViewer } from "@/components/JsonViewer";
import type { ProductAssessment, WorkflowEvent } from "@/lib/types";

interface StageViewProps {
  event: WorkflowEvent;
  assessmentStatus?: "PENDING" | "COMPLETED";
  onSubmitAssessment?: (payload: ProductAssessment) => Promise<void>;
  assessmentLoading?: boolean;
}

function renderValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return null;
}

function getAssessmentObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (payload.assessment && typeof payload.assessment === "object") {
    return payload.assessment as Record<string, unknown>;
  }

  return payload;
}

function renderAssessmentSummary(value: unknown): string {
  const assessment = getAssessmentObject(value);
  if (!assessment) {
    return "N/A";
  }

  const parts = [
    renderValue(assessment.physical_condition),
    renderValue(assessment.functional_status),
    renderValue(assessment.completeness),
    renderValue(assessment.age_of_product ?? assessment.estimated_age_usage_tier)
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" / ") : "N/A";
}

export function StageView({
  event,
  assessmentStatus,
  onSubmitAssessment,
  assessmentLoading = false
}: StageViewProps) {
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : null;

  const formatSummary = (text: string) => {
    if (!text) return null;

    // Matches [[*Label*]](URL)
    const parts = text.split(/(\[\[\*.+?\*\]\]\(https?:\/\/\S+?\))/g);

    return parts.map((part, i) => {
      const match = part.match(/\[\[\*(.+?)\*\]\]\((https?:\/\/\S+?)\)/);
      if (match) {
        const [, label, url] = match;
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-sm bg-brand-50 px-1 font-medium text-brand-600 transition hover:bg-brand-100 hover:text-brand-700 underline decoration-brand-300 underline-offset-2"
          >
            [<i>{label}</i>]
          </a>
        );
      }
      return part;
    });
  };

  const stage = event.stage.toUpperCase();
  const isEnriched = stage === "ENRICHED";
  const isAssessment = stage === "ASSESSMENT";
  const isTriage = stage === "TRIAGE";
  const isGains = stage === "GAINS";
  const isSummary = stage === "SUMMARY";
  const isEmail = stage === "EMAIL";

  useEffect(() => {
    if (assessmentStatus === "COMPLETED") {
      setShowAssessmentForm(false);
    }
  }, [assessmentStatus]);

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

  async function handleAssessmentSubmit(data: ProductAssessment) {
    if (!onSubmitAssessment) {
      return;
    }

    await onSubmitAssessment(data);
  }

  const summaryLabel = isEnriched
    ? "View Enriched Product JSON"
    : isAssessment
      ? "View Assessment JSON"
      : isEmail
        ? "View Email JSON"
        : "View JSON";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {event.stage}
        </span>
        <time className="text-xs text-slate-500">{formattedTime}</time>
      </div>

      {isEnriched && payload ? (() => {
        const metadata = payload.metadata as Record<string, unknown> | undefined;
        const identity = (metadata?.identity ?? {}) as Record<string, unknown>;
        const technical = payload.technical as Record<string, unknown> | undefined;
        const compliance = payload.compliance as Record<string, unknown> | undefined;
        const marketValue = payload.market_value as Record<string, unknown> | undefined;

        // Backward compat: read from new nested or old flat format
        const productName = renderValue(metadata?.name) || renderValue(payload.name) || renderValue(payload.product_name) || "Unknown Product";
        const brand = renderValue(metadata?.brand) || renderValue(payload.brand);
        const category = renderValue(metadata?.category) || renderValue(payload.category);
        const price = renderValue(marketValue?.current_market_value) || renderValue(payload.estimated_price);
        const productType = renderValue(metadata?.type);

        const subtitle = [brand, category, price ? `$${price}` : null, productType].filter(Boolean).join(" • ");

        return (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-brand-900">{productName}</p>
                  <p className="mt-1 text-xs text-brand-700">
                    {subtitle || "Awaiting manual assessment before triage."}
                  </p>
                </div>

                {assessmentStatus ? (
                  <span
                    className={`self-start rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      assessmentStatus === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    Assessment {assessmentStatus === "COMPLETED" ? "Complete" : "Pending"}
                  </span>
                ) : null}
              </div>

              {/* Technical & Compliance chips (new format only) */}
              {technical ? (
                <div className="flex flex-wrap gap-1.5">
                  {renderValue(technical.weight) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      ⚖️ {renderValue(technical.weight)}
                    </span>
                  ) : null}
                  {renderValue(technical.dimensions) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      📐 {renderValue(technical.dimensions)}
                    </span>
                  ) : null}
                  {renderValue(technical.disassembly_complexity) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      🔧 Disassembly: {renderValue(technical.disassembly_complexity)}
                    </span>
                  ) : null}
                  {renderValue(technical.average_life_span) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      ⏱ Lifespan: {renderValue(technical.average_life_span)}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {compliance ? (() => {
                const hazMats = Array.isArray(compliance.hazardous_materials) ? compliance.hazardous_materials as string[] : [];
                const needsAuth = String(compliance.authorized_needed).toLowerCase() === "yes";
                const hasUserData = String(compliance.contains_user_data).toLowerCase() === "yes";

                return (hazMats.length > 0 || needsAuth || hasUserData) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {needsAuth ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        ⚠ Authorized Recycler Needed
                      </span>
                    ) : null}
                    {hasUserData ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        🔒 Contains User Data
                      </span>
                    ) : null}
                    {hazMats.map((mat) => (
                      <span key={mat} className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                        ☣ {String(mat)}
                      </span>
                    ))}
                  </div>
                ) : null;
              })() : null}

              {/* Market value summary (new format only) */}
              {marketValue ? (
                <div className="grid gap-1.5 sm:grid-cols-3">
                  {renderValue(marketValue.current_market_value) ? (
                    <div className="rounded-lg bg-white/60 px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Market Value</p>
                      <p className="text-sm font-bold text-brand-900">${renderValue(marketValue.current_market_value)}</p>
                    </div>
                  ) : null}
                  {renderValue(marketValue.refurbished_market_value) ? (
                    <div className="rounded-lg bg-white/60 px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Refurbished Value</p>
                      <p className="text-sm font-bold text-emerald-700">${renderValue(marketValue.refurbished_market_value)}</p>
                    </div>
                  ) : null}
                  {renderValue(marketValue.disposal_cost) ? (
                    <div className="rounded-lg bg-white/60 px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Disposal Cost</p>
                      <p className="text-sm font-bold text-rose-700">${renderValue(marketValue.disposal_cost)}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {assessmentStatus === "PENDING" && onSubmitAssessment ? (
                <div className="rounded-xl border border-dashed border-brand-200 bg-white/80 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-700">
                      Complete the human review here to unlock triage for this asset.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAssessmentForm((current) => !current)}
                      disabled={assessmentLoading}
                      className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {showAssessmentForm ? "Hide Assessment Form" : "Complete Assessment"}
                    </button>
                  </div>

                  {showAssessmentForm ? (
                    <AssessmentForm
                      loading={assessmentLoading}
                      onSubmit={handleAssessmentSubmit}
                      onCancel={() => setShowAssessmentForm(false)}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })() : null}


      {isAssessment && payload ? (
        <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-sm font-medium text-cyan-900">
            Manual Assessment: <span className="font-bold">{renderAssessmentSummary(payload)}</span>
          </p>
        </div>
      ) : null}

      {isTriage && payload ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">
            Recommended Triage Path --&gt;{" "}
            <span className="font-bold">
              {renderValue(payload.decision) || renderValue(payload.triage_decision) || "PENDING"}
            </span>
          </p>
        </div>
      ) : null}

      {hasGains && payload ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <h4 className="mb-3 font-semibold text-emerald-900">Gains Analysis</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {renderValue(payload.estimated_profit) !== null ? (
              <div className="text-sm">
                <span className="text-emerald-700">Profit:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.estimated_profit)}%
                </span>
              </div>
            ) : null}
            {renderValue(payload.estimated_profit_percentage) !== null ? (
              <div className="text-sm">
                <span className="text-emerald-700">Estimated Profit:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.estimated_profit_percentage)}%
                </span>
              </div>
            ) : null}
            {renderValue(payload.market_demand) !== null ? (
              <div className="text-sm">
                <span className="text-emerald-700">Market Demand:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.market_demand)}
                </span>
              </div>
            ) : null}
            {renderValue(payload.resale_potential) !== null ? (
              <div className="text-sm">
                <span className="text-emerald-700">Resale Potential:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.resale_potential)}
                </span>
              </div>
            ) : null}
            {renderValue(payload.refurbishment_complexity) !== null ? (
              <div className="text-sm">
                <span className="text-emerald-700">Refurbishment:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.refurbishment_complexity)}
                </span>
              </div>
            ) : null}
            {renderValue(payload.expected_roi) !== null ? (
              <div className="text-sm">
                <span className="text-emerald-700">Expected ROI:</span>
                <span className="ml-2 font-medium text-emerald-900">
                  {renderValue(payload.expected_roi)}%
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isSummary && payload ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-2">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <span className="text-lg">📋</span> Strategic Triage Report
            </h4>
          </div>
          <div className="p-4">
            <div className="prose-sm whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {formatSummary(renderValue(payload.summary) || renderValue(payload.final_summary) || "") || "No report available."}
            </div>
          </div>
        </div>
      ) : null}

      {isEmail && payload ? (
        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
          <p className="text-sm font-medium text-violet-900">
            Notification sent: <span className="font-bold">{renderValue(payload.subject) || "Email delivered"}</span>
          </p>
        </div>
      ) : null}

      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 marker:text-brand-600">
          {summaryLabel}
        </summary>
        <div className="mt-3">
          <JsonViewer data={event.payload} />
        </div>
      </details>
    </article>
  );
}
