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

export const metadata: Metadata = {
  title: "Dealer Dashboard — WireMart",
  description: "View and respond to open quote requests.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractEstimate(bomData: unknown, fallback: number | null): number | null {
  if (!isRecord(bomData)) return fallback;
  const pricing = bomData.pricing;
  if (!isRecord(pricing)) return fallback;
  return typeof pricing.totalEstimate === "number" ? pricing.totalEstimate : fallback;
}

function extractLoadKw(bomData: unknown): number | null {
  if (!isRecord(bomData)) return null;
  const v = bomData.totalConnectedLoadKw;
  return typeof v === "number" ? v : null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DealerDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "DEALER" && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Check if dealer has a profile — if not, redirect to setup
  const dealerProfile = await prisma.dealerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, city: true, serviceAreas: true },
  });

  if (!dealerProfile) {
    redirect("/dealer/profile/setup");
  }

  // Fetch open RFQs matching dealer's service areas (by city)
  const serviceFilter = [
    dealerProfile.city,
    ...dealerProfile.serviceAreas,
  ].map((s) => s.trim().toUpperCase());

  const openRfqs = await prisma.quoteRequest.findMany({
    where: {
      status: "OPEN",
      visibilityCity: { in: serviceFilter, mode: "insensitive" },
      // Exclude RFQs this dealer has already quoted on
      quotes: { none: { dealerId: session.user.id } },
    },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
          totalEstimate: true,
          bomData: true,
          createdAt: true,
        },
      },
      _count: { select: { quotes: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Also fetch RFQs this dealer has already quoted on
  const myQuotes = await prisma.quote.findMany({
    where: { dealerId: session.user.id },
    include: {
      quoteRequest: {
        include: {
          project: {
            select: {
              projectName: true,
              totalEstimate: true,
              owner: { select: { name: true, email: true, phone: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-14 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dealer Dashboard</h1>
        <Button variant="outline" asChild>
          <Link href="/dealer/profile/setup">Edit Profile</Link>
        </Button>
      </div>

      {/* Open RFQs */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">
          Open Quote Requests{" "}
          <span className="text-base font-normal text-muted-foreground">
            ({openRfqs.length})
          </span>
        </h2>

        {openRfqs.length === 0 ? (
          <Card className="py-12 text-center">
            <CardContent>
              <p className="text-muted-foreground">
                No open quote requests in your service area right now. Check back
                later.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openRfqs.map((rfq) => {
              const estimate = extractEstimate(
                rfq.project.bomData,
                rfq.project.totalEstimate
              );
              const loadKw = extractLoadKw(rfq.project.bomData);
              const spotsLeft = rfq.maxQuotes - rfq._count.quotes;

              return (
                <Card key={rfq.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {rfq.project.projectName}
                      </CardTitle>
                      <Badge variant="default">Open</Badge>
                    </div>
                    <CardDescription>
                      {formatDate(rfq.createdAt)} &middot; {rfq.visibilityCity}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Value</span>
                      <span className="font-semibold tabular-nums">
                        {estimate != null ? formatCurrency(estimate) : "N/A"}
                      </span>
                    </div>
                    {loadKw != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Connected Load
                        </span>
                        <span className="tabular-nums">
                          {loadKw.toFixed(2)} kW
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Spots Left</span>
                      <span className="tabular-nums">
                        {spotsLeft} / {rfq.maxQuotes}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button className="w-full" asChild>
                      <Link href={`/dealer/rfq/${rfq.id}`}>
                        View &amp; Submit Quote
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* My Submitted Quotes */}
      {myQuotes.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">
            My Submitted Quotes{" "}
            <span className="text-base font-normal text-muted-foreground">
              ({myQuotes.length})
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myQuotes.map((quote) => (
              <Card key={quote.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base leading-snug">
                    {quote.quoteRequest.project.projectName}
                  </CardTitle>
                  <CardDescription>
                    Quoted on {formatDate(quote.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Price</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(quote.totalPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brand</span>
                    <span>{quote.brandOffered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={
                        quote.status === "ACCEPTED"
                          ? "default"
                          : quote.status === "REJECTED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {quote.status}
                    </Badge>
                  </div>
                </CardContent>
                {quote.status === "ACCEPTED" && (
                  <CardFooter className="flex-col items-start gap-1 border-t pt-3 text-sm">
                    <p className="font-medium text-green-700">
                      Homeowner Contact
                    </p>
                    <p>{quote.quoteRequest.project.owner.name}</p>
                    <p>{quote.quoteRequest.project.owner.email}</p>
                    {quote.quoteRequest.project.owner.phone && (
                      <p>{quote.quoteRequest.project.owner.phone}</p>
                    )}
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
