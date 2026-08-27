-- AlterEnum
ALTER TYPE "InternshipCertificateDraftStatus" ADD VALUE 'ISSUED';

-- AlterTable
ALTER TABLE "internship_certificate_drafts" ADD COLUMN "officialPdfKey" TEXT,
ADD COLUMN "issuedAt" TIMESTAMP(3);
