import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  House,
  ShieldCheck,
  Store,
} from "lucide-react";
import { auth } from "@/auth";
import { getMonthlyGmv } from "@/lib/gmv";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Electrical Wiring Marketplace | Get Dealer Quotes",
  description:
    "Calculate your home electrical wiring BOM and get competitive quotes from verified dealers in your city. Estimates aligned with IS 732 standard practice, for NCR.",
  openGraph: {
    title: "WireMart - Electrical Wiring Marketplace",
    description:
      "Free IS 732 BOM calculator + competitive dealer quotes for Indian homes.",
  },
};

async function GmvTicker() {
  const gmv = await getMonthlyGmv();

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(gmv);

  return (
    <div className="animate-fade-in-up delay-300 mx-auto mt-8 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm shadow-slate-200/70">
      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
        Verified GMV
      </span>
      <span className="text-sm font-semibold tabular-nums text-emerald-600">
        {formatted}
      </span>
      <span className="text-sm text-slate-500">estimated this month</span>
    </div>
  );
}

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-16 top-12 h-64 w-64 rounded-full bg-emerald-200/60 blur-3xl" />
        <div className="absolute right-[-5rem] top-24 h-72 w-72 rounded-full bg-slate-200/70 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.14),transparent_58%)]" />
      </div>

      <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="animate-fade-in-up mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm shadow-slate-200/70">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Modern procurement for residential electrical projects
          </div>

          <h1 className="animate-fade-in-up delay-100 mt-8 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl md:text-7xl">
            Clear BOMs. Faster quotes.
            <span className="block text-slate-700">
              A fintech-style frontend for wiring projects.
            </span>
          </h1>

          <p className="animate-fade-in-up delay-200 mt-6 text-lg leading-8 text-slate-600 sm:text-xl">
            WireMart turns residential electrical planning into a clean,
            quote-ready workflow with IS 732:2019-aligned BOMs, dealer
            visibility, and project tracking built for confidence.
          </p>

          <GmvTicker />
        </div>

        {isLoggedIn ? (
          <div className="animate-fade-in-up delay-300 mt-10 flex flex-col gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="px-8 shadow-sm shadow-emerald-200/80"
            >
              <Link href="/calculator">New Estimate</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-slate-200 bg-white px-8 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="animate-fade-in-up delay-300 mt-10 flex flex-col items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 px-10 text-base font-semibold shadow-sm shadow-emerald-200/80"
            >
              <Link href="/calculator">Calculate Your Estimate</Link>
            </Button>
            <p className="text-sm text-slate-500">
              Free, and no account needed.{" "}
              <Link
                href="/login"
                className="font-medium text-slate-700 underline-offset-4 hover:underline"
              >
                Sign in
              </Link>{" "}
              only when you want to save it or get dealer quotes.
            </p>
          </div>
        )}

        {!isLoggedIn && (
          <div className="animate-fade-in delay-500 absolute bottom-8">
            <div className="h-8 w-5 rounded-full border-2 border-slate-300 bg-white/70 p-1 shadow-sm shadow-slate-200/60">
              <div className="animate-bounce h-2 w-full rounded-full bg-emerald-600" />
            </div>
          </div>
        )}
      </section>

      {!isLoggedIn && (
        <section className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
            Choose how to get started:
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <Link href="/register?role=HOMEOWNER" className="group">
              <Card className="hover-lift h-full border-slate-200 bg-white/95 transition-colors group-hover:border-emerald-200">
                <CardHeader>
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <House className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl text-slate-950">
                    I am a Homeowner
                  </CardTitle>
                  <CardDescription className="text-base text-slate-600">
                    Calculate estimates and find verified dealers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  Continue as Homeowner
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/register?role=DEALER" className="group">
              <Card className="hover-lift h-full border-slate-200 bg-white/95 transition-colors group-hover:border-slate-300">
                <CardHeader>
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                    <Store className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl text-slate-950">
                    I am a Dealer
                  </CardTitle>
                  <CardDescription className="text-base text-slate-600">
                    Bid on verified electrical projects.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  Continue as Dealer
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Just looking?{" "}
            <Link
              href="/dashboard?demo=true"
              className="font-medium text-primary hover:underline"
            >
              Try the demo
            </Link>
          </p>
        </section>
      )}
    </main>
  );
}
