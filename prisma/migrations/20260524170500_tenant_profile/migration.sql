CREATE TABLE "TenantProfile" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "legalName" TEXT,
    "tradeName" TEXT,
    "cuit" TEXT,
    "ivaCondition" TEXT,
    "fiscalAddress" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "responsibleName" TEXT,
    "responsibleEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantProfile_tenantId_key" ON "TenantProfile"("tenantId");
CREATE INDEX "TenantProfile_cuit_idx" ON "TenantProfile"("cuit");

ALTER TABLE "TenantProfile" ADD CONSTRAINT "TenantProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
