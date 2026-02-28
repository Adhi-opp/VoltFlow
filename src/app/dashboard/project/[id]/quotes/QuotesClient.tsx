"use client";

import { useState, useTransition } from "react";
import {
  acceptQuoteAction,
  rejectQuoteAction,
} from "@/features/quotes/actions";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteData {
  id: string;
  totalPrice: number;
  brandOffered: string;
  deliveryDays: number | null;
  details: string | null;
  status: string;
  createdAt: string;
  dealerName: string;
  dealerCity: string;
  dealerEmail: string | null;
  dealerPhone: string | null;
}

interface Props {
  quotes: QuoteData[];
  rfqStatus: string;
}

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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(iso)
  );
}

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACCEPTED":
      return "default";
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuotesClient({ quotes: initialQuotes, rfqStatus }: Props) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  function handleAccept(quoteId: string) {
    setError(null);
    setActionId(quoteId);

    startTransition(async () => {
      const result = await acceptQuoteAction(quoteId);
      if (!result.success) {
        setError(result.error);
        setActionId(null);
        return;
      }

      // Optimistic UI update
      setQuotes((prev) =>
        prev.map((q) => ({
          ...q,
          status:
            q.id === quoteId
              ? "ACCEPTED"
              : q.status === "SUBMITTED"
                ? "REJECTED"
                : q.status,
        }))
      );
      setActionId(null);
    });
  }

  function handleReject(quoteId: string) {
    setError(null);
    setActionId(quoteId);

    startTransition(async () => {
      const result = await rejectQuoteAction(quoteId);
      if (!result.success) {
        setError(result.error);
        setActionId(null);
        return;
      }

      setQuotes((prev) =>
        prev.map((q) =>
          q.id === quoteId ? { ...q, status: "REJECTED" } : q
        )
      );
      setActionId(null);
    });
  }

  const hasAccepted = quotes.some((q) => q.status === "ACCEPTED");

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quotes.map((quote, idx) => {
          const isSubmitted = quote.status === "SUBMITTED";
          const isLowest = idx === 0 && quotes.length > 1;
          const isProcessing = isPending && actionId === quote.id;

          return (
            <Card
              key={quote.id}
              className={
                quote.status === "ACCEPTED"
                  ? "border-green-500/50 ring-1 ring-green-500/20"
                  : ""
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-snug">
                      {quote.dealerName}
                    </CardTitle>
                    {quote.dealerCity && (
                      <CardDescription>{quote.dealerCity}</CardDescription>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={statusVariant(quote.status)}>
                      {quote.status}
                    </Badge>
                    {isLowest && isSubmitted && (
                      <span className="text-xs font-medium text-green-600">
                        Lowest
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="text-lg font-bold tabular-nums">
                    {formatCurrency(quote.totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Brand</span>
                  <span className="font-medium">{quote.brandOffered}</span>
                </div>
                {quote.deliveryDays != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="tabular-nums">
                      {quote.deliveryDays} days
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quoted On</span>
                  <span>{formatDate(quote.createdAt)}</span>
                </div>
                {quote.details && (
                  <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    {quote.details}
                  </div>
                )}
              </CardContent>

              {quote.status === "ACCEPTED" && (quote.dealerEmail || quote.dealerPhone) && (
                <div className="mx-6 mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm">
                  <p className="mb-1 font-medium text-green-800">
                    Dealer Contact Info
                  </p>
                  {quote.dealerEmail && (
                    <p className="text-green-700">Email: {quote.dealerEmail}</p>
                  )}
                  {quote.dealerPhone && (
                    <p className="text-green-700">Phone: {quote.dealerPhone}</p>
                  )}
                </div>
              )}

              {isSubmitted && !hasAccepted && (
                <CardFooter className="gap-2">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={() => handleAccept(quote.id)}
                    disabled={isPending}
                  >
                    {isProcessing ? "Accepting..." : "Accept"}
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReject(quote.id)}
                    disabled={isPending}
                  >
                    {isProcessing ? "..." : "Reject"}
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
