import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuotesClient } from "./QuotesClient";

export const metadata: Metadata = {
  title: "Compare Quotes — WireMart",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuotesPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quoteRequest: {
        include: {
          quotes: {
            include: {
              dealer: {
                select: {
                  name: true,
                  email: true,
                  dealerProfile: {
                    select: {
                      companyName: true,
                      city: true,
                      brandsSold: true,
                    },
                  },
                },
              },
            },
            orderBy: { totalPrice: "asc" },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  if (project.ownerId !== session.user.id) {
    redirect("/dashboard");
  }

  const rfq = project.quoteRequest;
  const quotes =
    rfq?.quotes.map((q) => ({
      id: q.id,
      totalPrice: q.totalPrice,
      brandOffered: q.brandOffered,
      deliveryDays: q.deliveryDays,
      details: q.details,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
      dealerName:
        q.dealer.dealerProfile?.companyName ?? q.dealer.name ?? "Dealer",
      dealerCity: q.dealer.dealerProfile?.city ?? "",
    })) ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-14 sm:px-6">
      <div className="mb-2">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Quotes for {project.projectName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {quotes.length === 0
            ? "No quotes received yet."
            : `${quotes.length} quote${quotes.length === 1 ? "" : "s"} received — sorted by price (lowest first).`}
        </p>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {rfq?.status === "OPEN"
              ? "Your quote request is open. Dealers in your area will submit quotes soon."
              : "No quotes were received for this project."}
          </p>
        </div>
      ) : (
        <QuotesClient quotes={quotes} rfqStatus={rfq?.status ?? "CLOSED"} />
      )}
    </main>
  );
}
