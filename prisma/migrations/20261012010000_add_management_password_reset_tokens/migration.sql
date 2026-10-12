CREATE TABLE "ManagementPasswordResetToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "managementUserId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "emailSnapshot" TEXT NOT NULL,
  "credentialBindingSnapshot" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "ManagementPasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ManagementPasswordResetToken_tokenHash_key" ON "ManagementPasswordResetToken"("tokenHash");
CREATE INDEX "ManagementPasswordResetToken_managementUserId_idx" ON "ManagementPasswordResetToken"("managementUserId");
CREATE INDEX "ManagementPasswordResetToken_expiresAt_idx" ON "ManagementPasswordResetToken"("expiresAt");
ALTER TABLE "ManagementPasswordResetToken" ADD CONSTRAINT "ManagementPasswordResetToken_managementUserId_fkey" FOREIGN KEY ("managementUserId") REFERENCES "ManagementUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagementPasswordResetToken" ADD CONSTRAINT "ManagementPasswordResetToken_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
