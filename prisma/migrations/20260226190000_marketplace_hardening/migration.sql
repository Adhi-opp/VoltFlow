-- AlterTable
ALTER TABLE "QuoteRequest"
ADD COLUMN "maxQuotes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "quoteCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Quote"
ADD COLUMN "clientRequestId" TEXT;

-- Backfill existing rows before NOT NULL + unique constraints.
UPDATE "Quote"
SET "clientRequestId" = 'legacy-' || "id"
WHERE "clientRequestId" IS NULL;

ALTER TABLE "Quote"
ALTER COLUMN "clientRequestId" SET NOT NULL;

-- CreateTable
CREATE TABLE "RegulatoryPhasePolicy" (
    "id" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "connectedLoadThresholdKw" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryPhasePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_clientRequestId_key" ON "Quote"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteRequestId_dealerId_key" ON "Quote"("quoteRequestId", "dealerId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryPhasePolicy_cityKey_key" ON "RegulatoryPhasePolicy"("cityKey");
