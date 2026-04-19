-- CreateEnum
CREATE TYPE "TenantUserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "TenantUser"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "status" "TenantUserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "lastLoginAt" TIMESTAMP(3);
