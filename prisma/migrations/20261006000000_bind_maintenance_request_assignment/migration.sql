ALTER TABLE "MaintenanceRequest" ADD COLUMN "tenantAssignmentId" TEXT;

CREATE INDEX "MaintenanceRequest_propertyId_unitId_tenantAssignmentId_idx" ON "MaintenanceRequest"("propertyId", "unitId", "tenantAssignmentId");

ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantAssignmentId_fkey" FOREIGN KEY ("tenantAssignmentId") REFERENCES "TenantAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
