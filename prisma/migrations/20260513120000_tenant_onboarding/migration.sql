CREATE TABLE "TenantOnboardingSubmission" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedByUserId" BIGINT,
    "reviewedByAdminUserId" BIGINT,
    "dataJson" TEXT NOT NULL,
    "documentsJson" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "TenantOnboardingSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantOnboardingSubmission_tenantId_status_createdAt_idx" ON "TenantOnboardingSubmission"("tenantId", "status", "createdAt");

ALTER TABLE "TenantOnboardingSubmission" ADD CONSTRAINT "TenantOnboardingSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
