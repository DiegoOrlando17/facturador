CREATE TABLE "ContactVerification" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactVerification_tokenHash_key" ON "ContactVerification"("tokenHash");
CREATE INDEX "ContactVerification_tenantId_email_idx" ON "ContactVerification"("tenantId", "email");
CREATE INDEX "ContactVerification_expiresAt_idx" ON "ContactVerification"("expiresAt");
ALTER TABLE "ContactVerification" ADD CONSTRAINT "ContactVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
