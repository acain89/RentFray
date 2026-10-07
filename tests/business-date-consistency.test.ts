import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Each child gets its own host TZ. Production modules are transpiled in memory
// and receive only isolated fixtures; no Prisma client or Stripe SDK is loaded.
const worker = String.raw`
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = process.cwd();
assert.equal(new Date('2026-10-01T12:00:00Z').getTimezoneOffset(), {'America/Chicago':300,UTC:0,'America/Los_Angeles':420,'Asia/Tokyo':-540}[process.env.TZ]);
function source(file, imports, append='', extras={}) {
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.resolve(root,file),'utf8')+append, {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}
  }).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,Date,Error,Buffer,URL,Set,Map,structuredClone,
    console:{error(){}},process:{env:{}},__dirname:path.dirname(path.resolve(root,file)),
    require(name){if(!(name in imports))throw Error('Unexpected dependency '+name);return imports[name];},...extras});
  return module.exports;
}
const cache = new Map();
function fixtureModule(file, append='') {
  const cacheKey=file+append;if(cache.has(cacheKey))return cache.get(cacheKey);
  const text=fs.readFileSync(path.resolve(root,file),'utf8');
  const imports={};
  for(const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
    const name=match[1];
    if(name==='node:test')imports[name]={test(){}};
    else if(name==='@playwright/test')imports[name]={test(){},expect:require('@playwright/test').expect};
    else if(name.startsWith('.'))imports[name]=fixtureModule(path.relative(root,path.resolve(root,path.dirname(file),name+'.ts')));
    else if(name.startsWith('node:')||name==='typescript')imports[name]=require(name);
    else throw Error('Disallowed fixture dependency '+name);
  }
  const result=source(file,imports,append,{require(name){if(name in imports)return imports[name];if(name==='node:vm'||name==='typescript')return require(name);throw Error('Unexpected fixture import '+name);}});
  cache.set(cacheKey,result);return result;
}
const dates=source('lib/rentDates.ts',{});
const label = date => {const day=dates.getBusinessDate(date);return [day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');};
(async()=>{
  const fmod=fixtureModule('tests/manual-payment-idempotency.test.ts');
  for(const [day,expected] of [['2026-10-01','2026-10-01T05:00:00.000Z'],['2026-01-01','2026-01-01T06:00:00.000Z'],['2026-12-31','2026-12-31T06:00:00.000Z']]) {
    assert.equal(dates.getBusinessDateInstant(day).toISOString(),expected);
    const f=fmod.fixture();const result=await f.pay({effectiveDate:day});assert.equal(result.status,200);
    assert.equal(f.state.ledgerEntry[0].effectiveDate.toISOString(),expected);
    assert.equal(f.state.payment[0].paidAt.toISOString(),expected);
    assert.equal(JSON.parse(f.state.auditLog[0].metadataJson).effectiveDate,expected);
  }
  for(const now of ['2026-10-01T00:01:00Z','2027-01-01T00:01:00Z']) {
    const expected=now.startsWith('2026')?'2026-09-30':'2026-12-31';
    assert.equal(label(new Date(now)),expected);
    class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}}
    const form=source('app/manager/units/[id]/ManualPaymentForm.tsx',{'react':{},'react/jsx-runtime':{},'next/navigation':{},'@/lib/rentDates':{...dates,getBusinessDate:()=>dates.getBusinessDate(new Date(now))}},'\nmodule.exports.today = getTodayDate;');
    assert.equal(form.today(),expected);
    const v=fmod.fixture();v.imports['@/lib/rentDates']=dates;
    const vacate=source('app/api/manager/units/vacate/route.ts',v.imports,'\nmodule.exports.parse=parseMoveOutDate;module.exports.format=formatDateOnly;',{Date:Clock});
    assert.equal(vacate.parse('').toISOString(),dates.getBusinessDateInstant(expected).toISOString());
    assert.equal(vacate.format(vacate.parse('2026-10-01')),'2026-10-01');
    assert.equal(vacate.parse('2026-10-01').toISOString(),'2026-10-01T05:00:00.000Z');
  }
  // Completed legacy host-local and production-UTC encodings replay unchanged.
  for(const historical of [new Date('2026-10-05T00:00:00').toISOString(),'2026-10-05T00:00:00.000Z']) {
    const f=fmod.fixture();const completed=await f.pay();assert.equal(completed.status,200);
    const metadata=JSON.parse(f.state.auditLog[0].metadataJson);
    metadata.operation.payload.effectiveDate=historical;
    metadata.operation.result.effectiveDate=historical;
    f.state.auditLog[0].metadataJson=JSON.stringify(metadata);
    f.state.ledgerEntry[0].effectiveDate=new Date(historical);
    f.state.payment[0].paidAt=new Date(historical);
    const counts=[f.state.payment.length,f.state.ledgerEntry.length,f.state.auditLog.length];
    f.state.tenantAssignment[0].isCurrent=false;
    const replay=await f.pay();assert.equal(replay.status,200);assert.equal(replay.body.data.entry.effectiveDate,historical);
    assert.deepEqual([f.state.payment.length,f.state.ledgerEntry.length,f.state.auditLog.length],counts);
    assert.equal((await f.pay({effectiveDate:'2026-10-06'})).status,409);
    assert.equal((await f.pay({amount:124})).status,409);
  }
  const f=fmod.fixture();f.imports['@/lib/rentDates']=dates;
  const activation=source('app/api/tenant/activate/route.ts',f.imports,'\nmodule.exports.moveIn=parseMoveInDate;module.exports.rent=parseRentDate;');
  for(const day of ['2026-09-30','2026-10-01','2026-10-02','2026-12-31','2027-01-01']) {
    assert.equal(activation.moveIn(day).toISOString(),dates.getBusinessDateInstant(day).toISOString());
    assert.equal(activation.rent(day).toISOString(),dates.getBusinessDateInstant(day).toISOString());
  }
  assert.equal(activation.moveIn('2026-02-30'),null);
  assert.throws(()=>activation.rent('2026-02-30'));
  f.imports['@prisma/client'].Prisma.TransactionIsolationLevel={Serializable:'Serializable'};
  for(const [day,rent] of [['2026-09-30',true],['2026-10-01',true],['2026-10-02',false]]) {
    const a=fmod.fixture();a.state.tenantAssignment=[];a.imports['@prisma/client'].Prisma.TransactionIsolationLevel={Serializable:'Serializable'};
    const res=await a.route('app/api/tenant/activate/route.ts').POST({json:async()=>({propertyCode:'1234',firstName:'First',lastName:'Last',unitNumber:'1',confirmUnitNumber:'1',tierId:'s',pin:'1234',confirmPin:'1234',recentMoveIn:true,moveInDate:day})});
    assert.equal(res.status,200);assert.equal(a.state.tenantAssignment[0].moveInDate.toISOString(),dates.getBusinessDateInstant(day).toISOString());
    assert.equal(a.state.ledgerEntry.length,rent?1:0);if(rent)assert.equal(a.state.ledgerEntry[0].effectiveDate.toISOString(),'2026-10-01T05:00:00.000Z');
    assert.equal(a.state.units[0].tenantPinHash,'hash');
  }
  const monthly=fixtureModule('tests/monthly-recurring-configuration.test.ts');
  for(const [day,eligible] of [['2026-09-30',true],['2026-10-01',true],['2026-10-02',false]]) {
    const m=monthly.monthlyFixture();m.unit.tier.baseRentCents=10000;
    m.unit.tenantAssignments[0].moveInDate=dates.getBusinessDateInstant(day);
    m.unit.recurringFeeItems=[{id:'water',label:'Water',amountCents:2500,createdAt:dates.getBusinessDateInstant('2026-10-01')},{id:'later',label:'Later',amountCents:3000,createdAt:dates.getBusinessDateInstant('2026-10-02')}];
    await m.run(new Date('2026-10-20T12:00:00Z'));
    assert.equal(m.ledger.length,eligible?2:0);assert.ok(!m.ledger.some(r=>r.idempotencyKey.endsWith(':later')));
    const prior=JSON.stringify(m.ledger);await m.run(new Date('2026-10-21T12:00:00Z'));assert.equal(JSON.stringify(m.ledger),prior);
  }
  const tenancy=fixtureModule('tests/tenant-login-assignment-race.test.ts');
  for(const selected of [undefined,'2026-10-01']) {
    const v=tenancy.fixture();v.db.payment={findMany:async()=>[]};
    v.imports['@/lib/checkoutCollectibility']=source('lib/checkoutCollectibility.ts',{stripe:class {}});
    const response=await v.invoke('app/api/manager/units/vacate/route.ts',{unitId:'u',tenantAssignmentId:'a',moveOutDate:selected});
    const expected=selected??'2026-10-14';assert.equal(response.status,200);
    assert.equal(response.body.data.moveOutDate,expected);
    assert.equal(JSON.parse(v.state().audits[0].metadataJson).moveOutDate,expected);
    assert.equal(v.state().assignments[0].moveOutDate.toISOString(),dates.getBusinessDateInstant(expected).toISOString());
    assert.equal(v.state().assignments[0].isCurrent,false);assert.equal(v.state().unit.tenantPinHash,null);
  }
  let prior=0,pending=false;
  const financial=source('lib/unitFinancialState.ts',{
    '@/lib/ledger':{getUnitLedgerSummary:async()=>({balanceCents:10000,priorCycleOutstandingCents:prior,oldestOutstandingDueDate:dates.getBusinessDateInstant('2026-03-07'),hasPendingPayment:pending,hasFailedPayment:false,hasReversedPayment:false,hasPaidPayment:false})},
    '@/lib/rentDates':dates,'@/lib/unitStatusEngine':source('lib/unitStatusEngine.ts',{}),
    '@/lib/billingConfig':{getProcessingFeeCents:()=>0},'@/lib/billingCalendar':{assertTierBillingCalendar:()=>1}
  });
  const financialInput={propertyId:'p',unitId:'u',tenantAssignmentId:'a',tier:{rentDueDay:1,gracePeriodDays:10},propertySettings:null,rentFrayStartDate:new Date('2026-01-01T00:00:00Z'),now:new Date('2026-03-09T17:00:00Z')};
  let state=await financial.getUnitFinancialState(financialInput);assert.equal(state.isWithinGracePeriod,true);assert.equal(state.daysPastDue,0);
  prior=10000;state=await financial.getUnitFinancialState(financialInput);assert.equal(state.isDelinquent,true);assert.equal(state.daysPastDue,2);
  pending=true;state=await financial.getUnitFinancialState(financialInput);assert.equal(state.isDelinquent,false);assert.equal(state.daysPastDue,0);assert.equal(state.tenantTotalDueCents,0);
  const unavailable=new Proxy({}, {get(){throw Error('No database access permitted');}});
  for(const file of ['lib/unitFinancialState.ts','lib/delinquency.ts']) {
    const arithmetic=source(file,{'@/lib/prisma':{prisma:unavailable},'@/lib/ledger':{},'@/lib/rentDates':dates,'@/lib/billingConfig':{},'@/lib/unitStatusEngine':{},'@/lib/billingCalendar':{}},'\nmodule.exports.diff=diffDays;');
    for(const [later,earlier,count] of [[new Date(2026,2,9),new Date(2026,2,7),2],[new Date(2026,10,2),new Date(2026,9,31),2],[new Date(2026,9,1),new Date(2026,8,30),1],[new Date(2027,0,1),new Date(2026,11,31),1],[new Date(2026,9,5),new Date(2026,9,1),4]])assert.equal(arithmetic.diff(later,earlier),count);
  }
  const calendar={dueDay:1,gracePeriodDays:5,lateFeeEnabled:true,lateFeeInitialCents:1000,lateFeeDailyCents:100,maxLateFeeDays:5,rentFrayStartDate:new Date('2026-10-01T00:00:00Z')};
  for(const day of ['2026-09-30','2026-10-01','2026-10-02','2027-01-01']) {
    const summary=dates.getRentDateSummary({...calendar,now:dates.getBusinessDateInstant(day)});
    assert.equal(summary.billingCycle,day < '2026-10-01' ? '2026-10' : day.slice(0,7));assert.equal(summary.hasStarted,day>='2026-10-01');
  }
  const returns=fixtureModule('tests/e2e/payment-return-accounting.spec.ts','\nmodule.exports.fixture = fixture;');
  const w=returns.fixture(2500);await w.apply();
  const entries=w.db().ledger.filter(row=>row.paymentId==='payment');assert.equal(entries.length,2);
  assert.ok(entries.every(row=>row.effectiveDate.toISOString()==='2026-10-05T05:00:00.000Z'));
  assert.equal(w.payment().status,'PAID');
  const p=returns.fixture();await p.apply();
  p.refunds.push({id:'refund',charge:'ch',currency:'usd',status:'succeeded',amount:50000});await p.apply('charge.refunded');
  const adjustment=p.db().ledger.find(row=>row.entryType==='ADJUSTMENT');assert.equal(adjustment.amountCents,50000);
  assert.equal(adjustment.effectiveDate.toISOString(),'2026-10-05T05:00:00.000Z');
  const before=JSON.stringify(p.db().ledger);await p.apply('charge.refunded');assert.equal(JSON.stringify(p.db().ledger),before);
  console.log('RF-05 date matrix passed under '+process.env.TZ);
})().catch(error=>{console.error(error);process.exitCode=1;});
`;

for (const zone of ["America/Chicago", "UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
  test("canonical dates, replay, activation, eligibility, webhook and DST under " + zone, () => {
    const output = execFileSync(process.execPath, ["-e", worker], {
      cwd: resolve(__dirname, ".."), env: { ...process.env, TZ: zone },
      encoding: "utf8", windowsHide: true, timeout: 120000,
    });
    assert.match(output, /RF-05 date matrix passed/);
  });
}
