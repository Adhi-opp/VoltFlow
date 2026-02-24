"use client";

// src/features/calculator/components/BOMResultView.tsx
// ============================================================================
// BOM RESULT VIEW — Tabbed display of BOMResult output
// ============================================================================
// Renders the full output of calculateBOM() in three tabs:
//   1. BOM Items  — grouped by category, with quantities
//   2. Load Breakdown — per-room connected load and max demand
//   3. Circuits   — every circuit with gauge, MCB rating, wire length
//
// Also renders:
//   - SummaryBar: 4 stat tiles (Connected Load, Max Demand, Phase, Circuits)
//   - Warnings panel (amber) when result.warnings.length > 0
//   - Disclaimer footer
// ============================================================================

import { AlertTriangle, Zap, Activity, GitBranch, LayoutGrid } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { BOMResult, BOMItem } from "../type";

// ---------------------------------------------------------------------------
// Category display config — controls order and labels
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = [
  "WIRE",
  "EARTH_WIRE",
  "MCB",
  "RCCB",
  "MAIN_SWITCH",
  "DB",
  "CONDUIT",
  "SWITCHGEAR",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  WIRE: "Wires",
  EARTH_WIRE: "Earth Wire",
  MCB: "MCBs",
  RCCB: "RCCBs",
  MAIN_SWITCH: "Main Switch",
  DB: "Distribution Board",
  CONDUIT: "Conduit",
  SWITCHGEAR: "Switchgear",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKw(kw: number): string {
  return `${kw.toFixed(2)} kW`;
}

function getQuantityLabel(item: BOMItem): string {
  switch (item.category) {
    case "WIRE":
      return `${item.totalMeters.toFixed(0)} m (${item.coilsRequired} coil${item.coilsRequired !== 1 ? "s" : ""} × ${item.coilLengthMeters}m)`;
    case "EARTH_WIRE":
      return `${item.totalMeters.toFixed(0)} m (${item.coilsRequired} coil${item.coilsRequired !== 1 ? "s" : ""} × ${item.coilLengthMeters}m)`;
    case "CONDUIT":
      return `${item.totalMeters.toFixed(0)} m`;
    default:
      return `× ${(item as { quantity: number }).quantity}`;
  }
}

// ---------------------------------------------------------------------------
// SummaryBar
// ---------------------------------------------------------------------------

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

function StatTile({ icon, label, value, highlight }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? "text-amber-500" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SummaryBar({ result }: { result: BOMResult }) {
  const isThreePhase = result.recommendedPhase === "THREE";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        icon={<Zap className="h-4 w-4" />}
        label="Connected Load"
        value={formatKw(result.totalConnectedLoadKw)}
      />
      <StatTile
        icon={<Activity className="h-4 w-4" />}
        label="Max Demand"
        value={formatKw(result.maxDemandKw)}
      />
      <StatTile
        icon={<GitBranch className="h-4 w-4" />}
        label="Phase"
        value={isThreePhase ? "3-Phase" : "Single Phase"}
        highlight={isThreePhase}
      />
      <StatTile
        icon={<LayoutGrid className="h-4 w-4" />}
        label="Circuits"
        value={String(result.totalCircuits)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BOM Items Tab
// ---------------------------------------------------------------------------

function BOMItemsTab({ items }: { items: BOMItem[] }) {
  const grouped = new Map<string, BOMItem[]>();

  for (const cat of CATEGORY_ORDER) {
    const catItems = items.filter((item) => item.category === cat);
    if (catItems.length > 0) grouped.set(cat, catItems);
  }

  if (grouped.size === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No BOM items.</p>;
  }

  return (
    <div className="space-y-5">
      {Array.from(grouped.entries()).map(([cat, catItems]) => (
        <div key={cat}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {CATEGORY_LABELS[cat] ?? cat}
          </h3>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <tbody>
                {catItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-foreground">{item.description}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                      {getQuantityLabel(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Load Breakdown Tab
// ---------------------------------------------------------------------------

function LoadBreakdownTab({ result }: { result: BOMResult }) {
  const { loadBreakdown } = result;

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Room</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Lighting</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Power</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Heavy</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Connected</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Demand</th>
          </tr>
        </thead>
        <tbody>
          {loadBreakdown.map((row) => (
            <tr key={row.roomId} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5 font-medium">{row.roomName}</td>
              <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                {row.lightingLoadWatts} W
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                {row.powerLoadWatts} W
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                {row.heavyLoadWatts} W
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {(row.totalConnectedLoadWatts / 1000).toFixed(2)} kW
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-primary">
                {(row.diversifiedDemandWatts / 1000).toFixed(2)} kW
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/50 font-semibold">
            <td className="px-3 py-2.5" colSpan={4}>
              Total
            </td>
            <td className="px-3 py-2.5 text-right font-mono">
              {formatKw(result.totalConnectedLoadKw)}
            </td>
            <td className="px-3 py-2.5 text-right font-mono text-primary">
              {formatKw(result.maxDemandKw)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Circuits Tab
// ---------------------------------------------------------------------------

function CircuitsTab({ result }: { result: BOMResult }) {
  const { circuits } = result;

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Circuit</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Room</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Gauge</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">MCB</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Points</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Wire (m)</th>
          </tr>
        </thead>
        <tbody>
          {circuits.map((c) => (
            <tr key={c.circuitId} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                {c.circuitId}
              </td>
              <td className="px-3 py-2.5">{c.roomName}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs">
                {c.wireGauge.replace("SQ_MM_", "").replace("_", ".")} mm²
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs">
                {c.mcbRatingAmps}A
              </td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">
                {c.pointCount}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {c.wireLengthMeters.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warnings Panel
// ---------------------------------------------------------------------------

function WarningsPanel({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Notices ({warnings.length})
        </p>
        <ul className="space-y-0.5">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface BOMResultViewProps {
  result: BOMResult;
}

export function BOMResultView({ result }: BOMResultViewProps) {
  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <SummaryBar result={result} />

      {/* Warnings */}
      <WarningsPanel warnings={result.warnings} />

      {/* Tabs */}
      <Tabs defaultValue="bom">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="bom" className="flex-1 sm:flex-none">
            BOM Items
          </TabsTrigger>
          <TabsTrigger value="load" className="flex-1 sm:flex-none">
            Load Breakdown
          </TabsTrigger>
          <TabsTrigger value="circuits" className="flex-1 sm:flex-none">
            Circuits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bom" className="mt-4">
          <BOMItemsTab items={result.items} />
        </TabsContent>

        <TabsContent value="load" className="mt-4">
          <LoadBreakdownTab result={result} />
        </TabsContent>

        <TabsContent value="circuits" className="mt-4">
          <CircuitsTab result={result} />
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground">
        {result.disclaimer} &middot; Generated by algorithm v{result.algorithmVersion} &middot;{" "}
        {new Date(result.generatedAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </div>
  );
}
