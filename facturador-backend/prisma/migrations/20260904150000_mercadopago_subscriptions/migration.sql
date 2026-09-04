ALTER TABLE "Subscription"
ADD COLUMN "billingStatusRaw" TEXT,
ADD COLUMN "billingAmount" DOUBLE PRECISION,
ADD COLUMN "billingCurrency" TEXT,
ADD COLUMN "exchangeRate" DOUBLE PRECISION,
ADD COLUMN "exchangeRateSource" TEXT,
ADD COLUMN "exchangeRateAt" TIMESTAMP(3);

CREATE INDEX "Subscription_billingProvider_billingRef_idx" ON "Subscription"("billingProvider", "billingRef");
