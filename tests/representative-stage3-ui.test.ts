import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

test("representative administration browser verification", { skip: !process.env.REPRESENTATIVE_STAGE3_TEST_FIXTURE }, async t => {
  const bundle = await build({ absWorkingDir: resolve("."), stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Client from './app/admin/representatives/RepresentativeAdminClient'; createRoot(document.getElementById('root')).render(<Client representativeId={window.fixtureId}/>);`, resolveDir: resolve("."), loader: "tsx" },
    bundle: true, write: false, outfile: "preview.js", platform: "browser", define: { "process.env.NODE_ENV": '"production"' }, jsx: "automatic",
    plugins: [{ name: "isolated-link", setup(b) { b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`, loader: "jsx", resolveDir: resolve(".") })); } }] });
  const script = bundle.outputFiles!.find(f => f.path.endsWith(".js"))!.text;
  const css = bundle.outputFiles!.find(f => f.path.endsWith(".css"))!.text;
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--disable-background-networking"] });
  const rep = { id: "rep-a", displayName: "Representative Example", email: "example@example.invalid", slug: "example", loginEnabled: true, createdAt: "2026-01-01T06:00:00Z", referralUrl: "https://www.rentfray.com/r/example" };
  const detail = { representative: rep, activeAgreement: { id: "agreement-a", effectiveAt: "2026-01-01T06:00:00Z", expiresAt: "2029-01-01T06:00:00Z" }, agreements: { items: [{ id: "agreement-a", effectiveAt: "2026-01-01T06:00:00Z", expiresAt: "2029-01-01T06:00:00Z", approvedAt: "2025-12-01T06:00:00Z", agreementReference: "Approved", agreementVersion: "1" }], nextCursor: null },
    businesses: [{ id: "business-a", name: "Sample business", createdAt: "2026-02-01T06:00:00Z", expiresAt: "2029-02-01T06:00:00Z", daysRemaining: 823, activeUnits: 24, currentMonthCents: 500, lifetimeCents: 1500, status: "TRACKING_ONLY", archived: false, productScope: "RENTFRAY", authorizingAgreementId: null, commissionEligibleFrom: null }], payouts: [],
    report: { asOf: "2026-10-27T18:00:00Z", summary: { currentMonthCents: 500, lifetimeCents: 1500, paidCents: 250, outstandingCents: 1250 }, businesses: { nextCursor: null }, payouts: { nextCursor: null }, history: { items: [{ month: "2026-10", payments: 2, commissionCents: 500 }], nextMonthBefore: null } } };
  try {
    for (const width of [1440, 390]) await t.test(`list and detail remain usable at ${width}px with no document overflow`, async () => {
      for (const mode of ["list", "detail"]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        await page.route("**/*", route => route.request().url() === "https://preview.invalid/" ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
        await page.goto("https://preview.invalid/");
        await page.evaluate(({ payload, id }) => { Object.assign(window, { fixtureId: id }); window.fetch = async () => Response.json(payload); }, { payload: mode === "list" ? { items: [rep], nextCursor: null } : detail, id: mode === "list" ? undefined : rep.id });
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: script });
        await page.getByRole("heading", { name: mode === "list" ? "Representative accounts" : "Acquired businesses", exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await page.locator('input[name="email"]').count(), mode === "list" ? 1 : 0);
        if (mode === "detail") { assert.equal(await page.getByRole("button", { name: "Authorize from now" }).isEnabled(), true); assert.ok((await page.textContent("body"))!.includes("$12.50")); }
        const fixture = JSON.parse(readFileSync(process.env.REPRESENTATIVE_STAGE3_TEST_FIXTURE!, "utf8")) as { root: string };
        await page.screenshot({ path: resolve(fixture.root, `admin-${mode}-${width}.png`), fullPage: true });
        await page.close();
      }
    });
    await t.test("payout browser retries retain the same operation key and send decimal strings", async () => {
      const page = await browser.newPage();
      await page.route("**/*", route => route.request().url() === "https://preview.invalid/" ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
      await page.goto("https://preview.invalid/");
      await page.evaluate(({ payload, id }) => { Object.assign(window, { fixtureId: id, payoutBodies: [] }); window.fetch = async (_input, init) => {
        if (init?.method === "POST") { (window as unknown as { payoutBodies: unknown[] }).payoutBodies.push(JSON.parse(String(init.body))); return Response.json({ error: "Retry response" }, { status: 503 }); }
        return Response.json(payload);
      }; }, { payload: detail, id: rep.id });
      await page.addStyleTag({ content: css }); await page.addScriptTag({ content: script });
      await page.getByRole("heading", { name: "Acquired businesses" }).waitFor();
      await page.locator('[name="amountUsd"]').fill("12.50"); await page.locator('[name="paidAt"]').fill("2026-10-26");
      await page.locator('[name="reportingMonth"]').fill("2026-10"); await page.locator('[name="externalPayoutReference"]').fill("completed-example");
      await page.getByRole("button", { name: "Record completed payout", exact: true }).click(); await page.getByRole("alert").waitFor();
      await page.getByRole("button", { name: "Record completed payout", exact: true }).click(); await page.getByRole("alert").waitFor();
      const requests = await page.evaluate(() => (window as unknown as { payoutBodies: { operationKey: string; amountUsd: string }[] }).payoutBodies);
      assert.equal(requests.length, 2); assert.equal(requests[0].operationKey, requests[1].operationKey); assert.equal(requests[0].amountUsd, "12.50");
      await page.close();
    });
  } finally { await browser.close(); }
});
