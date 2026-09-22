-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wireGrade" TEXT;
