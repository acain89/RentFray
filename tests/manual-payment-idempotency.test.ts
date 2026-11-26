import { requiredRecord } from "./fixture-assertions";
import { requiredNumber } from "./fixture-assertions";

import { test } from "node:test";
import assert from "node:assert/strict";




import { uuid, second, fixture } from "./manual-payment-idempotency.fixture";

for(const role of ["OWNER","MANAGER"])test(role+" manual payment preserves paid/manual cents/cycle/attribution",async()=>{const f=fixture(role);const r=await f.pay();assert.equal(r.status,200);assert.equal(f.state.payment.length,1);assert.equal(f.state.ledgerEntry.length,1);assert.equal(f.state.auditLog.length,1);assert.equal(f.state.payment[0].status,"PAID");assert.equal(f.state.payment[0].paymentMethod,"MANUAL");assert.equal(f.state.ledgerEntry[0].amountCents,-12345);assert.equal(requiredRecord(requiredRecord(r.body.data).entry).billingCycle,"2026-10");assert.equal(requiredRecord(requiredRecord(r.body.data).entry).tenantAssignmentId,"a");});
for(const role of [null,"STAFF","TENANT","MAINTENANCE","ADMIN"])test(String(role)+" cannot post payment",async()=>{const f=fixture(role);assert.equal((await f.pay()).status,role===null?401:403);assert.equal(f.events.length,0);});
for(const body of [{tenantAssignmentId:"missing"},{tenantAssignmentId:""},{tenantId:"a",tenantAssignmentId:undefined},{unitId:"foreign"},{operationId:"bad"},{amount:0},{amount:-1},{amount:"NaN"},{amount:1000001},{effectiveDate:"bad"}])test("reject invalid payment "+JSON.stringify(body),async()=>{const f=fixture();assert.ok((await f.pay(body)).status>=400);assert.equal(f.state.payment.length,0);});
for(const change of [{isCurrent:false},{propertyId:"other"},{unitId:"other"},{moveOutDate:new Date("2000-01-01")},{moveInDate:new Date("2100-01-01")}])test("assignment eligibility "+JSON.stringify(change),async()=>{const f=fixture();Object.assign(f.state.tenantAssignment[0],change);assert.equal((await f.pay()).status,409);assert.equal(f.state.payment.length,0);});
test("identical replay returns original entry after vacancy and replacement",async()=>{const f=fixture();const first=await f.pay();f.state.tenantAssignment[0].isCurrent=false;f.state.tenantAssignment.push({id:"replacement",propertyId:"p",unitId:"u",isCurrent:true});const replay=await f.pay();assert.deepEqual(replay.body,first.body);assert.equal(f.state.payment.length,1);assert.equal(f.state.auditLog.length,1);});
for(const body of [{amount:124},{memo:"changed"},{effectiveDate:"2026-10-06"},{tenantAssignmentId:"replacement"},{unitId:"other"}])test("changed payment payload conflicts "+JSON.stringify(body),async()=>{const f=fixture();await f.pay();assert.equal((await f.pay(body)).status,409);assert.equal(f.state.payment.length,1);});
test("distinct operations permit same amount/date including overpayment",async()=>{const f=fixture();assert.equal((await f.pay({amount:10000})).status,200);assert.equal((await f.pay({amount:10000,operationId:second})).status,200);assert.equal(f.state.payment.length,2);assert.equal(f.state.ledgerEntry.reduce((s:number,r)=>s+requiredNumber(r.amountCents),0),-2000000);});
for(const fail of ["payment.create","ledgerEntry.create","auditLog.create"])test("atomic rollback at "+fail,async()=>{const f=fixture();f.controls.fail=fail;assert.equal((await f.pay()).status,500);assert.equal(f.state.payment.length,0);assert.equal(f.state.ledgerEntry.length,0);assert.equal(f.state.auditLog.length,0);});
test("normalized memo/amount/UUID replay",async()=>{const f=fixture();const a=await f.pay({memo:" hello ",amount:123.45001});const b=await f.pay({memo:"hello",operationId:uuid.toUpperCase()});assert.deepEqual(a.body,b.body);assert.equal(f.state.payment.length,1);});
