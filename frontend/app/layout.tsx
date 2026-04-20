import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Pipeline Workflow Console",
  description: "Trigger UPC runs, inspect run timelines, replay run history, and rerun from enriched stage."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

