import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

test("optional maintenance assignment schema and additive migration contract", () => {
  const root = resolve(__dirname, ".."); const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
  const maintenance = schema.match(/model MaintenanceRequest \{([\s\S]*?)\n\}/)![1];
  const assignment = schema.match(/model TenantAssignment \{([\s\S]*?)\n\}/)![1];
  assert.match(maintenance, /tenantAssignmentId\s+String\?/); assert.match(assignment, /maintenanceRequests\s+MaintenanceRequest\[\]/);
  assert.match(maintenance, /tenantAssignment\s+TenantAssignment\?\s+@relation\(fields: \[tenantAssignmentId\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/);
  assert.match(maintenance, /@@index\(\[propertyId, unitId, tenantAssignmentId\]\)/);
  const migrations = readdirSync(resolve(root, "prisma/migrations")).filter(name => name.endsWith("_bind_maintenance_request_assignment"));
  assert.equal(migrations.length, 1);
  const sql = readFileSync(resolve(root, "prisma/migrations", migrations[0], "migration.sql"), "utf8").replace(/--[^\n]*/g, "");
  const operations = sql.split(";").map(s => s.trim()).filter(Boolean); assert.equal(operations.length, 3);
  assert.equal(operations[0], 'ALTER TABLE "MaintenanceRequest" ADD COLUMN "tenantAssignmentId" TEXT');
  assert.match(operations[1], /^CREATE INDEX "MaintenanceRequest_propertyId_unitId_tenantAssignmentId_idx" ON "MaintenanceRequest"\("propertyId", "unitId", "tenantAssignmentId"\)$/);
  assert.equal(operations[2], 'ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantAssignmentId_fkey" FOREIGN KEY ("tenantAssignmentId") REFERENCES "TenantAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE');
  assert.doesNotMatch(sql, /\bNOT NULL\b|\bDELETE FROM\b|\bDROP\b|\bUPDATE\s+"|ON DELETE CASCADE/i);
});
