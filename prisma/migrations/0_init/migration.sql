-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "AdminAccess" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeAccountId" TEXT,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "billingCycleStartDate" TIMESTAMP(3),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertySettings" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "rentDueDay" INTEGER NOT NULL DEFAULT 1,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "lateFeeFlatCents" INTEGER,
    "lateFeePercentBps" INTEGER,
    "lateFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "convenienceFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "convenienceFeeType" TEXT,
    "convenienceFeeAmountCents" INTEGER,
    "allowTestMode" BOOLEAN NOT NULL DEFAULT true,
    "tenantPortalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenancePortalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "setupComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConnectionStatus" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "processorConnected" BOOLEAN NOT NULL DEFAULT false,
    "bankConnected" BOOLEAN NOT NULL DEFAULT false,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "requirementsDue" BOOLEAN NOT NULL DEFAULT false,
    "requirementsSummary" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "readyForLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConnectionStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyTier" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseRentCents" INTEGER NOT NULL DEFAULT 0,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "activeUnitCount" INTEGER NOT NULL DEFAULT 0,
    "billingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "rentDueDay" INTEGER NOT NULL DEFAULT 1,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "lateFeeType" TEXT NOT NULL DEFAULT 'FLAT',
    "lateFeeInitialCents" INTEGER NOT NULL DEFAULT 0,
    "lateFeeDailyCents" INTEGER NOT NULL DEFAULT 0,
    "maxLateFeeDays" INTEGER NOT NULL DEFAULT 0,
    "processingFeeCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyTierCharge" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyTierCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementUser" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tierId" TEXT,
    "unitNumber" TEXT NOT NULL,
    "unitType" TEXT,
    "baseRentCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "portalActivated" BOOLEAN NOT NULL DEFAULT false,
    "portalFirstName" TEXT,
    "portalLastName" TEXT,
    "tenantPinHash" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activationSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitRecurringFee" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitRecurringFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAssignment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "moveInDate" TIMESTAMP(3),
    "moveOutDate" TIMESTAMP(3),
    "notes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdByManagementUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceUser" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdByManagementUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantAssignmentId" TEXT,
    "paymentId" TEXT,
    "billingCycle" TEXT,
    "entryType" TEXT NOT NULL,
    "chargeType" TEXT,
    "paymentMethod" TEXT,
    "amountCents" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "referenceNumber" TEXT,
    "createdByManagementUserId" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedByManagementUserId" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupRequest" (
    "id" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "propertyType" TEXT,
    "address" TEXT,
    "contactName" TEXT NOT NULL,
    "contactInfo" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitNote" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'GENERAL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantAssignmentId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSessionId" TEXT,
    "billingCycle" TEXT,
    "amountCents" INTEGER NOT NULL,
    "processingFeeCents" INTEGER,
    "status" "PaymentStatus" NOT NULL,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "PropertyTierCharge_propertyId_tierId_isActive_idx" ON "PropertyTierCharge"("propertyId", "tierId", "isActive");

-- CreateIndex
CREATE INDEX "PropertyTierCharge_tierId_effectiveDate_idx" ON "PropertyTierCharge"("tierId", "effectiveDate");

-- CreateIndex
CREATE INDEX "ManagementUser_propertyId_email_idx" ON "ManagementUser"("propertyId", "email");

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
CREATE INDEX "TenantAssignment_unitId_isCurrent_moveOutDate_idx" ON "TenantAssignment"("unitId", "isCurrent", "moveOutDate");

-- CreateIndex
CREATE INDEX "TenantAssignment_unitId_moveInDate_createdAt_idx" ON "TenantAssignment"("unitId", "moveInDate", "createdAt");

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
CREATE INDEX "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_billingCycle_idx" ON "LedgerEntry"("billingCycle");

-- CreateIndex
CREATE INDEX "LedgerEntry_propertyId_unitId_billingCycle_idx" ON "LedgerEntry"("propertyId", "unitId", "billingCycle");

-- CreateIndex
CREATE INDEX "LedgerEntry_propertyId_billingCycle_entryType_chargeType_idx" ON "LedgerEntry"("propertyId", "billingCycle", "entryType", "chargeType");

-- CreateIndex
CREATE INDEX "LedgerEntry_propertyId_unitId_voidedAt_idx" ON "LedgerEntry"("propertyId", "unitId", "voidedAt");

-- CreateIndex
CREATE INDEX "AuditLog_propertyId_createdAt_idx" ON "AuditLog"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_createdAt_idx" ON "AuditLog"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "SetupRequest_status_createdAt_idx" ON "SetupRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UnitNote_propertyId_unitId_idx" ON "UnitNote"("propertyId", "unitId");

-- CreateIndex
CREATE INDEX "UnitNote_unitId_createdAt_idx" ON "UnitNote"("unitId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Payment_propertyId_unitId_idx" ON "Payment"("propertyId", "unitId");

-- CreateIndex
CREATE INDEX "Payment_stripePaymentIntentId_idx" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_stripeSessionId_idx" ON "Payment"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_billingCycle_idx" ON "Payment"("billingCycle");

-- CreateIndex
CREATE INDEX "Payment_propertyId_unitId_billingCycle_status_idx" ON "Payment"("propertyId", "unitId", "billingCycle", "status");

-- AddForeignKey
ALTER TABLE "PropertySettings" ADD CONSTRAINT "PropertySettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConnectionStatus" ADD CONSTRAINT "PaymentConnectionStatus_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTier" ADD CONSTRAINT "PropertyTier_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTierCharge" ADD CONSTRAINT "PropertyTierCharge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTierCharge" ADD CONSTRAINT "PropertyTierCharge_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PropertyTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementUser" ADD CONSTRAINT "ManagementUser_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PropertyTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRecurringFee" ADD CONSTRAINT "UnitRecurringFee_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRecurringFee" ADD CONSTRAINT "UnitRecurringFee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAssignment" ADD CONSTRAINT "TenantAssignment_createdByManagementUserId_fkey" FOREIGN KEY ("createdByManagementUserId") REFERENCES "ManagementUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAssignment" ADD CONSTRAINT "TenantAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAssignment" ADD CONSTRAINT "TenantAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceUser" ADD CONSTRAINT "MaintenanceUser_createdByManagementUserId_fkey" FOREIGN KEY ("createdByManagementUserId") REFERENCES "ManagementUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceUser" ADD CONSTRAINT "MaintenanceUser_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_createdByMaintenanceUserId_fkey" FOREIGN KEY ("createdByMaintenanceUserId") REFERENCES "MaintenanceUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_createdByManagementUserId_fkey" FOREIGN KEY ("createdByManagementUserId") REFERENCES "ManagementUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_lastUpdatedByMaintenanceUserId_fkey" FOREIGN KEY ("lastUpdatedByMaintenanceUserId") REFERENCES "MaintenanceUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_lastUpdatedByManagementUserId_fkey" FOREIGN KEY ("lastUpdatedByManagementUserId") REFERENCES "ManagementUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdByManagementUserId_fkey" FOREIGN KEY ("createdByManagementUserId") REFERENCES "ManagementUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantAssignmentId_fkey" FOREIGN KEY ("tenantAssignmentId") REFERENCES "TenantAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_voidedByManagementUserId_fkey" FOREIGN KEY ("voidedByManagementUserId") REFERENCES "ManagementUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitNote" ADD CONSTRAINT "UnitNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitNote" ADD CONSTRAINT "UnitNote_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantAssignmentId_fkey" FOREIGN KEY ("tenantAssignmentId") REFERENCES "TenantAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

