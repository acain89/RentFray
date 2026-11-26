import { requiredDate } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";

import { calendarFixture } from "./manual-adjustment-calendar.fixture";

for (const type of ["CHARGE","CREDIT"]) {
  for (const due of [1,15,28]) for (const delta of [-1,0,1]) test(`adjust ${type} due ${due} offset ${delta}`, async () => {
    const instant = new Date(Date.UTC(2026,9,due+delta,17)).toISOString();
    const f=calendarFixture(due,instant); const r=await f.adjust(type); assert.equal(r.status,200);
    const row=f.state.ledgerEntry[0]; assert.equal(requiredDate(row.effectiveDate).toISOString(),instant);
    const expected=delta<0 ? "2026-09" : "2026-10";
    // Due-day 1's preceding day is September 30, still September's cycle.
    assert.equal(row.billingCycle,expected); assert.equal(row.entryType,type); assert.equal(row.amountCents,10000); assert.equal(row.memo,"test"); assert.equal(row.tenantAssignmentId,"a");
  });
  for (const [instant,cycle] of [["2026-11-01T00:30:00Z","2026-10"],["2027-01-01T00:30:00Z","2026-12"],["2026-10-15T04:59:59Z","2026-09"],["2026-10-15T05:00:00Z","2026-10"]]) test(`adjust ${type} boundary ${instant}`,async()=>{const f=calendarFixture(15,instant);await f.adjust(type);assert.equal(f.state.ledgerEntry[0].billingCycle,cycle);assert.equal(requiredDate(f.state.ledgerEntry[0].effectiveDate).getTime(),new Date(instant).getTime());});
  for(const status of ["PENDING","PAID","FAILED","REVERSED"] as const)test(`adjust ${type} calendar unaffected by unrelated ${status}`,async()=>{const f=calendarFixture();f.state.payment.push({status,billingCycle:"2026-09",unitId:"u",tenantAssignmentId:"a"});assert.equal((await f.adjust(type)).status,200);assert.equal(f.state.ledgerEntry[0].billingCycle,"2026-09");assert.equal(f.state.ledgerEntry[0].memo,"test");});
  test(`adjust ${type} pre-start allowed`,async()=>{const f=calendarFixture();f.property.rentFrayStartDate=new Date("2027-01-15");assert.equal((await f.adjust(type)).status,200);assert.equal(f.state.ledgerEntry[0].billingCycle,"2027-01");assert.equal(requiredDate(f.state.ledgerEntry[0].effectiveDate).toISOString(),"2026-10-14T17:00:00.000Z");});
}
for(const role of [null,"STAFF","TENANT","MAINTENANCE","ADMIN"])test(`adjust rejects ${role}`,async()=>{const f=calendarFixture(15,undefined,role);assert.equal((await f.adjust()).status,401);assert.equal(f.state.ledgerEntry.length,0);});
for(const role of ["OWNER","MANAGER"])test(`adjust permits ${role}`,async()=>{assert.equal((await calendarFixture(15,undefined,role).adjust()).status,200);});
test("adjust retirement, amount and exact assignment contracts",async()=>{const f=calendarFixture();assert.equal((await f.adjust("PRORATION")).status,410);assert.equal((await f.adjust("CHARGE",{amount:0})).status,400);assert.equal((await f.adjust("CHARGE",{tenantAssignmentId:undefined})).status,400);await f.adjust("CREDIT",{amount:0.001});assert.equal(f.state.ledgerEntry[0].amountCents,0);f.state.tenantAssignment=[];assert.equal((await f.adjust()).status,409);});
test("adjust repeated submissions remain distinct without audit",async()=>{const f=calendarFixture();await f.adjust();await f.adjust();assert.equal(f.state.ledgerEntry.length,2);assert.equal(f.state.auditLog.length,0);});
