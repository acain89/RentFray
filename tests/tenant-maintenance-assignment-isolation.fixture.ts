import type { MaintenanceRequest } from "@prisma/client";
import type { ReadQuery } from "./tenant-payment-history-isolation.fixture";
type Row = Pick<MaintenanceRequest, "id" | "propertyId" | "unitId" | "tenantAssignmentId" | "category" | "urgency" | "status" | "description" | "createdAt" | "updatedAt"> & { createdByTenant?: boolean; unit?: { unitNumber: string; tenantAssignments: unknown[] } };
type Create = Omit<Row, "id" | "createdAt" | "updatedAt" | "unit">;


import { json, session, matches } from "./tenant-payment-history-isolation.fixture";


export function maintenanceFixture(auth: (Omit<typeof session, "role" | "tenantAssignmentId"> & { role: string; tenantAssignmentId?: string }) | null = session) {
  const rows: Row[] = ["a", "b", null].map(tenantAssignmentId => ({ id: String(tenantAssignmentId), propertyId: "p", unitId: "u", tenantAssignmentId,
    category: "PLUMBING", urgency: "NORMAL", status: "OPEN", description: "Leaking faucet", createdAt: new Date(), updatedAt: new Date(), unit: { unitNumber: "101", tenantAssignments: [] } }));
  rows.push({ ...rows[0], id: "foreign", propertyId: "q", tenantAssignmentId: "b" }, { ...rows[0], id: "wrong-unit", unitId: "v", tenantAssignmentId: "b" });
  const writes: Create[] = []; const queries: ReadQuery[] = [];
  const prisma = { unit: { findFirst: async (args: ReadQuery) => { queries.push(args); return matches({ id: "u", propertyId: "p" }, args.where) ? { id: "u", propertyId: "p" } : null; } },
    maintenanceRequest: { create: async ({ data, select }: { data: Create; select: Record<string, boolean> }) => { writes.push(data); const row = { ...data, id: "new", createdAt: new Date(), updatedAt: new Date() }; rows.push(row); return Object.fromEntries(Object.keys(select).map(key => [key, Reflect.get(row, key)])); },
      findMany: async (args: ReadQuery) => { queries.push(args); return rows.filter(row => matches(row, args.where)); } } };
  class SessionAuthorizationError extends Error {
    constructor(readonly status: 401 | 403) { super(status === 401 ? "Unauthorized" : "Forbidden"); }
  }
  const imports: Record<string, unknown> = { "next/server": json, "@/lib/prisma": { prisma }, "@/lib/session": { getSession: async () => auth,
    SessionAuthorizationError, requireRole: async (role: string) => { if (!auth) throw new SessionAuthorizationError(401); if (auth.role !== role) throw new SessionAuthorizationError(403); return auth; } } };
  return { rows, writes, queries, prisma, imports };
}
