INSERT INTO "InvoiceDocument" (
    "tenantId", "invoiceId", "type", "status", "storageProvider", "externalUrl",
    "fileName", "mimeType", "createdAt", "updatedAt"
)
SELECT
    i."tenantId", i."id", 'PDF', 'AVAILABLE', 'GOOGLE_DRIVE', p."drive_file_link",
    COALESCE(NULLIF(i."cbteNro", ''), 'factura') || '.pdf', 'application/pdf', p."updatedAt", p."updatedAt"
FROM "Invoice" i
JOIN "Payment" p ON p."id" = i."paymentId" AND p."tenantId" = i."tenantId"
WHERE p."drive_file_link" IS NOT NULL
ON CONFLICT ("invoiceId", "type", "storageProvider") DO UPDATE SET
    "status" = 'AVAILABLE',
    "externalUrl" = EXCLUDED."externalUrl",
    "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "InvoiceDocument" (
    "tenantId", "invoiceId", "type", "status", "storageProvider", "externalUrl",
    "fileName", "mimeType", "createdAt", "updatedAt"
)
SELECT
    i."tenantId", i."id", 'PDF', 'AVAILABLE', 'LOCAL_LEGACY', p."pdf_path",
    regexp_replace(p."pdf_path", '^.*[\\/]', ''), 'application/pdf', p."updatedAt", p."updatedAt"
FROM "Invoice" i
JOIN "Payment" p ON p."id" = i."paymentId" AND p."tenantId" = i."tenantId"
WHERE p."pdf_path" IS NOT NULL
ON CONFLICT ("invoiceId", "type", "storageProvider") DO UPDATE SET
    "status" = 'AVAILABLE',
    "externalUrl" = EXCLUDED."externalUrl",
    "updatedAt" = EXCLUDED."updatedAt";

ALTER TABLE "Payment"
    DROP COLUMN "cae",
    DROP COLUMN "cae_vto",
    DROP COLUMN "cbte_nro",
    DROP COLUMN "cbte_tipo",
    DROP COLUMN "pto_vta",
    DROP COLUMN "pdf_path",
    DROP COLUMN "drive_file_link";
