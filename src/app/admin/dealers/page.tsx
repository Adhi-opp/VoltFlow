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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DealerApprovalButtons } from "./DealerApprovalButtons";

export const metadata: Metadata = {
  title: "Manage Dealers",
};

const VALID_STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

function approvalBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
      return "default";
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminDealersPage({ searchParams }: PageProps) {
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
      : { approvalStatus: statusFilter as "PENDING" | "APPROVED" | "REJECTED" };

  const dealers = await prisma.dealerProfile.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          _count: { select: { quotes: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
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
        Manage Dealers{" "}
        <span className="text-base font-normal text-muted-foreground">
          ({dealers.length})
        </span>
      </h1>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {VALID_STATUSES.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/admin/dealers?status=${s}`}>{s}</Link>
          </Button>
        ))}
      </div>

      {dealers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No dealers matching this filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dealers.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-snug">
                      {d.companyName}
                    </CardTitle>
                    <CardDescription>
                      {d.user.name} &middot; {d.city}
                    </CardDescription>
                  </div>
                  <Badge variant={approvalBadgeVariant(d.approvalStatus)}>
                    {d.approvalStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="truncate ml-2">{d.user.email}</span>
                </div>
                {d.gstin && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GSTIN</span>
                    <span className="font-mono text-xs">{d.gstin}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Brands</span>
                  <span className="truncate ml-2 text-xs">
                    {d.brandsSold.join(", ") || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Areas</span>
                  <span className="truncate ml-2 text-xs">
                    {d.serviceAreas.join(", ") || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quotes Sent</span>
                  <span className="tabular-nums">{d.user._count.quotes}</span>
                </div>
              </CardContent>
              {d.approvalStatus === "PENDING" && (
                <CardFooter>
                  <DealerApprovalButtons dealerProfileId={d.id} />
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
