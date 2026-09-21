import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pw = await hash("password123", 12);

  // Admin
  await prisma.user.upsert({
    where: { email: "admin@wiremart.in" },
    update: {},
    create: { email: "admin@wiremart.in", name: "Admin", password: pw, role: "ADMIN" },
  });

  // Homeowner
  const hw = await prisma.user.upsert({
    where: { email: "homeowner@example.com" },
    update: {},
    create: { email: "homeowner@example.com", name: "Rahul Sharma", phone: "+91-9876543210", password: pw, role: "HOMEOWNER" },
  });

  // Dealer 1 — approved
  const d1 = await prisma.user.upsert({
    where: { email: "dealer1@example.com" },
    update: {},
    create: { email: "dealer1@example.com", name: "Vikram Singh", phone: "+91-9988776655", password: pw, role: "DEALER" },
  });
  await prisma.dealerProfile.upsert({
    where: { userId: d1.id },
    update: {},
    create: {
      userId: d1.id, companyName: "Polycab Traders NCR", gstin: "07AAACH7409R1ZZ",
      address: "123 Nehru Place", city: "NCR", state: "Delhi", pincode: "110019",
      serviceAreas: ["NCR", "NOIDA"], brandsSold: ["Polycab", "Havells"], approvalStatus: "APPROVED",
    },
  });

  // Dealer 2 — pending
  const d2 = await prisma.user.upsert({
    where: { email: "dealer2@example.com" },
    update: {},
    create: { email: "dealer2@example.com", name: "Ankit Gupta", phone: "+91-9112233445", password: pw, role: "DEALER" },
  });
  await prisma.dealerProfile.upsert({
    where: { userId: d2.id },
    update: {},
    create: {
      userId: d2.id, companyName: "Finolex Distributors Noida",
      address: "45 Sector 62", city: "NCR", state: "UP", pincode: "201301",
      serviceAreas: ["NCR", "GHAZIABAD"], brandsSold: ["Finolex"], approvalStatus: "PENDING",
    },
  });

  // Project with RFQ and 2 quotes
  const project = await prisma.project.upsert({
    where: { id: "seed-project-001" },
    update: {},
    create: {
      id: "seed-project-001", ownerId: hw.id, projectName: "2BHK Noida Sector 62",
      projectType: "RESIDENTIAL", status: "RFQ_SUBMITTED",
      inputData: { dummy: true }, bomData: { dummy: true, pricing: { materialCost: 45000 }, totalConnectedLoadKw: 4.8, maxDemandKw: 3.36 },
      totalEstimate: 45000,
    },
  });

  const qr = await prisma.quoteRequest.upsert({
    where: { projectId: project.id },
    update: {},
    create: { projectId: project.id, status: "OPEN", visibilityCity: "NCR", maxQuotes: 5, quoteCount: 2 },
  });

  await prisma.quote.upsert({
    where: { clientRequestId: "seed-quote-001" },
    update: {},
    create: {
      quoteRequestId: qr.id, dealerId: d1.id, clientRequestId: "seed-quote-001",
      totalPrice: 42000, brandOffered: "Polycab", deliveryDays: 3, status: "SUBMITTED",
    },
  });

  await prisma.quote.upsert({
    where: { clientRequestId: "seed-quote-002" },
    update: {},
    create: {
      quoteRequestId: qr.id, dealerId: d2.id, clientRequestId: "seed-quote-002",
      totalPrice: 39500, brandOffered: "Finolex", deliveryDays: 5, status: "SUBMITTED",
    },
  });

  // ---------------------------------------------------------------------
  // PriceIndex — effective dealer rates per metre of copper wire
  // ---------------------------------------------------------------------
  // Until this table has rows, loadRateCardFromDb() silently falls back to
  // the hardcoded RATE_CARD in costEngine.ts, so the dynamic pricing path
  // never actually runs. Seeding it activates that path.
  //
  // wireType MUST start with the gauge in "<n> sq mm" form — loadRatesFromDb
  // parses the leading number to map onto WIRE_1_5, WIRE_2_5 and so on.
  // Rows that do not match that shape are ignored, and non-wire items (MCBs,
  // conduit, switchgear) always use the hardcoded rates.
  //
  // These values intentionally match the RATE_CARD entries marked FINAL, so
  // seeding changes no estimate. They are EFFECTIVE trade prices, i.e. after
  // the dealer discount circular, not MRP.
  //
  // NOTE: verify against a current dealer circular before trusting these.
  // An alternative set was proposed at 1.5→26, 2.5→42, 4.0→64, which looks
  // like MRP before the 40-55% trade discount. Adopting it would raise every
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
      update: { unitPrice: rate.unitPrice, effectiveDate: new Date() },
      create: { ...rate, unit: "meter" },
    });
  }

  console.log(`Seed complete. PriceIndex rows: ${wireRates.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
