"use client";

import { FormEvent, useState } from "react";
import type { ProduceRequest } from "@/lib/types";

const PHYSICAL_CONDITION_OPTIONS = ["Excellent", "Good", "Fair", "Poor", "Damaged"] as const;
const FUNCTIONAL_STATUS_OPTIONS = [
  "Fully Working",
  "Partially Working",
  "Powers On But Faulty",
  "Dead"
] as const;
const COMPLETENESS_OPTIONS = [
  "Complete",
  "Missing Accessories",
  "Missing Key Components",
  "Heavily Stripped"
] as const;
const AGE_USAGE_TIER_OPTIONS = [
  "Like New (0-1 yr)",
  "Lightly Used (1-3 yr)",
  "Moderately Used (3-5 yr)",
  "Heavily Used (5+ yr)"
] as const;

interface AssessmentDraft {
  physical_condition: string;
  functional_status: string;
  completeness: string;
  estimated_age_usage_tier: string;
}

interface InputSectionProps {
  onSubmit: (payload: ProduceRequest) => Promise<void>;
  onLoadHistory: (upc: string) => Promise<void>;
  loadingSubmit: boolean;
  loadingLoad: boolean;
  message: string | null;
  error: string | null;
  filterUpc: string | null;
  onClearFilter: () => void;
}

export function InputSection({
  onSubmit,
  onLoadHistory,
  loadingSubmit,
  loadingLoad,
  message,
  error,
  filterUpc,
  onClearFilter
}: InputSectionProps) {
  const [upc, setUpc] = useState("");
  const [assessment, setAssessment] = useState<AssessmentDraft>({
    physical_condition: "",
    functional_status: "",
    completeness: "",
    estimated_age_usage_tier: ""
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  function updateAssessment<K extends keyof AssessmentDraft>(field: K, value: AssessmentDraft[K]) {
    setAssessment((current) => ({ ...current, [field]: value }));
    if (validationError) {
      setValidationError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadingSubmit || loadingLoad) {
      return;
    }

    const normalized = upc.trim();
    if (!normalized) {
      setValidationError("Enter a UPC before continuing.");
      return;
    }
    if (
      !assessment.physical_condition ||
      !assessment.functional_status ||
      !assessment.completeness ||
      !assessment.estimated_age_usage_tier
    ) {
      setValidationError("Complete the product assessment before submitting.");
      return;
    }

    setValidationError(null);
    await onSubmit({
      upc: normalized,
      assessment: {
        physical_condition: assessment.physical_condition,
        functional_status: assessment.functional_status,
        completeness: assessment.completeness,
        estimated_age_usage_tier: assessment.estimated_age_usage_tier
      }
    });
    setUpc("");
    setAssessment({
      physical_condition: "",
      functional_status: "",
      completeness: "",
      estimated_age_usage_tier: ""
    });
  }

  async function handleLoad() {
    if (loadingSubmit || loadingLoad) {
      return;
    }

    const normalized = upc.trim();
    if (!normalized) {
      setValidationError("Enter a UPC before continuing.");
      return;
    }

    setValidationError(null);
    await onLoadHistory(normalized);
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-soft backdrop-blur">
      <h1 className="text-3xl font-bold tracking-tight text-ink">LLM Pipeline Workflow Console</h1>
      <p className="mt-2 text-sm text-slate-600">
        Submit a UPC to start a new run, or load existing workflow history from the database.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <input
          value={upc}
          onChange={(event) => {
            setUpc(event.target.value);
            if (validationError) {
              setValidationError(null);
            }
          }}
          placeholder="Enter UPC, e.g. 012345678901"
          className="h-12 rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          disabled={loadingSubmit || loadingLoad}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-slate-700">
            <span className="font-semibold text-slate-800">Physical Condition</span>
            <select
              value={assessment.physical_condition}
              onChange={(event) => updateAssessment("physical_condition", event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              disabled={loadingSubmit || loadingLoad}
            >
              <option value="">Select condition</option>
              {PHYSICAL_CONDITION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-700">
            <span className="font-semibold text-slate-800">Functional Status</span>
            <select
              value={assessment.functional_status}
              onChange={(event) => updateAssessment("functional_status", event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              disabled={loadingSubmit || loadingLoad}
            >
              <option value="">Select status</option>
              {FUNCTIONAL_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-700">
            <span className="font-semibold text-slate-800">Completeness</span>
            <select
              value={assessment.completeness}
              onChange={(event) => updateAssessment("completeness", event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              disabled={loadingSubmit || loadingLoad}
            >
              <option value="">Select completeness</option>
              {COMPLETENESS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-700">
            <span className="font-semibold text-slate-800">Estimated Age / Usage Tier</span>
            <select
              value={assessment.estimated_age_usage_tier}
              onChange={(event) => updateAssessment("estimated_age_usage_tier", event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              disabled={loadingSubmit || loadingLoad}
            >
              <option value="">Select usage tier</option>
              {AGE_USAGE_TIER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={loadingSubmit || loadingLoad}
            className="h-12 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loadingSubmit ? "Submitting..." : "Submit"}
          </button>

          <button
            type="button"
            onClick={handleLoad}
            disabled={loadingSubmit || loadingLoad}
            className="h-12 rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingLoad ? "Loading..." : "Load History"}
          </button>

          {filterUpc && (
            <button
              type="button"
              onClick={onClearFilter}
              className="h-12 rounded-xl border border-brand-200 bg-brand-50 px-6 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              Show all tracked UPCs
            </button>
          )}
        </div>
      </form>

      {validationError ? <p className="mt-3 text-sm text-amber-700">{validationError}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
