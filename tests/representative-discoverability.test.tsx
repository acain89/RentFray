import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { stage2Load } from "./representative-stage2-fixture";
import type * as Email from "../lib/representativeEmail";
import type * as Auth from "../lib/representativeAuth";

const loginUrl = "https://www.rentfray.com/login/representative";
function footerMarkup() {
  const Footer = stage2Load<{ default: React.ComponentType }>("components/marketing/MarketingFooter.tsx", {
    "react/jsx-runtime": jsx,
    "next/navigation": { useRouter: () => ({ push() { throw new Error("Unexpected navigation"); } }) },
    "./BrandMark": () => React.createElement("span", null, "RentFray"),
  }).default;
  return renderToStaticMarkup(React.createElement(Footer));
}

test("public footer exposes one accessible permanent representative login link", () => {
  assert.equal(footerMarkup().split(`href="${loginUrl}"`).length, 2);
  assert.ok(footerMarkup().includes(`href="${loginUrl}">Representative Login</a>`));
});

for (const width of [320, 375, 390, 768, 1440]) {
  test(`public footer login is visible and contained at ${width}px`, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route("**/*", route => route.abort());
      await page.setContent(`<style>body { margin: 0; }${readFileSync("app/marketing.css", "utf8")}</style><main class="rfm-home">${footerMarkup()}</main>`);
      const link = page.getByRole("link", { name: "Representative Login", exact: true });
      assert.equal(await link.getAttribute("href"), loginUrl);
      assert.ok(await link.isVisible());
      const box = await link.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await link.focus();
      assert.ok(await link.evaluate(element => element === document.activeElement));
    } finally { await browser.close(); }
  });
}

for (const flow of ["account setup", "password recovery"]) {
  test(`${flow} email separates permanent login from the temporary secret link`, async () => {
    let delivered: Record<string, unknown> = {};
    const helper = stage2Load<typeof Email>("lib/representativeEmail.ts", {
      "@/lib/resend": { EMAIL_FROM: "test@example.invalid", resend: { emails: { send: async (message: Record<string, unknown>) => {
        delivered = message; return {};
      } } } },
    });
    // Both production entry points use this same helper.
    const entry = readFileSync(flow === "account setup" ? "lib/representativeAdmin.ts" : "app/api/representative/password-recovery/request/route.ts", "utf8");
    assert.match(entry, /sendRepresentativeRecoveryEmail\(issued\)/);
    const token = "a".repeat(64);
    await helper.sendRepresentativeRecoveryEmail({ email: "test@example.invalid", token });
    const text = String(delivered.text);
    const urls = text.match(/https:\/\/[^\s]+/g)!.map(url => new URL(url.replace(/\.$/, "")));
    assert.equal(urls.length, 2);
    assert.equal(urls[0].href, `${loginUrl}/reset-password#token=${token}`);
    assert.equal(urls[1].href, loginUrl);
    assert.equal(urls[1].search, ""); assert.equal(urls[1].hash, "");
    assert.equal(text.split(token).length, 2);
    assert.match(text, /expires in 30 minutes and can be used once/);
    assert.match(text, /Only the latest link works/);
    assert.equal(delivered.from, "test@example.invalid");
  });
}

test("recovery retains thirty-minute expiry, latest-token-only redemption and single use", async () => {
  let now = new Date("2026-10-27T12:00:00Z");
  const row = { id: "representative", email: "test@example.invalid", loginEnabled: true, sessionVersion: 0,
    passwordHash: null as string | null, resetTokenHash: null as string | null,
    resetTokenExpiresAt: null as Date | null, resetTokenSessionVersion: null as number | null };
  type Update = Partial<Pick<typeof row, "passwordHash" | "resetTokenHash" | "resetTokenExpiresAt" | "resetTokenSessionVersion">> & { sessionVersion?: { increment: number } };
  const representative = {
    findUnique: async ({ where }: { where: { resetTokenHash?: string } }) =>
      where.resetTokenHash && where.resetTokenHash !== row.resetTokenHash ? null : row,
    update: async ({ data: { sessionVersion, ...data } }: { data: Update }) => {
      Object.assign(row, data); row.sessionVersion += sessionVersion?.increment ?? 0; return row;
    },
  };
  const tx = { representative, $queryRaw: async (strings: TemplateStringsArray) =>
    strings.join("").includes("clock_timestamp") ? [{ now }] : [{ id: row.id }] };
  const db = { ...tx, $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  const auth = stage2Load<typeof Auth>("lib/representativeAuth.ts", {
    "@/lib/prisma": { prisma: db }, "@/lib/representativeSession": {},
  });
  const first = await auth.issueRepresentativeRecovery(row.email);
  const second = await auth.issueRepresentativeRecovery(row.email);
  assert.ok(first && second);
  assert.notEqual(row.resetTokenHash, second.token);
  assert.equal(row.resetTokenExpiresAt!.getTime(), now.getTime() + 30 * 60 * 1000);
  assert.equal(await auth.redeemRepresentativeRecovery(first.token, "safe-password"), false);
  now = new Date(row.resetTokenExpiresAt!);
  assert.equal(await auth.redeemRepresentativeRecovery(second.token, "safe-password"), false);
  const fresh = await auth.issueRepresentativeRecovery(row.email); assert.ok(fresh);
  assert.equal(await auth.redeemRepresentativeRecovery(fresh.token, "safe-password"), true);
  assert.equal(await auth.redeemRepresentativeRecovery(fresh.token, "safe-password"), false);
  assert.equal(row.resetTokenHash, null); assert.equal(row.sessionVersion, 1);
  assert.match(row.passwordHash!, /^\$2[aby]\$12\$/);
});
