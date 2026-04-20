"use client";

import { FormEvent, useState } from "react";

interface InputSectionProps {
  onSubmit: (upc: string) => Promise<void>;
  onLoadHistory: (upc: string) => Promise<void>;
  loadingSubmit: boolean;
  loadingLoad: boolean;
  message: string | null;
  error: string | null;
}

export function InputSection({
  onSubmit,
  onLoadHistory,
  loadingSubmit,
  loadingLoad,
  message,
  error
}: InputSectionProps) {
  const [upc, setUpc] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

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

    setValidationError(null);
    await onSubmit(normalized);
    setUpc("");
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
        </div>
      </form>

      {validationError ? <p className="mt-3 text-sm text-amber-700">{validationError}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
