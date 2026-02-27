"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { Activity, AlertTriangle, GitBranch, Info, LayoutGrid, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EnrichedBOMResult } from "../costEngine";
import type { BOMItem } from "../type";

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

function formatKw(kw: number): string {
  return `${kw.toFixed(2)} kW`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getQuantityLabel(item: BOMItem): string {
  switch (item.category) {
    case "WIRE":
      return `Exact ${item.totalMeters.toFixed(0)} m | Buy ${item.coilsRequired} coil${item.coilsRequired !== 1 ? "s" : ""} (${item.purchasableMeters.toFixed(0)} m) | Surplus ${item.surplusMeters.toFixed(0)} m`;
    case "EARTH_WIRE":
      return `Exact ${item.totalMeters.toFixed(0)} m | Buy ${item.coilsRequired} coil${item.coilsRequired !== 1 ? "s" : ""} (${item.purchasableMeters.toFixed(0)} m) | Surplus ${item.surplusMeters.toFixed(0)} m`;
    case "CONDUIT":
      return `${item.totalMeters.toFixed(0)} m`;
    default:
      return `x ${(item as { quantity: number }).quantity}`;
  }
}

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

function SummaryBar({ result }: { result: EnrichedBOMResult }) {
  const isThreePhase = result.phaseDecision.finalRecommendation === "THREE";
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

function PricingSummaryCard({ result }: { result: EnrichedBOMResult }) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Material Cost</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(result.pricing.materialCost)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Labor Cost</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(result.pricing.laborCost)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Estimate</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
            {formatCurrency(result.pricing.totalEstimate)}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        This estimate includes purchasable-unit surplus: {result.pricing.surplusMetersTotal.toFixed(0)} m
        {" "}({formatCurrency(result.pricing.surplusValueTotal)}). Ask dealers for cut-length optimization where applicable.
      </p>
    </div>
  );
}

function LaborBreakdownCard({ result }: { result: EnrichedBOMResult }) {
  const b = result.pricing.laborBreakdown;
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Labor Breakdown</p>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <p>Base Visit: <span className="font-mono">{formatCurrency(b.baseVisit)}</span></p>
        <p>Lighting Points: <span className="font-mono">{formatCurrency(b.lightingPoints)}</span></p>
        <p>15A Points: <span className="font-mono">{formatCurrency(b.power15APoints)}</span></p>
        <p>Heavy Circuits: <span className="font-mono">{formatCurrency(b.heavyCircuits)}</span></p>
        <p>Cooking Circuits: <span className="font-mono">{formatCurrency(b.cookingCircuits)}</span></p>
        <p>Conduit Run: <span className="font-mono">{formatCurrency(b.conduitMeters)}</span></p>
        <p>Extra Floors: <span className="font-mono">{formatCurrency(b.extraFloors)}</span></p>
        <p>Wiring Multiplier: <span className="font-mono">{b.wiringModeMultiplier.toFixed(2)}x</span></p>
      </div>
    </div>
  );
}

function PhaseDecisionNotice({ result }: { result: EnrichedBOMResult }) {
  const isRegulatoryOverride =
    result.phaseDecision.regulatoryRecommendation === "THREE" &&
    result.phaseDecision.engineeringRecommendation === "SINGLE";

  if (!isRegulatoryOverride) return null;

  return (
    <div className="flex gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 text-xs text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-200">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
      <p>
        3-Phase recommended: engineering demand is within safe limits ({formatKw(result.maxDemandKw)}),
        but local DISCOM policy ({result.phaseDecision.regulatoryPolicyKey}) typically requires 3-Phase when
        connected load exceeds {result.phaseDecision.connectedLoadThresholdKw.toFixed(1)} kW.
        Your connected load is {formatKw(result.totalConnectedLoadKw)}.
      </p>
    </div>
  );
}

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
                  <tr key={idx} className="border-b transition-colors last:border-0 hover:bg-muted/40">
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

