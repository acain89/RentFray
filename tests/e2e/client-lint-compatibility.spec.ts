import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

type RequestRecord = { url: string; body: Record<string, unknown> | null };
declare global { interface Window { rfClientTest: { requests: RequestRecord[]; refreshes: number; mode: string; replies: Record<string, (body: unknown) => void> }; rfSessionMarker?: string } }
const dashboard = {
  property: { id: "p", name: "Isolated Property", code: "01234", unitCount: 1, rentFrayStartDate: "2026-01-01T12:00:00Z",
    setupCompleteAcknowledgedAt: "2026-01-01", onboarding: { propertyStatus: "LIVE", managerAccountComplete: true, propertyInformationComplete: true, pricingComplete: true, billingComplete: true, bankConnected: true } },
  session: { role: "OWNER", isImpersonating: false }, units: [], payments: [], tiers: [],
};
const sources = {
  payment: 'import Form from "./app/manager/units/[id]/ManualPaymentForm";function App(){const[id,setId]=React.useState("original");return <><button onClick={()=>setId("replacement")}>Change identity</button><Form propertyId="p" unitId="u" tenantAssignmentId={id}/></>}',
  dashboard: 'import App from "./app/manager/dashboard/ManagerDashboardClient";',
  queue: 'import App from "./app/manager/properties/page";',
  redirect: 'import {DocumentRedirect} from "./components/DocumentRedirect";function App(){return <DocumentRedirect path="/login/manager"/>}',
  navigation: 'import {navigateDocument} from "./lib/documentNavigation";function App(){return <button onClick={()=>navigateDocument("/manager/dashboard?code=01234")}>Enter dashboard</button>}',
};
const pageErrors = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => { expect(pageErrors.get(page) ?? []).toEqual([]); });
async function mount(page: Page, kind: keyof typeof sources) {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
  const result = await build({ stdin: { contents: 'import React from "react";import {createRoot} from "react-dom/client";' + sources[kind] + ';createRoot(document.getElementById("root")!).render(<App/>);', resolveDir: resolve(__dirname, "../.."), loader: "tsx" },
    bundle: true, write: false, platform: "browser", jsx: "automatic", loader: { ".css": "empty" }, define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [{ name: "isolated-next", setup(plugin) {
      plugin.onResolve({ filter: /^next\/(navigation|link|image)$/ }, args => ({ path: args.path, namespace: "isolated-next" }));
      plugin.onLoad({ filter: /.*/, namespace: "isolated-next" }, args => ({ loader: "js", resolveDir: resolve(__dirname, "../.."), contents: args.path === "next/navigation"
        ? 'import {useSyncExternalStore} from "react";const subscribe=fn=>{window.addEventListener("popstate",fn);return()=>window.removeEventListener("popstate",fn)};const router={refresh(){window.rfClientTest.refreshes++},push(){throw Error("Unexpected router navigation")},replace(){throw Error("Unexpected router navigation")}};export const useRouter=()=>router;export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>""))}export function useParams(){return {id:useSearchParams().get("property")||"a"}}export const RedirectType={push:"push"};export function redirect(){throw Error("Unexpected render redirect")}'
        : 'import React from "react";export default function Element({children,unoptimized,...props}){return React.createElement(' + JSON.stringify(args.path === "next/link" ? "a" : "img") + ',props,children)}' }));
    } }] });
  await page.route("**/*", route => new URL(route.request().url()).origin === "https://preview.invalid" && route.request().isNavigationRequest()
    ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
  await page.goto("https://preview.invalid/?property=a");
  await page.evaluate(({ kind, payload }) => {
    window.rfClientTest = { requests: [], refreshes: 0, mode: "uncertain", replies: {} }; window.rfSessionMarker = "old identity";
    window.fetch = async (input, init) => {
      const url = String(input); const state = window.rfClientTest;
      const body: Record<string, unknown> | null = init?.body ? JSON.parse(String(init.body)) : null;
      state.requests.push({ url, body });
      if (state.requests.length > 10) throw Error("Repeated client request loop: " + url);
      if (url === "/api/manager/dashboard") return Response.json(payload);
      if (url === "/api/auth/session") return Response.json({ ok: true, user: { role: "OWNER" } });
      if (kind === "queue" && url.startsWith("/api/manager/maintenance?")) return new Promise<Response>(done => { state.replies[url] = value => done(Response.json(value)); });
      if (url === "/api/manual-payments") {
        if (state.mode === "uncertain") { state.mode = "success"; throw Error("response lost"); }
        return Response.json({ ok: true, data: { entry: { id: "entry" } } });
      }
      throw Error("Unexpected isolated request: " + url);
    };
  }, { kind, payload: dashboard });
  await page.addScriptTag({ content: result.outputFiles[0].text });
}

test("real React payment view preserves uncertain payload across identity changes and unlocks only acknowledged success", async ({ page }) => {
  await mount(page, "payment");
  await page.getByPlaceholder("Amount").fill("123.45"); await page.locator('input[type="date"]').fill("2026-10-05"); await page.getByPlaceholder("Memo (optional)").fill("original memo");
  await page.getByRole("button", { name: "Post Payment", exact: true }).click();
  await expect(page.getByText("Network error. Please try again.")).toBeVisible();
  await expect(page.getByPlaceholder("Amount")).toBeDisabled();
  await page.getByRole("button", { name: "Change identity" }).click();
  await page.getByRole("button", { name: "Post Payment", exact: true }).click();
  await expect(page.getByPlaceholder("Amount")).toBeEnabled();
  let requests = await page.evaluate(() => window.rfClientTest.requests);
  expect(requests).toHaveLength(2); expect(requests[1].body).toEqual(requests[0].body);
  expect(requests[1].body).toMatchObject({ tenantAssignmentId: "original", amount: 123.45, effectiveDate: "2026-10-05", memo: "original memo" });
  await page.getByPlaceholder("Amount").fill("1"); await page.getByRole("button", { name: "Post Payment", exact: true }).dblclick();
  await expect.poll(() => page.evaluate(() => window.rfClientTest.requests.length)).toBe(3);
  requests = await page.evaluate(() => window.rfClientTest.requests);
  expect(requests[2].body?.tenantAssignmentId).toBe("replacement"); expect(requests[2].body?.operationId).not.toBe(requests[0].body?.operationId);
});

test("export month survives unrelated dashboard renders without repeated reads", async ({ page }) => {
  await mount(page, "dashboard");
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page.getByRole("button", { name: /Exports/ }).click();
  const selects = page.locator("select");
  const month = selects.filter({ has: page.locator('option[value="2026-02"]') });
  await expect(month).toHaveCount(1); await month.selectOption("2026-02");
  await selects.filter({ has: page.locator('option[value="ledger"]') }).selectOption("ledger");
  await expect(month).toHaveValue("2026-02");
  expect((await page.evaluate(() => window.rfClientTest.requests)).filter(row => row.url === "/api/manager/dashboard")).toHaveLength(1);
});

test("context synchronization ignores a late prior-property response and retains current notes without refetch loops", async ({ page }) => {
  await mount(page, "queue");
  const first = "/api/manager/maintenance?propertyId=a", second = "/api/manager/maintenance?propertyId=b";
  await expect.poll(() => page.evaluate(url => !!window.rfClientTest.replies[url], first)).toBe(true);
  await page.evaluate(() => { history.pushState({}, "", "?property=b"); dispatchEvent(new PopStateEvent("popstate")); });
  await expect.poll(() => page.evaluate(url => !!window.rfClientTest.replies[url], second)).toBe(true);
  const row = { id: "b", propertyId: "b", propertyName: "Current B", unitId: "u", unitNumber: "2", category: "PLUMBING", urgency: "NORMAL", status: "OPEN", description: "Current B request", internalNotes: "Current notes", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
  await page.evaluate(({ url, row }) => window.rfClientTest.replies[url]({ ok: true, requests: [row] }), { url: second, row });
  await expect(page.getByText("Current B request", { exact: true })).toBeVisible();
  await page.evaluate(({ url, row }) => window.rfClientTest.replies[url]({ ok: true, requests: [{ ...row, id: "a", propertyId: "a", description: "Stale A request", internalNotes: "Stale notes" }] }), { url: first, row });
  await page.waitForTimeout(100); await expect(page.getByText("Stale A request")).toHaveCount(0);
  await page.getByRole("textbox").fill("Edited current notes");
  await expect(page.getByRole("textbox")).toHaveValue("Edited current notes");
  expect((await page.evaluate(() => window.rfClientTest.requests)).filter(record => record.url.startsWith("/api/manager/maintenance?"))).toHaveLength(2);
});

test("session navigation replaces the document and discards old identity memory", async ({ page }) => {
  await mount(page, "navigation");
  await page.getByRole("button", { name: "Enter dashboard" }).click();
  await expect(page).toHaveURL("https://preview.invalid/manager/dashboard?code=01234");
  expect(await page.evaluate(() => window.rfSessionMarker)).toBeUndefined();
});

 test("unauthorized render leaves through one full-document navigation", async ({ page }) => {
  await mount(page, "redirect");
  await expect(page).toHaveURL("https://preview.invalid/login/manager");
  expect(await page.evaluate(() => window.rfSessionMarker)).toBeUndefined();
 });
