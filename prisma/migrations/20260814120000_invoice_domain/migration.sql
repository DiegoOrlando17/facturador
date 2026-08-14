CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'QUEUED', 'ISSUING', 'ISSUED', 'FAILED');
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'CREDIT_NOTE');
CREATE TYPE "InvoiceSource" AS ENUM ('AUTOMATIC', 'CONFIRMATION', 'MANUAL', 'OCR');
CREATE TYPE "InvoiceEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ISSUANCE_REQUESTED', 'ISSUED', 'FAILED', 'RETRY_SCHEDULED', 'RETRIED', 'DOCUMENT_CREATED', 'NOTE_ADDED');
CREATE TYPE "InvoiceDocumentType" AS ENUM ('PDF', 'SOURCE');
CREATE TYPE "InvoiceDocumentStatus" AS ENUM ('AVAILABLE', 'FAILED');

CREATE TABLE "Invoice" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "paymentId" BIGINT,
    "relatedInvoiceId" BIGINT,
    "type" "InvoiceType" NOT NULL DEFAULT 'INVOICE',
    "source" "InvoiceSource" NOT NULL DEFAULT 'AUTOMATIC',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "customer" TEXT,
    "customerDocType" TEXT,
    "customerDocNumber" TEXT,
    "cae" TEXT,
    "caeVto" TEXT,
    "cbteNro" TEXT,
    "cbteTipo" INTEGER,
    "ptoVta" INTEGER,
    "issuedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceEvent" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "invoiceId" BIGINT NOT NULL,
    "type" "InvoiceEventType" NOT NULL,
    "message" TEXT,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceDocument" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "invoiceId" BIGINT NOT NULL,
    "type" "InvoiceDocumentType" NOT NULL,
    "status" "InvoiceDocumentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "storageProvider" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "checksum" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_paymentId_tenantId_key" ON "Invoice"("paymentId", "tenantId");
CREATE UNIQUE INDEX "Invoice_id_tenantId_key" ON "Invoice"("id", "tenantId");
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");
CREATE INDEX "Invoice_tenantId_type_createdAt_idx" ON "Invoice"("tenantId", "type", "createdAt");
CREATE INDEX "Invoice_relatedInvoiceId_idx" ON "Invoice"("relatedInvoiceId");
CREATE INDEX "InvoiceEvent_tenantId_createdAt_idx" ON "InvoiceEvent"("tenantId", "createdAt");
CREATE INDEX "InvoiceEvent_invoiceId_createdAt_idx" ON "InvoiceEvent"("invoiceId", "createdAt");
CREATE INDEX "InvoiceDocument_tenantId_type_createdAt_idx" ON "InvoiceDocument"("tenantId", "type", "createdAt");
CREATE INDEX "InvoiceDocument_invoiceId_createdAt_idx" ON "InvoiceDocument"("invoiceId", "createdAt");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_tenantId_fkey" FOREIGN KEY ("paymentId", "tenantId") REFERENCES "Payment"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_relatedInvoiceId_tenantId_fkey" FOREIGN KEY ("relatedInvoiceId", "tenantId") REFERENCES "Invoice"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_invoiceId_tenantId_fkey" FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "Invoice"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_invoiceId_tenantId_fkey" FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "Invoice"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Invoice" (
    "tenantId", "paymentId", "type", "source", "status",
    "amount", "currency", "customer", "customerDocType", "customerDocNumber",
    "cae", "caeVto", "cbteNro", "cbteTipo", "ptoVta", "issuedAt", "error",
    "createdAt", "updatedAt"
)
SELECT
    p."tenantId", p."id", 'INVOICE', 'AUTOMATIC',
    CASE
        WHEN p."cae" IS NOT NULL AND p."cbte_nro" IS NOT NULL THEN 'ISSUED'::"InvoiceStatus"
        WHEN p."status" = 'processing' THEN 'ISSUING'::"InvoiceStatus"
        WHEN p."status" = 'pending' THEN 'QUEUED'::"InvoiceStatus"
        ELSE 'FAILED'::"InvoiceStatus"
    END,
    p."amount", p."currency", p."customer", p."customer_doc_type", p."customer_doc_number",
    p."cae", p."cae_vto", p."cbte_nro", p."cbte_tipo", p."pto_vta",
    CASE WHEN p."cae" IS NOT NULL AND p."cbte_nro" IS NOT NULL THEN COALESCE(p."updatedAt", p."createdAt") ELSE NULL END,
    p."error", p."createdAt", p."updatedAt"
FROM "Payment" p
ON CONFLICT ("paymentId", "tenantId") DO NOTHING;

INSERT INTO "InvoiceEvent" ("tenantId", "invoiceId", "type", "message", "createdAt")
SELECT i."tenantId", i."id", 'CREATED', 'Migrado desde Payment', i."createdAt"
FROM "Invoice" i
WHERE i."paymentId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "InvoiceEvent" e
      WHERE e."invoiceId" = i."id" AND e."type" = 'CREATED'
  );

INSERT INTO "InvoiceDocument" (
    "tenantId", "invoiceId", "type", "status", "storageProvider", "externalUrl",
    "fileName", "mimeType", "createdAt", "updatedAt"
)
SELECT
    i."tenantId", i."id", 'PDF', 'AVAILABLE', 'GOOGLE_DRIVE', p."drive_file_link",
    COALESCE(NULLIF(p."cbte_nro", ''), 'factura') || '.pdf', 'application/pdf', p."updatedAt", p."updatedAt"
FROM "Invoice" i
JOIN "Payment" p ON p."id" = i."paymentId" AND p."tenantId" = i."tenantId"
WHERE p."drive_file_link" IS NOT NULL;
