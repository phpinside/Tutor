-- CreateEnum
CREATE TYPE "InternshipCertificateDraftStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "internship_certificate_drafts" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "idCard" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '北京一生二科技有限公司',
    "status" "InternshipCertificateDraftStatus" NOT NULL DEFAULT 'PROCESSING',
    "pdfKey" TEXT,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_certificate_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internship_certificate_drafts_teacherId_idx" ON "internship_certificate_drafts"("teacherId");
CREATE INDEX "internship_certificate_drafts_status_idx" ON "internship_certificate_drafts"("status");
CREATE INDEX "internship_certificate_drafts_createdAt_idx" ON "internship_certificate_drafts"("createdAt");

-- AddForeignKey
ALTER TABLE "internship_certificate_drafts" ADD CONSTRAINT "internship_certificate_drafts_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
