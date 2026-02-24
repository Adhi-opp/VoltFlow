-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'DEALER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREEMIUM', 'BASIC', 'PRO');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ESTIMATED', 'RFQ_SUBMITTED', 'QUOTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "gstin" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "serviceAreas" TEXT[],
    "brandsSold" TEXT[],
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREEMIUM',
    "quotesThisMonth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectType" "ProjectType" NOT NULL DEFAULT 'RESIDENTIAL',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "inputData" JSONB NOT NULL,
    "bomData" JSONB,
    "totalEstimate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'OPEN',
    "visibilityCity" TEXT NOT NULL,
    "visibilityPincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "brandOffered" TEXT NOT NULL,
    "deliveryDays" INTEGER,
    "details" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceIndex" (
    "id" TEXT NOT NULL,
    "wireType" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'meter',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "DealerProfile_userId_key" ON "DealerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DealerProfile_gstin_key" ON "DealerProfile"("gstin");

-- CreateIndex
CREATE INDEX "DealerProfile_city_idx" ON "DealerProfile"("city");

-- CreateIndex
CREATE INDEX "DealerProfile_approvalStatus_idx" ON "DealerProfile"("approvalStatus");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequest_projectId_key" ON "QuoteRequest"("projectId");

-- CreateIndex
CREATE INDEX "QuoteRequest_status_idx" ON "QuoteRequest"("status");

-- CreateIndex
CREATE INDEX "QuoteRequest_visibilityCity_idx" ON "QuoteRequest"("visibilityCity");

-- CreateIndex
CREATE INDEX "Quote_dealerId_idx" ON "Quote"("dealerId");

-- CreateIndex
CREATE INDEX "Quote_quoteRequestId_idx" ON "Quote"("quoteRequestId");

-- CreateIndex
CREATE INDEX "PriceIndex_wireType_idx" ON "PriceIndex"("wireType");

-- CreateIndex
CREATE UNIQUE INDEX "PriceIndex_wireType_brand_key" ON "PriceIndex"("wireType", "brand");

-- AddForeignKey
ALTER TABLE "DealerProfile" ADD CONSTRAINT "DealerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
