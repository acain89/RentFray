import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./manual-payment-idempotency.test";
const file="app/manager/properties/[id]/settings/page.tsx";
function fixture(role:any="OWNER") {
 const state:any={status:"SETUP",settings:null,reads:0};
 const session=()=>{if(!["OWNER","MANAGER","STAFF"].includes(role))throw Error("Unauthorized");return {role,propertyId:"p"};};
 const forbidden=async()=>{throw Error("Unexpected lifecycle mutation");};
 const jsx=(type:any,props:any)=>({type,props});
 const page=load(file,{"@/lib/prisma":{prisma:{property:{findUnique:async()=>{state.reads++;return {id:"p",name:"Property",status:state.status};},update:forbidden,updateMany:forbidden},auditLog:{create:forbidden}}},"@/lib/session":{requireManagementSession:async()=>session(),requireManagerLevelSession:async()=>{const s=session();if(s.role==="STAFF")throw Error("Forbidden");return s;}},"@/lib/propertySettings":{getPropertySettings:async()=>({gracePeriodDays:5,lateFeeFlatCents:5000}),upsertPropertySettings:async(id:any,data:any)=>{assert.equal(id,"p");state.settings={...data};}},"react/jsx-runtime":{jsx,jsxs:jsx}},";exports.saveSettings=saveSettings;");
 const save=(status:any="LIVE",extra:any={})=>{const fields:any={propertyId:"p",gracePeriodDays:"7",lateFeeValue:"12.34",...extra};if(status!==undefined)fields.lifecycleStatus=status;return page.saveSettings({get:(key:string)=>fields[key]??null});};
 return {state,page,save};
}
function nodes(node:any):any[]{if(!node||typeof node!=="object")return [];if(Array.isArray(node))return node.flatMap(nodes);return [node,...nodes(node.props?.children)];}
function text(node:any):string{if(node==null)return "";if(typeof node!=="object")return String(node);return Array.isArray(node)?node.map(text).join(" "):text(node.props?.children);}
for(const role of ["OWNER","MANAGER"])for(const current of ["SETUP","TEST","READY","LIVE","SUSPENDED"])for(const submitted of ["SETUP","TEST","READY","LIVE","SUSPENDED","invalid",null])test(`${role} ${current} ignores ${submitted}`,async()=>{const f=fixture(role);f.state.status=current;await f.save(submitted);assert.equal(f.state.status,current);assert.deepEqual(f.state.settings,{gracePeriodDays:7,lateFeeFlatCents:1234,lateFeeEnabled:true});});
for(const role of ["STAFF",null,"TENANT","ADMIN","MAINTENANCE"])test(`${role} cannot save`,async()=>{const f=fixture(role);await assert.rejects(f.save());assert.equal(f.state.settings,null);});
for(const role of ["OWNER","MANAGER","STAFF"])test(`${role} foreign URL rejects before reads`,async()=>{const f=fixture(role);await assert.rejects(f.page.default({params:Promise.resolve({id:"foreign"})}));assert.equal(f.state.reads,0);});
for(const id of ["foreign",""])test(`submitted property ${id} rejects`,async()=>{const f=fixture();await assert.rejects(f.save("LIVE",{propertyId:id}));assert.equal(f.state.settings,null);});
test("stale render cannot overwrite newer lifecycle state",async()=>{const f=fixture();await f.page.default({params:Promise.resolve({id:"p"})});f.state.status="SUSPENDED";await f.save("SETUP");assert.equal(f.state.status,"SUSPENDED");});
for(const role of ["OWNER","MANAGER","STAFF"])test(`${role} renders status as read-only with ordinary role controls`,async()=>{const f=fixture(role);f.state.status="LIVE";const tree=await f.page.default({params:Promise.resolve({id:"p"})});assert.match(text(tree),/Lifecycle Status.*LIVE.*read-only/);const all=nodes(tree);assert.equal(all.filter(n=>n.type==="select"||n.props?.name==="lifecycleStatus").length,0);const form=all.find(n=>n.type==="form");assert.equal(typeof form.props.action,role==="STAFF"?"undefined":"function");for(const field of ["gracePeriodDays","lateFeeValue"])assert.equal(all.find(n=>n.props?.name===field).props.disabled,role==="STAFF");assert.equal(all.some(n=>n.type==="button"),role!=="STAFF");});
for(const [grace,fee,expected]of [["99","0",{gracePeriodDays:31,lateFeeFlatCents:0,lateFeeEnabled:false}],["-5","-2",{gracePeriodDays:0,lateFeeFlatCents:0,lateFeeEnabled:false}],["bad","bad",{gracePeriodDays:5,lateFeeFlatCents:5000,lateFeeEnabled:true}]])test(`ordinary normalization ${grace}/${fee}`,async()=>{const f=fixture();await f.save("LIVE",{gracePeriodDays:grace,lateFeeValue:fee});assert.deepEqual(f.state.settings,expected);});
test("failed readiness cannot be bypassed; no lifecycle write/audit/readiness imports",async()=>{const f=fixture();await f.save("LIVE");assert.equal(f.state.status,"SETUP");assert.equal(f.state.reads,0);});
