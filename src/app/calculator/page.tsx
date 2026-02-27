// src/app/calculator/page.tsx
// ============================================================================
// CALCULATOR PAGE — RSC route shell
// ============================================================================
// Server Component. Sets metadata and renders the client-side CalculatorShell
// inside a centered max-w-4xl container.
// No data fetching. No auth. Pure UI entry point.
// ============================================================================

import type { Metadata } from "next";
import { CalculatorErrorBoundary } from "@/features/calculator/components/CalculatorErrorBoundary";
import { CalculatorShell } from "@/features/calculator/components/CalculatorShell";

export const metadata: Metadata = {
  title: "Electrical BOM Calculator — WireMart",
  description:
    "Get an IS 732:2019 compliant Bill of Materials for your NCR home — wires, MCBs, conduit, and more. Instant estimate, no sign-up required.",
};

export default function CalculatorPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Electrical BOM Calculator</h1>
        <p className="mt-2 text-muted-foreground">
          IS 732:2019 compliant estimates for NCR residential properties. Select a preset or
          configure your own layout below.
        </p>
      </div>

      {/* Client shell — owns all state and engine calls */}
      <CalculatorErrorBoundary>
        <CalculatorShell />
      </CalculatorErrorBoundary>
    </main>
  );
}
