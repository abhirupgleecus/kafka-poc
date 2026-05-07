"use client";

import { FormEvent, useState } from "react";

import type { ProductAssessment } from "@/lib/types";

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
const AGE_OF_PRODUCT_OPTIONS = ["0-1 years", "1-5 years", "5-10 years", "10+ years"] as const;

interface AssessmentFormProps {
  loading: boolean;
  onSubmit: (payload: ProductAssessment) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function AssessmentForm({
  loading,
  onSubmit,
  onCancel,
  submitLabel = "Save Assessment"
}: AssessmentFormProps) {
  const [assessment, setAssessment] = useState<ProductAssessment>({
    physical_condition: "",
    functional_status: "",
    completeness: "",
    age_of_product: ""
  });
  const [error, setError] = useState<string | null>(null);

  function updateAssessment<K extends keyof ProductAssessment>(field: K, value: ProductAssessment[K]) {
    setAssessment((current) => ({ ...current, [field]: value }));
    if (error) {
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !assessment.physical_condition ||
      !assessment.functional_status ||
      !assessment.completeness ||
      !assessment.age_of_product
    ) {
      setError("Complete the assessment before submitting.");
      return;
    }

    setError(null);
    await onSubmit(assessment);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-slate-700">
          <span className="font-semibold text-slate-800">Physical Condition</span>
          <select
            value={assessment.physical_condition}
            onChange={(event) => updateAssessment("physical_condition", event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            disabled={loading}
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
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            disabled={loading}
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
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            disabled={loading}
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
          <span className="font-semibold text-slate-800">Age of Product</span>
          <select
            value={assessment.age_of_product}
            onChange={(event) => updateAssessment("age_of_product", event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            disabled={loading}
          >
            <option value="">Select age</option>
            {AGE_OF_PRODUCT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Saving..." : submitLabel}
        </button>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-amber-700">{error}</p> : null}
    </form>
  );
}
