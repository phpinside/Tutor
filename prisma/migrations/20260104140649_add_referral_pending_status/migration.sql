-- AlterEnum
-- Add PENDING status to ReferralStatus enum
ALTER TYPE "ReferralStatus" ADD VALUE 'PENDING';

-- AlterTable
-- Change default value of status to PENDING
ALTER TABLE "referrals" ALTER COLUMN "status" SET DEFAULT 'PENDING';
