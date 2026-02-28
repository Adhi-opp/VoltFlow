import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "All RFQs",
};

const VALID_STATUSES = ["ALL", "OPEN", "CLOSED", "EXPIRED", "DRAFT"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function rfqBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "OPEN":
      return "default";
    case "CLOSED":
      return "secondary";
    case "EXPIRED":
      return "destructive";
    default:
      return "outline";
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminRfqsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const rawStatus = (params.status ?? "ALL").toUpperCase();
  const statusFilter: StatusFilter = VALID_STATUSES.includes(
    rawStatus as StatusFilter
  )
    ? (rawStatus as StatusFilter)
    : "ALL";

  const where =
    statusFilter === "ALL"
      ? {}
      : {
          status: statusFilter as "OPEN" | "CLOSED" | "EXPIRED" | "DRAFT",
        };

  const rfqs = await prisma.quoteRequest.findMany({
    where,
    include: {
      project: {
        select: { projectName: true, totalEstimate: true },
      },
      _count: { select: { quotes: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-14 sm:px-6">
      <div className="mb-2">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Admin Dashboard
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        All Quote Requests{" "}
        <span className="text-base font-normal text-muted-foreground">
          ({rfqs.length})
        </span>
      </h1>

      <div className="mb-6 flex gap-2">
        {VALID_STATUSES.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/admin/rfqs?status=${s}`}>{s}</Link>
          </Button>
        ))}
      </div>

      {rfqs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No RFQs matching this filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rfqs.map((rfq) => (
            <Card key={rfq.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">
                    {rfq.project.projectName}
                  </CardTitle>
                  <Badge variant={rfqBadgeVariant(rfq.status)}>
                    {rfq.status}
                  </Badge>
                </div>
                <CardDescription>
                  {formatDate(rfq.createdAt)} &middot; {rfq.visibilityCity}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimate</span>
                  <span className="font-semibold tabular-nums">
                    {rfq.project.totalEstimate != null
                      ? formatCurrency(rfq.project.totalEstimate)
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quotes</span>
                  <span className="tabular-nums">
                    {rfq._count.quotes} / {rfq.maxQuotes}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
