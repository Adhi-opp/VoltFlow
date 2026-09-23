// src/lib/pending-estimate.ts
// ============================================================================
// ANONYMOUS → AUTHENTICATED HANDOVER
// ============================================================================
// The calculator is public. A visitor can configure a property and get a full
// BOM without an account — but saving it or requesting quotes needs one. That
// round-trip through /login would otherwise lose their work.
//
// So we stash the *layout* (never the priced result) in localStorage:
//
//   1. Visitor computes an estimate        → layout stashed
//   2. Visitor clicks "Save & Get Quotes"  → intent stashed, redirect to login
//   3. Visitor returns authenticated       → layout restored, estimate re-run,
//                                            pending intent auto-resumed
//
// Only the layout is stored, for three reasons: it is small, it is re-validated
// server-side on every use, and re-running the engine on restore means the
// visitor sees current rates rather than a stale price from an old tab.
//
// Every access is wrapped — localStorage throws outright in some privacy modes,
// and a calculator must never break because storage is unavailable.
// ============================================================================

import type { LayoutInput } from "@/features/calculator/layoutTypes";

const STORAGE_KEY = "voltflow:pending-estimate:v1";

/** Stale layouts are dropped — a week-old tab should not resurrect an estimate. */
const TTL_MS = 24 * 60 * 60 * 1000;

export type SaveIntent = "DRAFT" | "OPEN";

export interface PendingEstimate {
  layout: LayoutInput;
  /** Set when the visitor tried to save while logged out; resumed after login. */
  intent: SaveIntent | null;
  savedAt: number;
}

function isSaveIntent(value: unknown): value is SaveIntent {
  return value === "DRAFT" || value === "OPEN";
}

/**
 * Structural check only. The server re-validates with Zod on every use, so
 * this exists to reject obviously corrupt storage, not to be authoritative.
 */
function isLayoutShaped(value: unknown): value is LayoutInput {
  if (typeof value !== "object" || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.propertyType === "string" &&
    typeof l.bedrooms === "number" &&
    typeof l.bathrooms === "number" &&
    typeof l.balconies === "number" &&
    typeof l.totalFloors === "number" &&
    typeof l.modularKitchen === "boolean" &&
    typeof l.acInBedrooms === "boolean" &&
    typeof l.acInLivingRoom === "boolean" &&
    typeof l.geyserInBathrooms === "boolean"
  );
}

export function readPendingEstimate(): PendingEstimate | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { layout, intent, savedAt } = parsed as Record<string, unknown>;

    if (!isLayoutShaped(layout)) {
      clearPendingEstimate();
      return null;
    }

    if (typeof savedAt !== "number" || Date.now() - savedAt > TTL_MS) {
      clearPendingEstimate();
      return null;
    }

    return {
      layout,
      intent: isSaveIntent(intent) ? intent : null,
      savedAt,
    };
  } catch {
    // Corrupt JSON or storage unavailable — treat as "nothing pending".
    return null;
  }
}

/** Stashes the layout after a successful calculation, preserving any intent. */
export function writePendingLayout(layout: LayoutInput): void {
  if (typeof window === "undefined") return;

  try {
    const existing = readPendingEstimate();
    const payload: PendingEstimate = {
      layout,
      intent: existing?.intent ?? null,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage blocked — the calculator still works.
  }
}

/** Records what the visitor was trying to do before being sent to login. */
export function writePendingIntent(layout: LayoutInput, intent: SaveIntent): void {
  if (typeof window === "undefined") return;

  try {
    const payload: PendingEstimate = { layout, intent, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignored — the visitor simply re-clicks save after logging in.
  }
}

/** Clears the intent but keeps the layout, so the estimate stays on screen. */
export function clearPendingIntent(): void {
  if (typeof window === "undefined") return;

  try {
    const existing = readPendingEstimate();
    if (!existing) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...existing, intent: null } satisfies PendingEstimate)
    );
  } catch {
    // Ignored.
  }
}

export function clearPendingEstimate(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignored.
  }
}
