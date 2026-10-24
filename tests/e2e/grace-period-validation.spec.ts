import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { GRACE_PERIOD_MESSAGE } from "../../lib/gracePeriod";

// Actual React components in Chromium. No application server, database or network.
async function mount(page: Page, legacy: number, panel = false, serverError = false) {
  const form = `<form onSubmit={e=>{e.preventDefault();window.saved=true}}><GracePeriodInput name='gracePeriodDays' savedValue={${legacy}} value={value} onChange={e=>setValue(e.target.value)} serverError={${serverError ? JSON.stringify(GRACE_PERIOD_MESSAGE) : "undefined"}} /><input name='other' defaultValue='unchanged'/><button>Save</button></form>`;
  const gplf = `<GpLfPanel savedGraceByTier={{t:${legacy}}} localTiers={[{id:'t',tierName:'Tier'}]} activeGpLfTierId='t' gpLfSettings={settings} updateGpLf={updates=>setSettings(s=>({...s,...updates}))} canEditLateFeeSettings={true} configuredGpLfTierIds={['t']} onClose={()=>{}} selectGpLfTier={()=>{}} applyGpLfToAllTiers={()=>{}} saveGpLfSettings={async()=>{window.saved=true}} savingGpLf={false} gpLfSaveMessage='' />`;
  const source = `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
    import GracePeriodInput from './app/components/GracePeriodInput';
    import GpLfPanel from './app/manager/dashboard/components/GpLfPanel';
    function App(){const[value,setValue]=useState('${legacy}');const[settings,setSettings]=useState({graceDays:'${legacy}',lateFeeEnabled:true,lateFeeInitial:'10',lateFeeDaily:'0',lateFeeMaxDays:'0'});return ${panel ? gplf : form};}
    createRoot(document.getElementById('root')).render(<App/>);`;
  const result = await build({ stdin: { contents: source, resolveDir: resolve(__dirname, "../.."), loader: "tsx" }, bundle: true, write: false, platform: "browser", jsx: "automatic" });
  await page.route("**/*", route => route.abort());
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: result.outputFiles[0].text });
}

for (const legacy of [26, 31, 55]) test(`legacy ${legacy} permits unrelated native form saves`, async ({ page }) => {
  await mount(page, legacy);
  const field = page.getByRole("spinbutton");
  await expect(field).toHaveValue(String(legacy));
  await expect(field).not.toHaveAttribute("max");
  await expect(page.getByText(/This saved grace period is preserved/)).toBeVisible();
  await page.locator('[name="other"]').fill("edited");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { saved: boolean }).saved)).toBe(true);
  await field.fill("27");
  await expect(page.getByRole("alert")).toHaveText(GRACE_PERIOD_MESSAGE);
  expect(await field.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
  await field.fill("25");
  await expect(field).toHaveAttribute("max", "25");
  expect(await field.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(true);
});

test("fractions, negatives and blanks remain invalid without digit stripping", async ({ page }) => {
  await mount(page, 5);
  const field = page.getByRole("spinbutton");
  for (const value of ["2.5", "-5", "", "26"]) {
    await field.fill(value); await expect(field).toHaveValue(value);
    await expect(page.getByRole("alert")).toHaveText(GRACE_PERIOD_MESSAGE);
  }
  for (const value of ["0", "25"]) { await field.fill(value); await expect(page.getByRole("alert")).toHaveCount(0); }
});

test("server validation is displayed beside the field", async ({ page }) => {
  await mount(page, 5, false, true);
  await expect(page.getByRole("alert")).toHaveText(GRACE_PERIOD_MESSAGE);
  await expect(page.getByRole("spinbutton")).toHaveAttribute("aria-invalid", "true");
});

test("GPLF preserves legacy values and explicit OFF/ON toggle behavior", async ({ page }) => {
  await mount(page, 55, true);
  const field = page.locator('input[type="number"]');
  await expect(field).toHaveValue("55"); await field.fill("56");
  await expect(page.getByRole("alert")).toHaveText(GRACE_PERIOD_MESSAGE);
  await field.fill("55"); await expect(page.getByRole("alert")).toHaveCount(0);
  const toggle = page.getByRole("checkbox");
  await toggle.uncheck(); await expect(field).toHaveCount(0);
  await toggle.check(); await expect(field).toHaveValue("5");
});
