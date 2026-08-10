ALTER TABLE "TenantProfile" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "TenantProfile" ADD COLUMN "reviewedByAdminUserId" BIGINT;
ALTER TABLE "TenantProfile" ADD COLUMN "reviewNotes" TEXT;
ALTER TABLE "TenantProfile" ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "TenantProfile_approvalStatus_idx" ON "TenantProfile"("approvalStatus");
