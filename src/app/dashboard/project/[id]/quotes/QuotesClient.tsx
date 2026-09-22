"use client";

// QuotesClient
// ============================================================================
// A comparison matrix, not a card grid. The whole job of this screen is
// answering "which of these is actually better", and that means every quote's
// price, brand and delivery sitting in the same column so the eye can scan
// down instead of across. Cards made the reader hold four numbers in memory.
//
// Quotes arrive pre-sorted by price ascending from the server.
// ============================================================================

import { useState, useTransition } from "react";
import { acceptQuoteAction, rejectQuoteAction } from "@/features/quotes/actions";
import { Button } from "@/components/ui/button";

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
  /** Project estimate, for the spread-vs-estimate summary row. */
  projectEstimate?: number | null;
}

function formatINR(amount: number): string {
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

function StatusPill({ status }: { status: string }) {
  const style =
    status === "ACCEPTED"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "border-slate-200 bg-slate-50 text-slate-400"
        : "border-slate-300 bg-white text-slate-600";

  return (
    <span
      className={`inline-block border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${style}`}
    >
      {status}
    </span>
  );
}

export function QuotesClient({ quotes: initialQuotes, projectEstimate }: Props) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  function runAction(
    quoteId: string,
    action: typeof acceptQuoteAction,
    apply: (prev: QuoteData[]) => QuoteData[]
  ) {
    setError(null);
    setActionId(quoteId);
    startTransition(async () => {
      const result = await action(quoteId);
      if (!result.success) {
        setError(result.error);
        setActionId(null);
        return;
      }
      setQuotes(apply);
      setActionId(null);
    });
  }

  function handleAccept(quoteId: string) {
    runAction(quoteId, acceptQuoteAction, (prev) =>
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
  }

  function handleReject(quoteId: string) {
    runAction(quoteId, rejectQuoteAction, (prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status: "REJECTED" } : q))
    );
  }

  const hasAccepted = quotes.some((q) => q.status === "ACCEPTED");
  const live = quotes.filter((q) => q.status !== "REJECTED");
  const prices = live.map((q) => q.totalPrice);
  const lowest = prices.length > 0 ? Math.min(...prices) : null;
  const highest = prices.length > 0 ? Math.max(...prices) : null;
  const spread = lowest !== null && highest !== null ? highest - lowest : null;

  const acceptedQuote = quotes.find((q) => q.status === "ACCEPTED");

  if (quotes.length === 0) {
    return (
      <p className="border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500">
        No quotes yet. Verified dealers in your area have been notified.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="spec-label px-3 py-2 text-left font-medium">
                  Dealer
                </th>
                <th className="spec-label px-3 py-2 text-left font-medium">
                  Brand
                </th>
                <th className="spec-label px-3 py-2 text-right font-medium">
                  Total (ex-GST)
                </th>
                <th className="spec-label px-3 py-2 text-right font-medium">
                  vs Lowest
                </th>
                <th className="spec-label px-3 py-2 text-right font-medium">
                  Delivery
                </th>
                <th className="spec-label px-3 py-2 text-right font-medium">
                  Quoted
                </th>
                <th className="spec-label px-3 py-2 text-right font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const isSubmitted = quote.status === "SUBMITTED";
                const isRejected = quote.status === "REJECTED";
                const isAccepted = quote.status === "ACCEPTED";
                const isLowest =
                  lowest !== null && quote.totalPrice === lowest && !isRejected;
                const delta =
                  lowest !== null && !isRejected ? quote.totalPrice - lowest : null;
                const isProcessing = isPending && actionId === quote.id;

                return (
                  <tr
                    key={quote.id}
                    className={`border-b border-slate-100 last:border-b-0 ${
                      isAccepted
                        ? "bg-emerald-50/60"
                        : isRejected
                          ? "text-slate-400"
                          : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${isRejected ? "text-slate-400" : "text-slate-900"}`}
                        >
                          {quote.dealerName}
                        </span>
                        {isLowest && isSubmitted && (
                          <span className="border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                            Lowest
                          </span>
                        )}
                      </div>
                      {quote.dealerCity && (
                        <span className="text-[11px] text-slate-500">
                          {quote.dealerCity}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{quote.brandOffered}</td>
                    <td
                      className={`spec-num px-3 py-2.5 text-right font-semibold ${
                        isRejected ? "line-through" : "text-slate-900"
                      }`}
                    >
                      {formatINR(quote.totalPrice)}
                    </td>
                    <td className="spec-num px-3 py-2.5 text-right text-slate-500">
                      {delta === null
                        ? "—"
                        : delta === 0
                          ? "—"
                          : `+${formatINR(delta)}`}
                    </td>
                    <td className="spec-num px-3 py-2.5 text-right text-slate-600">
                      {quote.deliveryDays != null ? `${quote.deliveryDays} d` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-slate-500">
                      {formatDate(quote.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isSubmitted && !hasAccepted ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => handleAccept(quote.id)}
                            disabled={isPending}
                          >
                            {isProcessing ? "…" : "Accept"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => handleReject(quote.id)}
                            disabled={isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <StatusPill status={quote.status} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {live.length > 1 && (
              <tfoot>
                <tr className="border-t border-slate-300 bg-slate-50">
                  <td
                    className="spec-label px-3 py-2"
                    colSpan={2}
                  >
                    {live.length} live quotes
                  </td>
                  <td className="spec-num px-3 py-2 text-right font-semibold text-slate-900">
                    {lowest !== null && formatINR(lowest)}
                  </td>
                  <td
                    className="spec-num px-3 py-2 text-right text-slate-600"
                    colSpan={3}
                  >
                    {spread !== null && spread > 0 && (
                      <>
                        spread {formatINR(spread)}
                        {lowest ? (
                          <span className="ml-1 text-slate-400">
                            ({((spread / lowest) * 100).toFixed(0)}%)
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td />
                </tr>
                {projectEstimate != null && lowest !== null && (
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="spec-label px-3 py-2" colSpan={2}>
                      vs your estimate
                    </td>
                    <td className="spec-num px-3 py-2 text-right text-slate-600">
                      {formatINR(projectEstimate)}
                    </td>
                    <td
                      className="spec-num px-3 py-2 text-right"
                      colSpan={3}
                    >
                      <span
                        className={
                          lowest <= projectEstimate
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }
                      >
                        {lowest <= projectEstimate ? "−" : "+"}
                        {formatINR(Math.abs(lowest - projectEstimate))} (
                        {(
                          (Math.abs(lowest - projectEstimate) / projectEstimate) *
                          100
                        ).toFixed(0)}
                        %)
                      </span>
                    </td>
                    <td />
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Dealer notes are long-form; they do not belong in the matrix. */}
      {quotes.some((q) => q.details) && (
        <div className="border border-slate-200 bg-white">
          <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-900">
            Dealer Notes
          </p>
          <ul className="divide-y divide-slate-100">
            {quotes
              .filter((q) => q.details)
              .map((q) => (
                <li key={q.id} className="px-3 py-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {q.dealerName}
                  </span>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">
                    {q.details}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      )}

      {acceptedQuote && (acceptedQuote.dealerEmail || acceptedQuote.dealerPhone) && (
        <div className="border border-emerald-300 bg-emerald-50 px-3 py-2.5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
            Contact — {acceptedQuote.dealerName}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-[13px] text-emerald-900">
            {acceptedQuote.dealerEmail && (
              <span className="spec-num">{acceptedQuote.dealerEmail}</span>
            )}
            {acceptedQuote.dealerPhone && (
              <span className="spec-num">{acceptedQuote.dealerPhone}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