function LoadBreakdownTab({ result }: { result: EnrichedBOMResult }) {
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
            <tr key={row.roomId} className="border-b transition-colors last:border-0 hover:bg-muted/40">
              <td className="px-3 py-2.5 font-medium">{row.roomName}</td>
              <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{row.lightingLoadWatts} W</td>
              <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{row.powerLoadWatts} W</td>
              <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{row.heavyLoadWatts} W</td>
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
            <td className="px-3 py-2.5" colSpan={4}>Total</td>
            <td className="px-3 py-2.5 text-right font-mono">{formatKw(result.totalConnectedLoadKw)}</td>
            <td className="px-3 py-2.5 text-right font-mono text-primary">{formatKw(result.maxDemandKw)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CircuitsTab({ result }: { result: EnrichedBOMResult }) {
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
          {result.circuits.map((circuit) => (
            <tr key={circuit.circuitId} className="border-b transition-colors last:border-0 hover:bg-muted/40">
              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{circuit.circuitId}</td>
              <td className="px-3 py-2.5">{circuit.roomName}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs">
                {circuit.wireGauge.replace("SQ_MM_", "").replace("_", ".")} mm2
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs">{circuit.mcbRatingAmps}A</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{circuit.pointCount}</td>
              <td className="px-3 py-2.5 text-right font-mono">{circuit.wireLengthMeters.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
          {warnings.map((warning, index) => (
            <li key={index} className="text-xs text-amber-700 dark:text-amber-400">
              {warning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function isPhaseRecommendationWarning(warning: string): boolean {
  const normalized = warning.toLowerCase();
  return (
    normalized.startsWith("3-phase recommended:") ||
    normalized.includes("three-phase supply recommended") ||
    normalized.includes("single-phase supply is sufficient")
  );
}

type SessionStatus = "loading" | "authenticated" | "unauthenticated";
type SessionRole = Role | undefined;

interface SaveFeedback {
  type: "success" | "error";
  message: string;
}

interface SaveProjectCtaProps {
  sessionStatus: SessionStatus;
  sessionRole: SessionRole;
  onSaveProject: (status: "DRAFT" | "OPEN") => void;
  isSavingProject: boolean;
  activeSaveMode: "DRAFT" | "OPEN" | null;
  saveFeedback: SaveFeedback | null;
}

function SaveProjectCta({
  sessionStatus,
  sessionRole,
  onSaveProject,
  isSavingProject,
  activeSaveMode,
  saveFeedback,
}: SaveProjectCtaProps) {
  const isDealer = sessionStatus === "authenticated" && sessionRole === "DEALER";
  const canSave = sessionStatus === "authenticated" && !isDealer;

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
      <div>
        <p className="text-sm font-semibold">Save your estimate</p>
        <p className="text-xs text-muted-foreground">
          Save this estimate to your dashboard, or publish it to get dealer quotes.
        </p>
      </div>

      {sessionStatus === "loading" && (
        <Button disabled>Checking account status...</Button>
      )}

      {sessionStatus === "unauthenticated" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild className="sm:min-w-44">
            <Link href="/login?callbackUrl=/calculator">Save Project</Link>
          </Button>
          <Button asChild className="sm:min-w-56">
            <Link href="/login?callbackUrl=/calculator">Save Project & Request Quotes</Link>
          </Button>
        </div>
      )}

      {isDealer && (
        <div className="space-y-2">
          <Button disabled>Save Project & Request Dealer Quotes</Button>
          <p className="text-xs text-muted-foreground">
            Dealer accounts cannot create quote requests.
          </p>
        </div>
      )}

      {canSave && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onSaveProject("DRAFT")}
            disabled={isSavingProject}
            className="sm:min-w-44"
          >
            {isSavingProject && activeSaveMode === "DRAFT"
              ? "Saving Project..."
              : "Save Project"}
          </Button>
          <Button
            onClick={() => onSaveProject("OPEN")}
            disabled={isSavingProject}
            className="sm:min-w-56"
          >
            {isSavingProject && activeSaveMode === "OPEN"
              ? "Publishing Request..."
              : "Save Project & Request Quotes"}
          </Button>
        </div>
      )}

      {saveFeedback && (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            saveFeedback.type === "success"
              ? "border-green-300 bg-green-50 text-green-700"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {saveFeedback.message}
        </p>
      )}
    </div>
  );
}

interface BOMResultViewProps {
  result: EnrichedBOMResult;
  sessionStatus: SessionStatus;
  sessionRole: SessionRole;
  onSaveProject: (status: "DRAFT" | "OPEN") => void;
  isSavingProject: boolean;
  activeSaveMode: "DRAFT" | "OPEN" | null;
  saveFeedback: SaveFeedback | null;
}

export function BOMResultView({
  result,
  sessionStatus,
  sessionRole,
  onSaveProject,
  isSavingProject,
  activeSaveMode,
  saveFeedback,
}: BOMResultViewProps) {
  const isRegulatoryOverride =
    result.phaseDecision.regulatoryRecommendation === "THREE" &&
    result.phaseDecision.engineeringRecommendation === "SINGLE";
  const notices = isRegulatoryOverride
    ? result.warnings.filter((warning) => !isPhaseRecommendationWarning(warning))
    : result.warnings;

  return (
    <div className="space-y-5">
      <PricingSummaryCard result={result} />
      <LaborBreakdownCard result={result} />
      <SummaryBar result={result} />
      <PhaseDecisionNotice result={result} />
      <WarningsPanel warnings={notices} />

      <Tabs defaultValue="bom">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="bom" className="flex-1 sm:flex-none">BOM Items</TabsTrigger>
          <TabsTrigger value="load" className="flex-1 sm:flex-none">Load Breakdown</TabsTrigger>
          <TabsTrigger value="circuits" className="flex-1 sm:flex-none">Circuits</TabsTrigger>
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
      <SaveProjectCta
        sessionStatus={sessionStatus}
        sessionRole={sessionRole}
        onSaveProject={onSaveProject}
        isSavingProject={isSavingProject}
        activeSaveMode={activeSaveMode}
        saveFeedback={saveFeedback}
      />

      <Separator />

      <p className="text-xs text-muted-foreground">
        {result.disclaimer} · Generated by algorithm v{result.algorithmVersion} ·{" "}
        {new Date(result.generatedAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </div>
  );
}
