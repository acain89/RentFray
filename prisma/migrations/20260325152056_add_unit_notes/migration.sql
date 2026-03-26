-- CreateTable
CREATE TABLE "UnitNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'GENERAL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnitNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitNote_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ManagementUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagementUser_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ManagementUser" ("createdAt", "createdByUserId", "displayName", "id", "isActive", "lastLoginAt", "mustResetPassword", "passwordHash", "propertyId", "role", "updatedAt", "username") SELECT "createdAt", "createdByUserId", "displayName", "id", "isActive", "lastLoginAt", "mustResetPassword", "passwordHash", "propertyId", "role", "updatedAt", "username" FROM "ManagementUser";
DROP TABLE "ManagementUser";
ALTER TABLE "new_ManagementUser" RENAME TO "ManagementUser";
CREATE INDEX "ManagementUser_propertyId_email_idx" ON "ManagementUser"("propertyId", "email");
CREATE INDEX "ManagementUser_propertyId_role_idx" ON "ManagementUser"("propertyId", "role");
CREATE INDEX "ManagementUser_propertyId_isActive_idx" ON "ManagementUser"("propertyId", "isActive");
CREATE UNIQUE INDEX "ManagementUser_propertyId_username_key" ON "ManagementUser"("propertyId", "username");
CREATE TABLE "new_PropertySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "rentDueDay" INTEGER NOT NULL DEFAULT 1,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "lateFeeFlat" REAL,
    "lateFeePercent" REAL,
    "lateFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "convenienceFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "convenienceFeeType" TEXT,
    "convenienceFeeAmount" REAL,
    "allowTestMode" BOOLEAN NOT NULL DEFAULT true,
    "tenantPortalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenancePortalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "setupComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertySettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PropertySettings" ("allowTestMode", "convenienceFeeAmount", "convenienceFeeEnabled", "convenienceFeeType", "createdAt", "gracePeriodDays", "id", "lateFeeEnabled", "lateFeeFlat", "lateFeePercent", "maintenancePortalEnabled", "propertyId", "rentDueDay", "tenantPortalEnabled", "updatedAt") SELECT "allowTestMode", "convenienceFeeAmount", "convenienceFeeEnabled", "convenienceFeeType", "createdAt", "gracePeriodDays", "id", "lateFeeEnabled", "lateFeeFlat", "lateFeePercent", "maintenancePortalEnabled", "propertyId", "rentDueDay", "tenantPortalEnabled", "updatedAt" FROM "PropertySettings";
DROP TABLE "PropertySettings";
ALTER TABLE "new_PropertySettings" RENAME TO "PropertySettings";
CREATE UNIQUE INDEX "PropertySettings_propertyId_key" ON "PropertySettings"("propertyId");
CREATE TABLE "new_PropertyTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseRent" REAL NOT NULL DEFAULT 0,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "billingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "rentDueDay" INTEGER NOT NULL DEFAULT 1,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "lateFeeType" TEXT NOT NULL DEFAULT 'FLAT',
    "lateFeeInitial" REAL NOT NULL DEFAULT 0,
    "lateFeeDaily" REAL NOT NULL DEFAULT 0,
    "maxLateFeeDays" INTEGER NOT NULL DEFAULT 0,
    "processingFee" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyTier_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PropertyTier" ("baseRent", "createdAt", "gracePeriodDays", "id", "isActive", "lateFeeDaily", "lateFeeInitial", "maxLateFeeDays", "name", "processingFee", "propertyId", "rentDueDay", "sortOrder", "unitCount", "updatedAt") SELECT "baseRent", "createdAt", "gracePeriodDays", "id", "isActive", "lateFeeDaily", "lateFeeInitial", "maxLateFeeDays", "name", "processingFee", "propertyId", "rentDueDay", "sortOrder", "unitCount", "updatedAt" FROM "PropertyTier";
DROP TABLE "PropertyTier";
ALTER TABLE "new_PropertyTier" RENAME TO "PropertyTier";
CREATE INDEX "PropertyTier_propertyId_sortOrder_idx" ON "PropertyTier"("propertyId", "sortOrder");
CREATE INDEX "PropertyTier_propertyId_isActive_idx" ON "PropertyTier"("propertyId", "isActive");
CREATE UNIQUE INDEX "PropertyTier_propertyId_name_key" ON "PropertyTier"("propertyId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UnitNote_propertyId_unitId_idx" ON "UnitNote"("propertyId", "unitId");

-- CreateIndex
CREATE INDEX "UnitNote_unitId_createdAt_idx" ON "UnitNote"("unitId", "createdAt");
