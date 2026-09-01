function rowNumberFromRange(range) {
  const match = String(range || "").match(/![A-Z]+(\d+)(?::[A-Z]+\d+)?$/i);
  return match ? Number(match[1]) : null;
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function issueSummary(items, sampleSize = 20) {
  return { count: items.length, samples: items.slice(0, sampleSize) };
}

export function auditGoogleDeliveries({ payments = [], driveFiles = [], sheetValues = [] }) {
  const knownPaymentIds = new Set(payments.map((payment) => String(payment.providerPaymentId)));
  const trackedDocuments = payments.flatMap((payment) => payment.driveDocuments.map((document) => ({
    paymentId: String(payment.providerPaymentId),
    externalId: document.externalId,
    fileName: document.fileName,
  })));
  const trackedDriveIds = new Set(trackedDocuments.map((document) => document.externalId).filter(Boolean));
  const driveIds = new Set(driveFiles.map((file) => file.id).filter(Boolean));
  const sheetIds = sheetValues.map((row) => String(row?.[0] || "").trim());

  const missingDriveDocuments = trackedDocuments.filter((document) => (
    !document.externalId || !driveIds.has(document.externalId)
  ));
  const untrackedDriveFiles = driveFiles.filter((file) => file.id && !trackedDriveIds.has(file.id));
  const duplicateDriveNames = duplicates(driveFiles.map((file) => file.name));
  const duplicateSheetPaymentIds = duplicates(sheetIds.filter((id) => knownPaymentIds.has(id)));
  const untrackedSheetIds = [...new Set(sheetIds.filter((id) => id && !knownPaymentIds.has(id)))];

  const missingOrMismatchedSheetRows = payments
    .filter((payment) => payment.sheetsRow)
    .flatMap((payment) => {
      const rowNumber = rowNumberFromRange(payment.sheetsRow);
      const actualId = rowNumber ? sheetIds[rowNumber - 1] : null;
      return actualId === String(payment.providerPaymentId)
        ? []
        : [{
          paymentId: String(payment.providerPaymentId),
          storedRange: payment.sheetsRow,
          actualId: actualId || null,
        }];
    });

  const errors = missingDriveDocuments.length
    + duplicateSheetPaymentIds.length
    + missingOrMismatchedSheetRows.length;

  return {
    ok: errors === 0,
    summary: {
      databasePayments: payments.length,
      trackedDriveDocuments: trackedDocuments.length,
      trackedSheetRows: payments.filter((payment) => payment.sheetsRow).length,
      driveFiles: driveFiles.length,
      sheetNonEmptyIds: sheetIds.filter(Boolean).length,
    },
    errors: {
      missingDriveDocuments: issueSummary(missingDriveDocuments),
      duplicateSheetPaymentIds: issueSummary(duplicateSheetPaymentIds),
      missingOrMismatchedSheetRows: issueSummary(missingOrMismatchedSheetRows),
    },
    warnings: {
      duplicateDriveNames: issueSummary(duplicateDriveNames),
      untrackedDriveFiles: issueSummary(untrackedDriveFiles.map((file) => ({ id: file.id, name: file.name }))),
      untrackedSheetIds: issueSummary(untrackedSheetIds),
    },
  };
}
