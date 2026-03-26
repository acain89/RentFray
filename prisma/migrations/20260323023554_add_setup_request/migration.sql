-- CreateTable
CREATE TABLE "AdminAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "propertyCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SETUP',
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "propertyType" TEXT,
    "ownerDisplayName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PropertySettings" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertySettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentConnectionStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "processorConnected" BOOLEAN NOT NULL DEFAULT false,
    "bankConnected" BOOLEAN NOT NULL DEFAULT false,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "requirementsDue" BOOLEAN NOT NULL DEFAULT false,
    "requirementsSummary" TEXT,
    "lastSyncedAt" DATETIME,
    "readyForLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentConnectionStatus_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropertyTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseRent" REAL NOT NULL DEFAULT 0,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "rentDueDay" INTEGER NOT NULL DEFAULT 1,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "ManagementUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagementUser_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "tierId" TEXT,
    "unitNumber" TEXT NOT NULL,
    "unitType" TEXT,
    "baseRent" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "recurringFees" REAL NOT NULL DEFAULT 0,
    "portalActivated" BOOLEAN NOT NULL DEFAULT false,
    "portalFirstName" TEXT,
    "portalLastName" TEXT,
    "tenantPinHash" TEXT,
    "activatedAt" DATETIME,
    "activationSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Unit_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PropertyTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitRecurringFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UnitRecurringFee_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitRecurringFee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenantAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "moveInDate" DATETIME,
    "moveOutDate" DATETIME,
    "notes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdByManagementUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenantAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenantAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenantAssignment_createdByManagementUserId_fkey" FOREIGN KEY ("createdByManagementUserId") REFERENCES "ManagementUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdByManagementUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceUser_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceUser_createdByManagementUserId_fkey" FOREIGN KEY ("createdByManagementUserId") REFERENCES "ManagementUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "tenantVisibleName" TEXT,
    "createdByTenant" BOOLEAN NOT NULL DEFAULT false,
    "createdByManagementUserId" TEXT,
    "createdByMaintenanceUserId" TEXT,
    "lastUpdatedByManagementUserId" TEXT,
    "lastUpdatedByMaintenanceUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_createdByManagementUserId_fkey" FOREIGN KEY ("createdByManagementUserId") REFERENCES "ManagementUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_createdByMaintenanceUserId_fkey" FOREIGN KEY ("createdByMaintenanceUserId") REFERENCES "MaintenanceUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_lastUpdatedByManagementUserId_fkey" FOREIGN KEY ("lastUpdatedByManagementUserId") REFERENCES "ManagementUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_lastUpdatedByMaintenanceUserId_fkey" FOREIGN KEY ("lastUpdatedByMaintenanceUserId") REFERENCES "MaintenanceUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantAssignmentId" TEXT,
    "entryType" TEXT NOT NULL,
    "chargeType" TEXT,
    "paymentMethod" TEXT,
    "amount" REAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "memo" TEXT,
    "referenceNumber" TEXT,
    "createdByManagementUserId" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "voidedAt" DATETIME,
    "voidedByManagementUserId" TEXT,
    "voidReason" TEXT,
    CONSTRAINT "LedgerEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_tenantAssignmentId_fkey" FOREIGN KEY ("tenantAssignmentId") REFERENCES "TenantAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_createdByManagementUserId_fkey" FOREIGN KEY ("createdByManagementUserId") REFERENCES "ManagementUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_voidedByManagementUserId_fkey" FOREIGN KEY ("voidedByManagementUserId") REFERENCES "ManagementUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorAdminId" TEXT,
    "actorManagementUserId" TEXT,
    "actorMaintenanceUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetupRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyName" TEXT NOT NULL,
    "propertyType" TEXT,
    "address" TEXT,
    "contactName" TEXT NOT NULL,
    "contactInfo" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_propertyCode_key" ON "Property"("propertyCode");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE INDEX "Property_isActive_idx" ON "Property"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PropertySettings_propertyId_key" ON "PropertySettings"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentConnectionStatus_propertyId_key" ON "PaymentConnectionStatus"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyTier_propertyId_sortOrder_idx" ON "PropertyTier"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "PropertyTier_propertyId_isActive_idx" ON "PropertyTier"("propertyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyTier_propertyId_name_key" ON "PropertyTier"("propertyId", "name");

-- CreateIndex
CREATE INDEX "ManagementUser_propertyId_role_idx" ON "ManagementUser"("propertyId", "role");

-- CreateIndex
CREATE INDEX "ManagementUser_propertyId_isActive_idx" ON "ManagementUser"("propertyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementUser_propertyId_username_key" ON "ManagementUser"("propertyId", "username");

-- CreateIndex
CREATE INDEX "Unit_propertyId_tierId_idx" ON "Unit"("propertyId", "tierId");

-- CreateIndex
CREATE INDEX "Unit_propertyId_isActive_idx" ON "Unit"("propertyId", "isActive");

-- CreateIndex
CREATE INDEX "Unit_propertyId_portalActivated_idx" ON "Unit"("propertyId", "portalActivated");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_propertyId_unitNumber_key" ON "Unit"("propertyId", "unitNumber");

-- CreateIndex
CREATE INDEX "UnitRecurringFee_propertyId_unitId_idx" ON "UnitRecurringFee"("propertyId", "unitId");

-- CreateIndex
CREATE INDEX "UnitRecurringFee_unitId_isActive_idx" ON "UnitRecurringFee"("unitId", "isActive");

-- CreateIndex
CREATE INDEX "TenantAssignment_propertyId_unitId_idx" ON "TenantAssignment"("propertyId", "unitId");

-- CreateIndex
CREATE INDEX "TenantAssignment_unitId_isCurrent_idx" ON "TenantAssignment"("unitId", "isCurrent");

-- CreateIndex
CREATE INDEX "TenantAssignment_propertyId_isCurrent_idx" ON "TenantAssignment"("propertyId", "isCurrent");

-- CreateIndex
CREATE INDEX "MaintenanceUser_propertyId_isActive_idx" ON "MaintenanceUser"("propertyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceUser_propertyId_pinHash_key" ON "MaintenanceUser"("propertyId", "pinHash");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_propertyId_status_idx" ON "MaintenanceRequest"("propertyId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_propertyId_unitId_idx" ON "MaintenanceRequest"("propertyId", "unitId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_propertyId_urgency_idx" ON "MaintenanceRequest"("propertyId", "urgency");

-- CreateIndex
CREATE INDEX "LedgerEntry_propertyId_unitId_effectiveDate_idx" ON "LedgerEntry"("propertyId", "unitId", "effectiveDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_unitId_effectiveDate_idx" ON "LedgerEntry"("unitId", "effectiveDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_tenantAssignmentId_idx" ON "LedgerEntry"("tenantAssignmentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_entryType_idx" ON "LedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "AuditLog_propertyId_createdAt_idx" ON "AuditLog"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_createdAt_idx" ON "AuditLog"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "SetupRequest_status_createdAt_idx" ON "SetupRequest"("status", "createdAt");
