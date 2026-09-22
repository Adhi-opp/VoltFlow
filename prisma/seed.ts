// prisma/seed.ts
// ============================================================================
// VOLTFLOW SEED
// ============================================================================
// Enough of a world to click the whole product end to end without touching
// the admin screens first:
//
//   admin@voltflow.in      ADMIN     — approvals, RFQ and quote oversight
//   homeowner@voltflow.in  HOMEOWNER — owns the seeded project
//   dealer@voltflow.in     DEALER    — APPROVED, can quote immediately
//   dealer2@voltflow.in    DEALER    — PENDING, for testing the approval gate
//
// Password for all four: password123
//
// Idempotent throughout: every write is an upsert keyed on a natural unique
// (email, userId, clientRequestId, wireType+brand), so running this twice
// changes nothing and never duplicates a row.
//
// Run with: npx prisma db seed
//
// NOTE ON OLD ROWS — earlier seeds used @wiremart.in addresses. Those users
// still exist in any database seeded before the rename. This script does not
// delete them, because deleting users cascades to their projects and quotes.
// Remove them by hand once you have confirmed you do not need their data.
// ============================================================================

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  quoteValidUntilFrom,
  rfqExpiryFrom,
} from "../src/features/quotes/validity";

const prisma = new PrismaClient();

