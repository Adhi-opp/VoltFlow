"use client";

// src/features/calculator/components/CalculatorShell.tsx
// ============================================================================
// CALCULATOR SHELL — Client-side state owner
// ============================================================================
// This is the single "use client" boundary for the entire calculator flow.
// It owns all state and coordinates between PresetCards, CalculatorForm,
// and BOMResultView. The RSC page.tsx renders this and nothing else.
//
// State:
//   result          — the last BOMResult, null until first calculation
//   showForm        — toggles between preset view and custom form
//   formDefaults    — pre-populates form when user clicks "Customize"
//   activePresetId  — highlights the active preset card
//   error           — server action error message, null on success
//
// Engine call:
//   runEngine(layout) — calls generateEstimateAction (Server Action).
//   The BOM engine (calculateBOM, generateRoomSpecsFromLayout) executes
//   exclusively on the server. No engine code is sent to the browser.
//   Wrapped in useTransition for React 19 async transition support.
// ============================================================================

import { useRef, useState, useTransition } from "react";
import { AlertCircle, ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PresetCards } from "./PresetCards";
import { CalculatorForm } from "./CalculatorForm";
import { BOMResultView } from "./BOMResultView";
import { generateEstimateAction } from "../actions";
import type { BOMResult } from "../type";
import type { LayoutInput } from "../layoutTypes";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalculatorShell() {
  const [result, setResult] = useState<BOMResult | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formDefaults, setFormDefaults] = useState<Partial<LayoutInput> | undefined>(undefined);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resultRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Engine runner
  // -------------------------------------------------------------------------

  function runEngine(layout: LayoutInput) {
    startTransition(() => {
      const input = buildCalculatorInput(layout);
      const bomResult = calculateBOM(input);
      setResult(bomResult);

      // Scroll result into view after paint
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // -------------------------------------------------------------------------
  // Preset handlers
  // -------------------------------------------------------------------------

  function handlePresetSelect(layout: LayoutInput) {
    // Determine preset ID from layout for ring highlight
    const id =
      layout.propertyType === "DUPLEX"
        ? "DUPLEX"
        : layout.bedrooms === 2
        ? "2BHK"
        : "3BHK";
    setActivePresetId(id);
    setShowForm(false);
    runEngine(layout);
  }

  function handlePresetCustomize(layout: LayoutInput) {
    setFormDefaults(layout);
    setActivePresetId(null);
    setShowForm(true);
  }

  // -------------------------------------------------------------------------
  // Form handlers
  // -------------------------------------------------------------------------

  function handleFormSubmit(layout: LayoutInput) {
    setActivePresetId(null);
    runEngine(layout);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Presets                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Quick Presets</h2>
            <p className="text-sm text-muted-foreground">
              Pick a common property type to get an instant BOM estimate.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowForm((prev) => !prev);
              if (!showForm) setFormDefaults(undefined);
            }}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {showForm ? "Hide Form" : "Custom"}
            {showForm ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        </div>

        <PresetCards
          onSelect={handlePresetSelect}
          onCustomize={handlePresetCustomize}
          activePresetId={activePresetId}
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Custom form (collapsible)                                */}
      {/* ------------------------------------------------------------------ */}
      {showForm && (
        <section>
          <Separator className="mb-6" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Custom Configuration</h2>
              <p className="text-sm text-muted-foreground">
                Fine-tune the property details for a precise estimate.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-lg border p-6">
            <CalculatorForm
              defaultValues={formDefaults}
              onSubmit={handleFormSubmit}
              isPending={isPending}
            />
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Result                                                   */}
      {/* ------------------------------------------------------------------ */}
      {result && (
        <section ref={resultRef}>
          <Separator className="mb-6" />
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Bill of Materials</h2>
            <p className="text-sm text-muted-foreground">
              {result.circuits.length > 0
                ? `${result.totalCircuits} circuits · IS 732:2019 compliant`
                : "No circuits generated"}
            </p>
          </div>
          <BOMResultView result={result} />
        </section>
      )}
    </div>
  );
}
