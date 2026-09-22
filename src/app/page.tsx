import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Electrical Wiring Marketplace | Get Dealer Quotes",
  description:
    "Generate an engineer-grade electrical BOM for your build, or quote verified requirements from ready-to-buy contractors in your pincode. Aligned with IS 732 standard practice, for NCR.",
  openGraph: {
    title: "VoltFlow - Electrical Wiring Marketplace",
    description:
      "Free IS 732-aligned BOM calculator plus competing wholesale quotes from verified local dealers.",
  },
};

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------
// Two audiences, two jobs, one screen. A homeowner and a dealer want opposite
// things from this product, so the page does not try to sell both with one
// headline — it splits down the middle and lets the reader pick a side.
//
// The halves are inverted (light / dark) rather than merely adjacent. On a
// phone the split collapses to a stack, and the contrast is then the only
// thing still telling the reader "this is a different door".
// ---------------------------------------------------------------------------

/** Small-caps eyebrow. Written inline rather than via .spec-label so the dark
    column can set its own colour without fighting cascade order. */
function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-[11px] font-medium uppercase leading-none tracking-[0.18em] ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

/** Hairline-separated list of what that side actually gets. Nothing here is a
    claim the product cannot already back with a computed or stored field. */
function SpecList({
  items,
  tone,
}: {
  items: string[];
  tone: "light" | "dark";
}) {
  const border = tone === "light" ? "border-slate-200" : "border-slate-800";
  const text = tone === "light" ? "text-slate-600" : "text-slate-400";

  return (
    <ul className={`mt-10 border-t ${border} text-[13px] ${text}`}>
      {items.map((item) => (
        <li key={item} className={`border-b ${border} py-2.5 leading-snug`}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function Home() {
  const session = await auth();
  const isDealer = session?.user?.role === "DEALER";
  const isLoggedIn = !!session?.user;
  const isBuyer = isLoggedIn && !isDealer;

  return (
    <main className="w-full">
      {/* Masthead rule — one line of positioning, then out of the way. */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Eyebrow className="text-slate-500">
            Residential electrical estimation &middot; Delhi NCR
          </Eyebrow>
          <Link
            href="/dashboard?demo=true"
            className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            Sample project
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:min-h-[calc(100vh-3.5rem-3rem)] md:grid-cols-2">
        {/* ── Left: homeowners & builders ─────────────────────────────── */}
        <section className="flex flex-col justify-center border-b border-slate-200 bg-white px-6 py-14 md:border-b-0 md:border-r md:px-10 md:py-20 lg:px-16">
          <div className="mx-auto w-full max-w-md md:mx-0 md:ml-auto md:max-w-sm lg:max-w-md">
            <Eyebrow className="text-slate-500">
              Homeowners &amp; Builders
            </Eyebrow>

            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl">
              Plan the Build.
            </h1>

            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              Generate an engineer-grade electrical BOM and source wholesale
              quotes.
            </p>

            <div className="mt-8">
              <Button
                asChild
                className="h-12 w-full px-8 text-[15px] font-semibold sm:w-auto"
              >
                <Link href="/calculator">
                  {isBuyer ? "New Estimate" : "Calculate Your Estimate"}
                </Link>
              </Button>

              <p className="mt-3 text-[13px] text-slate-500">
                {isBuyer ? (
                  <>
                    Or open your{" "}
                    <Link
                      href="/dashboard"
                      className="font-medium text-slate-900 underline-offset-4 hover:underline"
                    >
                      saved projects
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Free, and no account needed. Sign in only to save it or
                    request quotes.
                  </>
                )}
              </p>
            </div>

            <SpecList
              tone="light"
              items={[
                "Circuit schedule with MCB ratings and phase recommendation",
                "Cable lengths rounded to purchasable coils, by gauge",
                "Connected load and diversified maximum demand",
              ]}
            />
          </div>
        </section>

        {/* ── Right: dealers & distributors ───────────────────────────── */}
        <section className="flex flex-col justify-center bg-slate-950 px-6 py-14 md:px-10 md:py-20 lg:px-16">
          <div className="mx-auto w-full max-w-md md:mx-0 md:mr-auto md:max-w-sm lg:max-w-md">
            <Eyebrow className="text-slate-500">
              Dealers &amp; Distributors
            </Eyebrow>

            <h2 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
              Quote the Job.
            </h2>

            <p className="mt-4 text-[15px] leading-7 text-slate-400">
              Access verified electrical requirements from ready-to-buy
              contractors in your pincode.
            </p>

            <div className="mt-8">
              <Button
                asChild
                className="h-12 w-full bg-white px-8 text-[15px] font-semibold text-slate-950 hover:bg-slate-200 sm:w-auto"
              >
                <Link
                  href={isDealer ? "/dealer/dashboard" : "/register?role=DEALER"}
                >
                  Dealer Portal
                </Link>
              </Button>

              <p className="mt-3 text-[13px] text-slate-500">
                {isDealer ? (
                  <>Open requests are listed on your dashboard.</>
                ) : (
                  <>
                    Already registered?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-slate-300 underline-offset-4 hover:underline"
                    >
                      Sign in
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>

            <SpecList
              tone="dark"
              items={[
                "Every request arrives with a full itemised BOM",
                "Filtered to the service areas on your dealer profile",
                "Respond with brand, total price and delivery window",
              ]}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
