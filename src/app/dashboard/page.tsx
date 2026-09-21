import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { QuoteRequestStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  DEMO_DASHBOARD_PROJECTS,
  DEMO_PROJECT_ID,
} from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard — WireMart",
  description: "View and manage your saved electrical estimates.",
};

// ---------------------------------------------------------------------------
// bomData extraction helpers
// ---------------------------------------------------------------------------

interface BomDataSnapshot {
  totalConnectedLoadKw: number;
  maxDemandKw: number;
  pricing: { totalEstimate: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBomData(raw: unknown): BomDataSnapshot | null {
  if (!isRecord(raw)) return null;

  const pricing = raw.pricing;
  if (!isRecord(pricing)) return null;

  const totalEstimate = pricing.totalEstimate;
  const totalConnectedLoadKw = raw.totalConnectedLoadKw;
  const maxDemandKw = raw.maxDemandKw;

  if (
    typeof totalEstimate !== "number" ||
    typeof totalConnectedLoadKw !== "number" ||
    typeof maxDemandKw !== "number"
  ) {
    return null;
  }

  return { totalConnectedLoadKw, maxDemandKw, pricing: { totalEstimate } };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
}

/** Reformat old-style project names ("Saved Estimate YYYY-MM-DD HH:MM:SS") */
function cleanProjectName(name: string): string {
  const match = name.match(/^Saved Estimate (\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const day = parseInt(match[3], 10);
    const month = months[parseInt(match[2], 10) - 1];
    return `Estimate — ${day} ${month} ${match[1]}`;
  }
  return name;
}

// ---------------------------------------------------------------------------
// Badge config
// ---------------------------------------------------------------------------

const QUOTE_STATUS_CONFIG: Record<
  QuoteRequestStatus,
  { label: string; variant: "secondary" | "default" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  OPEN: { label: "Open for Quotes", variant: "default" },
  CLOSED: { label: "Closed", variant: "outline" },
  EXPIRED: { label: "Expired", variant: "destructive" },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{ demo?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { demo } = await searchParams;
  const isDemo = demo === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- demo + Prisma shapes unified
  let projects: any[];

  if (isDemo) {
    projects = DEMO_DASHBOARD_PROJECTS;
  } else {
    const session = await auth();
    if (!session?.user) {
      redirect("/login");
    }
    if (session.user.role === "DEALER") {
      redirect("/dealer/dashboard");
    }
    projects = await prisma.project.findMany({
      where: { ownerId: session.user.id },
      include: { quoteRequest: true },
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-14 sm:px-6">
      {isDemo && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          You are viewing a demo.{" "}
          <Link href="/register?role=HOMEOWNER" className="font-semibold underline">
            Create a free account &rarr;
          </Link>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
        <Button asChild>
          <Link href="/calculator">New Estimate</Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent>
            <p className="text-muted-foreground">
              You have not saved any estimates yet.
            </p>
            <Button asChild className="mt-4">
              <Link href="/calculator">Create Your First Estimate</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const bom = parseBomData(project.bomData);
            const estimate =
              bom?.pricing.totalEstimate ?? project.totalEstimate;
            const qr = project.quoteRequest;
            const statusConfig = qr?.status in QUOTE_STATUS_CONFIG
              ? QUOTE_STATUS_CONFIG[qr.status as QuoteRequestStatus]
              : null;

            return (
              <Card key={project.id} className="hover-lift">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {cleanProjectName(project.projectName)}
                    </CardTitle>
                    {statusConfig && (
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{formatDate(project.createdAt)}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimate</span>
                    <span className="font-semibold tabular-nums">
                      {estimate != null ? formatCurrency(estimate) : "N/A"}
                    </span>
                  </div>
                  {bom && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Connected Load
                        </span>
                        <span className="tabular-nums">
                          {bom.totalConnectedLoadKw.toFixed(2)} kW
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Max Demand
                        </span>
                        <span className="tabular-nums">
                          {bom.maxDemandKw.toFixed(2)} kW
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>

                <CardFooter className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Status: {project.status.replace("_", " ")}
                  </span>
                  {qr && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={isDemo ? `/dashboard/project/${DEMO_PROJECT_ID}/quotes?demo=true` : `/dashboard/project/${project.id}/quotes`}>
                        View Quotes
                        {qr.quoteCount > 0 && (
                          <Badge variant="secondary" className="ml-1.5">
                            {qr.quoteCount}
                          </Badge>
                        )}
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
