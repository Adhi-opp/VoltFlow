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
import { Role } from "@prisma/client";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, SlidersHorizontal, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createQuoteRequestAction } from "@/features/quotes/actions";
import { PresetCards } from "./PresetCards";
import { CalculatorForm } from "./CalculatorForm";
import { BOMResultView } from "./BOMResultView";
import { generateEstimateAction } from "../actions";
import type { EnrichedBOMResult } from "../costEngine";
import type { EstimateActionErrorCode } from "../actions";
import type { LayoutInput } from "../layoutTypes";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function coerceSessionRole(role: unknown): Role | undefined {
  switch (role) {
    case Role.HOMEOWNER:
    case Role.DEALER:
    case Role.ADMIN:
      return role;
    default:
      return undefined;
  }
}

export function CalculatorShell() {
  const { data: session, status: sessionStatus } = useSession();
  const normalizedSessionRole = coerceSessionRole(session?.user?.role);

  const [result, setResult] = useState<EnrichedBOMResult | null>(null);
  const [error, setError] = useState<{
    message: string;
    code: EstimateActionErrorCode;
    missingCodes?: string[];
  } | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [activeSaveMode, setActiveSaveMode] = useState<"DRAFT" | "OPEN" | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formDefaults, setFormDefaults] = useState<Partial<LayoutInput> | undefined>(undefined);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resultRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Engine runner — delegates to Server Action; engine never runs in browser
  // -------------------------------------------------------------------------

  function runEngine(layout: LayoutInput) {
    setError(null);
    setSaveFeedback(null);
    startTransition(async () => {
      const res = await generateEstimateAction(layout);
      if (res.success) {
        setResult(res.data);
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else {
        setError({
          message: res.error,
          code: res.errorCode,
          missingCodes: res.missingCodes,
        });
      }
    });
  }

  async function handleSaveProject(status: "DRAFT" | "OPEN") {
    if (!result || isSavingProject) return;

    setSaveFeedback(null);
    setIsSavingProject(true);
    setActiveSaveMode(status);
    try {
      const saved = await createQuoteRequestAction(result, status);
      if (saved.success) {
        if (status === "DRAFT") {
          toast.success("Project saved to your dashboard.");
        } else {
          toast.success("Quote request published to verified dealers.");
        }
      } else {
        setSaveFeedback({
          type: "error",
          message: saved.error,
        });
      }
    } catch {
      setSaveFeedback({
        type: "error",
        message: "Failed to save project. Please try again.",
      });
    } finally {
      setIsSavingProject(false);
      setActiveSaveMode(null);
    }
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
          disabled={isPending}
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
      {/* Error banner                                                        */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p>{error.message}</p>
            {error.code === "PRICING_DATA_MISSING" && error.missingCodes && error.missingCodes.length > 0 && (
              <p className="text-xs">
                Missing price codes: {error.missingCodes.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Result                                                   */}
      {/* ------------------------------------------------------------------ */}
      {(isPending || result) && (
        <section ref={resultRef}>
          <Separator className="mb-6" />

          {/* First calculation — no prior result, show full-area spinner */}
          {isPending && !result && (
            <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Calculating estimate…</span>
            </div>
          )}

          {/* Result — dimmed + spinner badge while recalculating, full when idle */}
          {result && (
            <div className={isPending ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Bill of Materials</h2>
                  <p className="text-sm text-muted-foreground">
                    {result.circuits.length > 0
                      ? `${result.totalCircuits} circuits · IS 732:2019 compliant`
                      : "No circuits generated"}
                  </p>
                </div>
                {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <BOMResultView
                result={result}
                sessionStatus={sessionStatus}
                sessionRole={normalizedSessionRole}
                onSaveProject={handleSaveProject}
                isSavingProject={isSavingProject}
                activeSaveMode={activeSaveMode}
                saveFeedback={saveFeedback}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
