-- CreateTable
CREATE TABLE "PropertyTierCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyTierCharge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyTierCharge_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PropertyTier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PropertyTierCharge_propertyId_tierId_isActive_idx" ON "PropertyTierCharge"("propertyId", "tierId", "isActive");

-- CreateIndex
CREATE INDEX "PropertyTierCharge_tierId_effectiveDate_idx" ON "PropertyTierCharge"("tierId", "effectiveDate");
