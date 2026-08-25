CREATE UNIQUE INDEX "InvoiceDocument_invoiceId_type_storageProvider_key"
ON "InvoiceDocument"("invoiceId", "type", "storageProvider");