async function main() {
  const pw = await hash("password123", 12);
  const now = new Date();

  // ── People ──────────────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where: { email: "admin@voltflow.in" },
    update: {},
    create: {
      email: "admin@voltflow.in",
      name: "VoltFlow Admin",
      password: pw,
      role: "ADMIN",
    },
  });

  const homeowner = await prisma.user.upsert({
    where: { email: "homeowner@voltflow.in" },
    update: {},
    create: {
      email: "homeowner@voltflow.in",
      name: "Rahul Sharma",
      phone: "+91-9876543210",
      password: pw,
      role: "HOMEOWNER",
    },
  });

  // ── Approved dealer ─────────────────────────────────────────────────────
  // Nehru Place is the real wholesale electrical market for South Delhi, and
  // the GSTIN carries the 07 state code for Delhi so it reads as plausible in
  // the admin approval screen. serviceAreas must contain "NCR" — that is the
  // value deriveVisibilityCity() stamps on every RFQ from the calculator, and
  // the dealer dashboard matches on it. A dealer listing only "DELHI" would
  // see an empty board and look like a bug.

  const dealer = await prisma.user.upsert({
    where: { email: "dealer@voltflow.in" },
    update: {},
    create: {
      email: "dealer@voltflow.in",
      name: "Vikram Singh",
      phone: "+91-9988776655",
      password: pw,
      role: "DEALER",
    },
  });

  await prisma.dealerProfile.upsert({
    where: { userId: dealer.id },
    update: { approvalStatus: "APPROVED" },
    create: {
      userId: dealer.id,
      companyName: "Singh Electricals & Cables",
      gstin: "07AAACH7409R1ZZ",
      address: "M-14, Palika Bhawan, Nehru Place",
      city: "NCR",
      state: "Delhi",
      pincode: "110019",
      serviceAreas: ["NCR", "DELHI", "NOIDA", "GURUGRAM"],
      brandsSold: ["Polycab", "Havells", "Finolex", "RR Kabel"],
      approvalStatus: "APPROVED",
      subscriptionTier: "BASIC",
    },
  });

  // ── Pending dealer, for testing the approval gate ───────────────────────

  const pendingDealer = await prisma.user.upsert({
    where: { email: "dealer2@voltflow.in" },
    update: {},
    create: {
      email: "dealer2@voltflow.in",
      name: "Ankit Gupta",
      phone: "+91-9112233445",
      password: pw,
      role: "DEALER",
    },
  });

  await prisma.dealerProfile.upsert({
    where: { userId: pendingDealer.id },
    update: {},
    create: {
      userId: pendingDealer.id,
      companyName: "Gupta Wire House",
      gstin: "09AAACG1234M1Z5",
      address: "C-45, Sector 62",
      city: "NCR",
      state: "Uttar Pradesh",
      pincode: "201301",
      serviceAreas: ["NCR", "NOIDA", "GHAZIABAD"],
      brandsSold: ["Finolex", "KEI"],
      approvalStatus: "PENDING",
    },
  });

  // ── A project with an open RFQ and two competing quotes ─────────────────

  const project = await prisma.project.upsert({
    where: { id: "seed-project-001" },
    update: {},
    create: {
      id: "seed-project-001",
      ownerId: homeowner.id,
      projectName: "2BHK Noida Sector 62",
      projectType: "RESIDENTIAL",
      status: "RFQ_SUBMITTED",
      inputData: { source: "SEED" },
      bomData: {
        source: "SEED",
        pricing: { materialCost: 45000 },
        totalConnectedLoadKw: 4.8,
        maxDemandKw: 3.36,
      },
      totalEstimate: 45000,
    },
  });

  const rfq = await prisma.quoteRequest.upsert({
    where: { projectId: project.id },
    // Refreshed on re-seed so the window is always live when you sit down to
    // test — a seed whose RFQ expired three days ago tests nothing.
    update: { status: "OPEN", expiresAt: rfqExpiryFrom(now) },
    create: {
      projectId: project.id,
      status: "OPEN",
      visibilityCity: "NCR",
      maxQuotes: 5,
      quoteCount: 2,
      expiresAt: rfqExpiryFrom(now),
    },
  });

  // Two grades at two prices, so the comparison matrix has something real to
  // compare: the cheaper quote is also the lower insulation grade.
  await prisma.quote.upsert({
    where: { clientRequestId: "seed-quote-001" },
    update: { validUntil: quoteValidUntilFrom(now) },
    create: {
      quoteRequestId: rfq.id,
      dealerId: dealer.id,
      clientRequestId: "seed-quote-001",
      totalPrice: 42000,
      brandOffered: "Polycab",
      wireGrade: "FR",
      deliveryDays: 3,
      status: "SUBMITTED",
      validUntil: quoteValidUntilFrom(now),
    },
  });

  await prisma.quote.upsert({
    where: { clientRequestId: "seed-quote-002" },
    update: { validUntil: quoteValidUntilFrom(now) },
    create: {
      quoteRequestId: rfq.id,
      dealerId: pendingDealer.id,
      clientRequestId: "seed-quote-002",
      totalPrice: 47500,
      brandOffered: "Finolex",
      wireGrade: "FRLS",
      deliveryDays: 5,
      status: "SUBMITTED",
      validUntil: quoteValidUntilFrom(now),
    },
  });

  // ── PriceIndex — effective dealer rates per metre of copper wire ────────
  //
  // Until this table has rows, loadRateCardFromDb() silently falls back to the
  // hardcoded RATE_CARD in costEngine.ts, so the dynamic pricing path never
  // actually runs. Seeding it activates that path.
  //
  // wireType MUST start with the gauge in "<n> sq mm" form — loadRatesFromDb
  // parses the leading number to map onto WIRE_1_5, WIRE_2_5 and so on. Rows
  // that do not match that shape are ignored, and non-wire items (MCBs,
  // conduit, switchgear) always use the hardcoded rates.
  //
  // These values intentionally match the RATE_CARD entries marked FINAL, so
  // seeding changes no estimate. They are EFFECTIVE trade prices, i.e. after
  // the dealer discount circular, not MRP.
  //
  // NOTE: verify against a current dealer circular before trusting these. An
  // alternative set was proposed at 1.5→26, 2.5→42, 4.0→64, which looks like
  // MRP before the 40-55% trade discount. Adopting it would raise every
  // estimate by roughly 20%, since wire is about half of material cost.

  const wireRates = [
    { wireType: "1.5 sq mm FR PVC", brand: "Polycab", unitPrice: 18 },
    { wireType: "2.5 sq mm FR PVC", brand: "Polycab", unitPrice: 28 },
    { wireType: "4.0 sq mm FR PVC", brand: "Polycab", unitPrice: 48 },
    { wireType: "6.0 sq mm FR PVC", brand: "Polycab", unitPrice: 72 },
  ];

  for (const rate of wireRates) {
    await prisma.priceIndex.upsert({
      where: { wireType_brand: { wireType: rate.wireType, brand: rate.brand } },
      update: { unitPrice: rate.unitPrice, effectiveDate: now },
      create: { ...rate, unit: "meter" },
    });
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log(`
VoltFlow seed complete.

  Sign in with password123:

    admin@voltflow.in      ADMIN      ${admin.id}
    homeowner@voltflow.in  HOMEOWNER  ${homeowner.id}
    dealer@voltflow.in     DEALER     APPROVED  — Singh Electricals & Cables
    dealer2@voltflow.in    DEALER     PENDING   — Gupta Wire House

  Project   seed-project-001  "2BHK Noida Sector 62"
  RFQ       OPEN, expires ${rfqExpiryFrom(now).toLocaleString("en-IN")}
  Quotes    2 SUBMITTED, valid until ${quoteValidUntilFrom(now).toLocaleDateString("en-IN")}
  Rates     ${wireRates.length} PriceIndex rows
`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
