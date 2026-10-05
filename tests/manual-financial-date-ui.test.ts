import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { calendarFixture } from "./manual-adjustment-calendar.test";
import { load, root } from "./manual-payment-idempotency.test";
const file="app/manager/units/[id]/ManualChargeForm.tsx";
function form(now:string,selected?:string,success=false){const f=calendarFixture(15,now);let index=0;const setters:any[]=[];const values:any[]=[];const jsx=(type:any,props:any)=>({type,props});const component=load(file,{react:{useMemo:(fn:any)=>fn(),useState:(initial:any)=>{const i=index++;const value=i===3&&selected!==undefined?selected:i===6?success:initial;values[i]=value;return [value,(next:any)=>{setters[i]=next;}];}},"next/navigation":{useRouter:()=>({refresh(){}})},"@/lib/rentDates":f.dates,"react/jsx-runtime":{jsx,jsxs:jsx}},"",{fetch:async()=>({ok:true,json:async()=>({ok:true})})});const tree=component.default({propertyId:"p",unitId:"u",defaultRent:100});return {tree,values,setters};}
function text(node:any):string{if(node==null)return "";if(typeof node!=="object")return String(node);return Array.isArray(node)?node.map(text).join(" "):text(node.props?.children);}
for(const [instant,day]of [["2026-10-15T00:30:00Z","2026-10-14"],["2026-10-15T05:00:00Z","2026-10-15"],["2027-01-01T00:30:00Z","2026-12-31"]])test(`UI Chicago default ${instant}`,()=>{assert.equal(form(instant).values[3],day);});
test("UI reset uses Chicago date after successful submit",async()=>{const f=form("2026-10-15T00:30:00Z");await f.tree.props.onSubmit({preventDefault(){}});assert.equal(f.setters[3],"2026-10-14");});
for(const selected of ["2026-10-13","2026-10-14","2026-10-15"])test(`UI comparison and wording ${selected}`,()=>{const rendered=text(form("2026-10-15T00:30:00Z",selected).tree);assert.doesNotMatch(rendered,/next billing cycle|next statement/i);if(selected>"2026-10-14"){assert.match(rendered,/Scheduled for\s+2026-10-15/);assert.match(rendered,/excluded from the current balance until effective/);}else assert.match(rendered,/included in the current balance/);});
test("Adjust Balance existing immediate wording, no date selector or proration",()=>{const source=readFileSync(resolve(root,"app/manager/dashboard/components/AdjustBalanceForm.tsx"),"utf8");assert.match(source,/Apply a credit to reduce the current balance/);assert.doesNotMatch(source,/type="date"|PRORATION|next billing cycle/);assert.doesNotMatch(readFileSync(resolve(root,file),"utf8"),/toISOString\(\)\.slice\(0, 10\)/);});
test("real date authority and UI date are host-timezone independent",()=>{
 const script=String.raw`const fs=require('fs'),vm=require('vm'),ts=require('typescript');function load(file,imports={},append=''){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8')+append,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,Date,Intl,require(n){if(!(n in imports))throw Error(n);return imports[n];}});return module.exports;}const dates=load('lib/rentDates.ts');const ui=load('app/manager/units/[id]/ManualChargeForm.tsx',{'react':{},'next/navigation':{},'@/lib/rentDates':dates,'react/jsx-runtime':{}},';exports.today=getTodayDate;');const old=dates.getBusinessDate;dates.getBusinessDate=()=>old(new Date('2026-10-15T00:30:00Z'));console.log(JSON.stringify({today:ui.today(),instant:dates.getBusinessDateInstant('2026-10-15').toISOString(),cycle:dates.getRentDateSummary({dueDay:15,gracePeriodDays:2,lateFeeEnabled:false,lateFeeInitialCents:0,lateFeeDailyCents:0,maxLateFeeDays:0,now:new Date('2026-10-15T00:30:00Z'),rentFrayStartDate:new Date('2026-01-15')}).billingCycle}));`;
 for(const TZ of ["UTC","America/Chicago","Asia/Tokyo","Pacific/Auckland"]){const output=execFileSync(process.execPath,["-e",script],{cwd:root,env:{...process.env,TZ}}).toString();assert.deepEqual(JSON.parse(output),{today:"2026-10-14",instant:"2026-10-15T05:00:00.000Z",cycle:"2026-09"});}
});

for(const selected of ["2026-10-13","2026-10-14","2026-10-15"])test(`UI successful charge timing ${selected}`,()=>{
 const rendered=text(form("2026-10-15T00:30:00Z",selected,true).tree);
 assert.doesNotMatch(rendered,/next statement|next billing cycle/i);
 if(selected>"2026-10-14"){
  assert.match(rendered,/Charge scheduled for 2026-10-15; excluded from the current balance until effective\./);
 }else assert.match(rendered,/Charge posted.*now due and reflected in balance/);
});
