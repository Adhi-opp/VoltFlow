"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { submitQuoteAction } from "@/features/quotes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BomSnapshot {
  totalConnectedLoadKw: number;
  maxDemandKw: number;
  totalCircuits: number;
  pricing: {
    materialCost: number;
  };
  phaseDecision: {
    finalRecommendation: string;
  };
  items: Array<{
    category: string;
    pricingCode: string;
    description: string;
    qty: number;
    unit: string;
    unitPrice?: number;
    lineTotal?: number;
  }>;
  warnings: string[];
}

interface Props {
  rfqId: string;
  rfqStatus: string;
  projectName: string;
  createdAt: string;
  visibilityCity: string;
  bom: BomSnapshot | null;
  fallbackEstimate: number | null;
  existingQuote: {
    id: string;
    totalPrice: number;
    brandOffered: string;
    status: string;
  } | null;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RfqDetailClient({
  rfqId,
  rfqStatus,
  projectName,
  createdAt,
  visibilityCity,
  bom,
  fallbackEstimate,
  existingQuote,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(!!existingQuote);

  const [totalPrice, setTotalPrice] = useState("");
  const [brandOffered, setBrandOffered] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [details, setDetails] = useState("");

  const estimate = bom?.pricing.materialCost ?? fallbackEstimate;
  const isOpen = rfqStatus === "OPEN";
  const canSubmit = isOpen && !existingQuote;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const price = parseFloat(totalPrice);
    if (isNaN(price) || price <= 0) {
      setError("Enter a valid price.");
      return;
    }

    startTransition(async () => {
      const result = await submitQuoteAction({
        quoteRequestId: rfqId,
        clientRequestId: crypto.randomUUID(),
        totalPrice: price,
        brandOffered: brandOffered.trim(),
        deliveryDays: deliveryDays ? parseInt(deliveryDays, 10) : undefined,
        details: details.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSubmitted(true);
    });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-14 sm:px-6">
      {/* Header */}
      <div className="mb-2">
        <Link
          href="/dealer/dashboard"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to Dashboard
        </Link>
      </div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{projectName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(createdAt)} &middot; {visibilityCity}
          </p>
        </div>
        <Badge
          variant={
            rfqStatus === "OPEN"
              ? "default"
              : rfqStatus === "CLOSED"
                ? "outline"
                : "secondary"
          }
        >
          {rfqStatus}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* BOM Breakdown — left 3 cols */}
        <div className="space-y-6 lg:col-span-3">
          {/* Summary stats */}
          {bom && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Project Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Connected Load</p>
                    <p className="font-semibold tabular-nums">
                      {bom.totalConnectedLoadKw.toFixed(2)} kW
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Max Demand</p>
                    <p className="font-semibold tabular-nums">
                      {bom.maxDemandKw.toFixed(2)} kW
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phase</p>
                    <p className="font-semibold">
                      {bom.phaseDecision.finalRecommendation === "THREE"
                        ? "3-Phase"
                        : "Single Phase"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Circuits</p>
                    <p className="font-semibold tabular-nums">
                      {bom.totalCircuits}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Platform Material Estimate</p>
                    <p className="text-lg font-semibold tabular-nums text-primary">
                      {formatCurrency(bom.pricing.materialCost)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BOM Items table */}
          {bom && bom.items.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bill of Materials</CardTitle>
                <CardDescription>
                  {bom.items.length} line items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4">Item</th>
                        <th className="pb-2 pr-4 text-right">Qty</th>
                        <th className="pb-2 pr-4">Unit</th>
                        {bom.items.some((i) => i.unitPrice != null) && (
                          <th className="pb-2 text-right">Line Total</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {bom.items.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2 pr-4">{item.description}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {item.unit === "m"
                              ? item.qty.toFixed(1)
                              : item.qty}
                          </td>
                          <td className="py-2 pr-4">{item.unit}</td>
                          {bom.items.some((i) => i.unitPrice != null) && (
                            <td className="py-2 text-right tabular-nums">
                              {item.lineTotal != null
                                ? formatCurrency(item.lineTotal)
                                : "—"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {bom && bom.warnings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {bom.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* No BOM fallback */}
          {!bom && (
            <Card className="py-12 text-center">
              <CardContent>
                <p className="text-muted-foreground">
                  Detailed BOM breakdown is not available for this project.
                </p>
                {estimate != null && (
                  <p className="mt-2 text-lg font-semibold">
                    Platform Estimate: {formatCurrency(estimate)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quote Form — right 2 cols */}
        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">
                {existingQuote ? "Your Quote" : "Submit Your Quote"}
              </CardTitle>
              {!canSubmit && !existingQuote && (
                <CardDescription>
                  This quote request is no longer accepting submissions.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {existingQuote ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Price</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(existingQuote.totalPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brand</span>
                    <span>{existingQuote.brandOffered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={
                        existingQuote.status === "ACCEPTED"
                          ? "default"
                          : existingQuote.status === "REJECTED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {existingQuote.status}
                    </Badge>
                  </div>
                  {submitted && !existingQuote.id && (
                    <p className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700">
                      Quote submitted successfully!
                    </p>
                  )}
                </div>
              ) : canSubmit ? (
                <form className="space-y-4" onSubmit={onSubmit}>
                  {error && (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  {submitted && (
                    <p className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700">
                      Quote submitted successfully!
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="totalPrice">Your Total Price (INR)</Label>
                    <Input
                      id="totalPrice"
                      type="number"
                      min="1"
                      step="1"
                      value={totalPrice}
                      onChange={(e) => setTotalPrice(e.target.value)}
                      placeholder={
                        estimate != null ? `Platform est: ${estimate}` : ""
                      }
                      required
                      disabled={submitted}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brandOffered">Brand Offered</Label>
                    <Input
                      id="brandOffered"
                      value={brandOffered}
                      onChange={(e) => setBrandOffered(e.target.value)}
                      placeholder="e.g. Polycab FR"
                      required
                      disabled={submitted}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryDays">
                      Delivery Days{" "}
                      <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="deliveryDays"
                      type="number"
                      min="1"
                      max="365"
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(e.target.value)}
                      disabled={submitted}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="details">
                      Additional Details{" "}
                      <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      id="details"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      rows={3}
                      maxLength={5000}
                      disabled={submitted}
                    />
                  </div>

                  <Button
                    className="w-full"
                    type="submit"
                    disabled={isPending || submitted}
                  >
                    {isPending ? "Submitting..." : "Submit Quote"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This RFQ is {rfqStatus.toLowerCase()}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
