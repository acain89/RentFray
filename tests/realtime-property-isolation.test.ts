import { cancelResponse, requiredValue } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { streamFixture, flush, sessionFixture } from "./realtime-property-isolation.fixture";


for (const role of [null, "TENANT", "MAINTENANCE", "ADMIN"]) test(`stream rejects ${role}`, async () => {
  const f = streamFixture(role); const response = await f.connect();
  assert.equal(response.status, role ? 403 : 401); assert.equal(f.state().subscriptions, 0);
});
for (const invalid of ["absent", "malformed", "signature-invalid", "expired", "stale", "database failure"]) test(`actual session SSOT rejects ${invalid}`, async () => {
  const auth = sessionFixture();
  if (invalid === "absent") auth.setToken(undefined);
  if (invalid === "malformed") auth.setToken("broken");
  if (invalid === "signature-invalid") auth.setToken(auth.credential() + "x");
  if (invalid === "expired") auth.expire();
  if (invalid === "stale") auth.user.isActive = false;
  if (invalid === "database failure") auth.fail();
  const f = streamFixture("OWNER", auth); assert.equal((await f.connect()).status, 401);
  assert.equal(f.state().subscriptions, 0);
});
for (const role of ["OWNER", "MANAGER", "STAFF"]) test(`${role} receives only authenticated property`, async () => {
  const f = streamFixture(role); const response = await f.connect(); assert.equal(response.status, 200);
  for (const data of [undefined, {}, { propertyId: 4 }, { propertyId: "" }, { propertyId: "b" }]) f.emit(data);
  await flush(); assert.equal(f.chunks.length, 0);
  f.emit({ propertyId: "a", unitId: "u" }); await flush();
  assert.equal(f.chunks.length, 1); assert.match(f.chunks[0], /"propertyId":"a"/);
  cancelResponse(response); assert.equal(f.state().subscriptions, 0);
});

for (const action of ["CREATE", "PIN_TOGGLE"]) test(`notes ${action} emits trusted property despite client scope`, async () => {
  const events: { type: string; data: Record<string, unknown> }[] = []; const fixtureModule: { exports: Partial<{ POST(request: { json(): Promise<unknown> }): Promise<{ status: number }> }> } = { exports: {} };
  const imports: Record<string, unknown> = {
    "@/lib/session": { getSession: async () => ({ role: "OWNER", propertyId: "a", managementUserId: "m" }) },
    "@/lib/realtime": { emitEvent: (type: string, data: Record<string, unknown>) => events.push({ type, data }) },
    "next/server": { NextResponse: { json: (body: unknown) => ({ status: 200, body }) } },
    "@/lib/prisma": { prisma: {
      unit: { findFirst: async ({ where }: { where: { propertyId: string } }) => { assert.equal(where.propertyId, "a"); return { id: "u" }; } },
      unitNote: {
        findFirst: async ({ where }: { where: { propertyId: string } }) => { assert.equal(where.propertyId, "a"); return { id: "n", unitId: "u", isPinned: false }; },
        create: async ({ data }: { data: Partial<import("@prisma/client").UnitNote> }) => { assert.equal(data.propertyId, "a"); return { id: "n", ...data }; },
        update: async ({ where }: { where: { propertyId: string } }) => { assert.equal(where.propertyId, "a"); return { id: "n", unitId: "u" }; },
      },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync("app/api/notes/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: fixtureModule, exports: fixtureModule.exports, console,
    require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  const response = await requiredValue(fixtureModule.exports.POST)({ json: async () => ({ action, unitId: "u", noteId: "n", content: "Note", propertyId: "b" }) });
  assert.equal(response.status, 200); assert.equal(events.length, 1);
  assert.deepEqual(events[0].data.propertyId, "a"); assert.equal(events[0].data.unitId, "u");
});
