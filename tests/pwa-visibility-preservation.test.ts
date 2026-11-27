import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { applyReviewedPwaVisibility, restoreReviewedPwaVisibility } from "./reviewed-pwa-visibility.fixture";
for(const file of ["proxy.ts","app/components/PayNowButton.tsx"]) test("PWA scope preserves every financial/authentication byte outside reviewed UI spans: "+file,()=>{
  const before=execFileSync("git",["show","8a4f604c6288fb3d92573250fec47c7c1dd10695:"+file],{encoding:"utf8"}).replace(/\r\n/g,"\n");
  const after=readFileSync(file,"utf8").replace(/\r\n/g,"\n");
  assert.equal(after,applyReviewedPwaVisibility(file,before));assert.equal(restoreReviewedPwaVisibility(file,after),before);
  assert.throws(()=>assert.equal(after+"\n// unauthorized mutation",applyReviewedPwaVisibility(file,before)));
  if(file.includes("PayNowButton"))assert.throws(()=>assert.equal(after.replace("JSON.stringify({ unitId })","JSON.stringify({ amount: 1 })"),applyReviewedPwaVisibility(file,before)));
});
