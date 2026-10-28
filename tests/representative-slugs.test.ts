import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { stage3Fixture } from "./representative-stage3-fixture";
import { loadRepresentativeModule, referrals } from "./representative-fixture";
import { representativeAgreementDates, representativeExpiration } from "../lib/representativeCalendar";

test("name slugs normalize accents, punctuation, agencies and long names", () => {
  const { admin } = stage3Fixture({});
  for (const [name, expected] of [[" Andrew Cain ", "andrew-cain"], ["JOHN SMITH", "john-smith"],
    ["José Núñez", "jose-nunez"], ["Oak & Pine Agency, LLC", "oak-pine-agency-llc"],
    ["Anne-Marie Smith", "anne-marie-smith"]]) assert.equal(admin.representativeNameSlug(name), expected);
  assert.equal(admin.representativeNameSlug("a".repeat(120)).length, 48);
  for (const name of ["", "!!!", "李", "a", "123 Agency"]) assert.throws(() => admin.representativeNameSlug(name));
});

test("schema change is exactly the alias model and inverse relation", () => {
  const before = execFileSync("git", ["show", "4cc2d57149eff5e0b53212ad98ab197d2fd7a04f:prisma/schema.prisma"], { encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
  const current = readFileSync("prisma/schema.prisma", "utf8").replace(/\r\n/g, "\n");
  assert.equal(current.replace("  referralAliases          RepresentativeReferralAlias[]\n", "")
    .replace(/\nmodel RepresentativeReferralAlias \{[\s\S]*?\n\}\n/, ""), before);
  const sql = readFileSync("prisma/migrations/20261028010000_add_representative_referral_aliases/migration.sql", "utf8");
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 1);
  assert.doesNotMatch(sql, /(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/i);
  for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) {
    assert.match(statement, /^(?:CREATE TABLE "RepresentativeReferralAlias"|CREATE INDEX "RepresentativeReferralAlias_representativeId_idx" ON "RepresentativeReferralAlias"|ALTER TABLE "RepresentativeReferralAlias")/);
  }
  for (const file of ["lib/representativeReports.ts", "lib/representativeReferrals.ts", "lib/representativeCalendar.ts"]) {
    assert.equal(readFileSync(file, "utf8").replace(/\r\n/g, "\n"), execFileSync("git", ["show", `4cc2d57149eff5e0b53212ad98ab197d2fd7a04f:${file}`], { encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n"));
  }
});

const fixturePath = process.env.REPRESENTATIVE_ALIAS_TEST_FIXTURE;
test("isolated PostgreSQL canonical slugs and permanent aliases", { skip: !fixturePath }, async t => {
  const fixture = JSON.parse(readFileSync(fixturePath!, "utf8")) as { root: string; url: string };
  const root = realpathSync(fixture.root).replaceAll("\\", "/"), target = new URL(fixture.url);
  assert.match(root, /\/rentfray-representative-stage1-[a-f0-9]{32}$/);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55447");
  assert.equal(target.username, "representative_stage1"); assert.equal(target.pathname, "/rentfray_representative_alias_verified");
  const runtime = createRequire(__filename)(join(root, "generated-client")) as typeof import("@prisma/client");
  const db = new runtime.PrismaClient({ datasources: { db: { url: fixture.url } }, log: [{ emit: "event", level: "query" }] });
  const writes: string[] = []; db.$on("query", event => { if (/^\s*(?:INSERT|UPDATE|DELETE)/i.test(event.query)) writes.push(event.query); });
  try {
    const [identity] = await db.$queryRaw<{ directory: string; database: string; username: string }[]>`SELECT current_setting('data_directory') AS directory,current_database() AS database,current_user AS username`;
    assert.equal(realpathSync(identity.directory).replaceAll("\\", "/"), root + "/data");
    assert.equal(identity.database, target.pathname.slice(1)); assert.equal(identity.username, target.username);
    const { admin, reports } = stage3Fixture(db, runtime.Prisma), actor = { adminAccessId: "alias-test-admin" };
    let counter = 0;
    const create = (displayName: string) => admin.createRepresentative(actor, { displayName, email: `alias-${++counter}@example.invalid` });
    await t.test("ordinary names, agencies and duplicate names allocate clean numeric URLs", async () => {
      assert.equal((await create("John Smith")).slug, "john-smith");
      assert.equal((await create("JOHN SMITH")).slug, "john-smith-2");
      assert.equal((await create("José Núñez")).slug, "jose-nunez");
      assert.equal((await create("Oak & Pine Agency, LLC")).slug, "oak-pine-agency-llc");
    });
    await t.test("reserved names cannot occupy protected routes", async () => {
      for (const name of ["Portal", "Admin", "Login", "API", "Setup", "Reset Password"]) {
        assert.equal((await create(name)).slug, name.toLowerCase().replaceAll(" ", "-") + "-2");
      }
    });
    await t.test("case-insensitive canonical uniqueness and lowercase storage are enforced", async () => {
      assert.equal((await create("Case Person")).slug, "case-person");
      assert.equal((await create("CASE PERSON")).slug, "case-person-2");
      await assert.rejects(db.representative.create({ data: { displayName: "Invalid", email: "mixed@example.invalid", slug: "CASE-PERSON" } }));
    });
    await t.test("concurrent equal-name requests allocate contiguous unique numeric suffixes", async () => {
      const rows = await Promise.all(Array.from({ length: 6 }, () => create("Concurrent Person")));
      assert.deepEqual(rows.map(r => r.slug).sort(), ["concurrent-person", ...[2, 3, 4, 5, 6].map(n => `concurrent-person-${n}`)].sort());
    });
    const old = "legacy-person-71ff4e34178f";
    const rep = await db.representative.create({ data: { displayName: "Legacy Person", email: "legacy@example.invalid", slug: old, loginEnabled: false } });
    const clock = new Date("2026-01-01T06:00:00Z");
    const agreement = await db.representativeAgreement.create({ data: { representativeId: rep.id, ...representativeAgreementDates(clock), approvedAt: clock, approvedByAdminId: actor.adminAccessId } });
    await db.representativeReferral.create({ data: { representativeId: rep.id, propertyId: "retained-property", businessNameSnapshot: "Retained business", capturedAt: clock,
      attributedAt: clock, businessCreatedAt: clock, businessExpiresAt: representativeExpiration(clock), productScope: "RENTFRAY", authorizingAgreementId: agreement.id } });
    await db.representativePayout.create({ data: { representativeId: rep.id, amountCents: 12300, paidAt: clock, recordedAt: clock, recordedByAdminId: actor.adminAccessId,
      reportingMonth: "2026-01", operationKey: "alias-test-operation", externalPayoutReference: "alias-test-external" } });
    const snapshot = async () => JSON.stringify({ agreements: await db.representativeAgreement.findMany({ where: { representativeId: rep.id } }),
      referrals: await db.representativeReferral.findMany({ where: { representativeId: rep.id } }), payouts: await db.representativePayout.findMany({ where: { representativeId: rep.id } }) });
    const before = await snapshot();
    const token = referrals.signRepresentativeReferral(rep.id);
    await t.test("shortening is atomic and concurrent retries preserve all representative financial history", async () => {
      const rows = await Promise.all([admin.shortenRepresentativeReferralSlug(actor, rep.id), admin.shortenRepresentativeReferralSlug(actor, rep.id)]);
      assert.ok(rows.every(row => row.id === rep.id && row.slug === "legacy-person"));
      assert.equal(await snapshot(), before);
      assert.equal(await db.representativeReferralAlias.count({ where: { representativeId: rep.id } }), 1);
      assert.equal((await db.representativeReferralAlias.findUniqueOrThrow({ where: { slug: old } })).representativeId, rep.id);
      assert.equal(await db.auditLog.count({ where: { targetId: rep.id, action: "REPRESENTATIVE_REFERRAL_SLUG_SHORTENED" } }), 1);
      assert.equal(referrals.readRepresentativeReferral(token)?.representativeId, rep.id);
    });
    await t.test("canonical and alias requests retain identity, redirect, disabled-login support and first touch", async () => {
      const captured: string[] = [];
      class Response {
        headers = new Map<string, string>(); destination = "";
        cookies = { set: (_name: string, value: string) => captured.push(value) };
        static redirect(url: URL) { const response = new Response(); response.destination = url.href; return response; }
      }
      const route = loadRepresentativeModule<{ GET(req: unknown, context: unknown): Promise<Response> }>("app/r/[slug]/route.ts", {
        "next/server": { NextResponse: Response }, "@/lib/prisma": { prisma: db }, "@/lib/representativeReferrals": referrals,
      });
      for (const slug of ["legacy-person", old, old.toUpperCase()]) {
        const response = await route.GET({ cookies: { get: () => undefined } }, { params: Promise.resolve({ slug }) });
        assert.equal(response.destination, "https://www.rentfray.com/");
        assert.equal(response.headers.get("Cache-Control"), "private, no-store");
        assert.equal(referrals.readRepresentativeReferral(captured.at(-1))?.representativeId, rep.id);
      }
      const count = captured.length;
      await route.GET({ cookies: { get: () => ({ value: token }) } }, { params: Promise.resolve({ slug: old }) });
      assert.equal(captured.length, count);
      assert.equal(referrals.readRepresentativeReferral(token)?.representativeId, rep.id);
    });
    await t.test("aliases are permanently unavailable to another representative", async () => {
      assert.equal((await create(old.toUpperCase())).slug, old + "-2");
      await assert.rejects(db.representativeReferralAlias.create({ data: { slug: old, representativeId: (await create("Different Person")).id } }));
      await assert.rejects(db.representative.delete({ where: { id: rep.id } }));
    });
    await t.test("failed audit rolls back both the canonical rename and historical alias", async () => {
      const original = await db.representative.create({ data: { email: "rollback@example.invalid", displayName: "Rollback Person", slug: "rollback-person-abcdef123456" } });
      const failingDb = { $transaction: (work: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => work(new Proxy(tx, {
        get(target, key) {
          if (key === "auditLog") return { create: async () => { throw new Error("mock audit failure"); } };
          return Reflect.get(target, key);
        },
      }))) };
      const failing = stage3Fixture(failingDb, runtime.Prisma).admin;
      await assert.rejects(failing.shortenRepresentativeReferralSlug(actor, original.id), /mock audit failure/);
      assert.equal((await db.representative.findUniqueOrThrow({ where: { id: original.id } })).slug, original.slug);
      assert.equal(await db.representativeReferralAlias.count({ where: { representativeId: original.id } }), 0);
    });
    await t.test("dashboard shows the new canonical URL without changing commission or payout totals", async () => {
      const report = await reports.getRepresentativeDashboard(rep.id);
      assert.equal(report.referralUrl, "https://www.rentfray.com/r/legacy-person");
      assert.equal(report.summary.lifetimeCents, 0); assert.equal(report.summary.paidCents, 12300);
      assert.equal(await snapshot(), before);
    });
    await t.test("invalid names and duplicate emails cannot leave partial accounts", async () => {
      const count = await db.representative.count();
      await assert.rejects(create("!!!"));
      await assert.rejects(admin.createRepresentative(actor, { displayName: "Duplicate", email: rep.email }));
      assert.equal(await db.representative.count(), count);
    });
    assert.ok(writes.every(query => !/\b(?:Payment|LedgerEntry|Property|Unit|TenantAssignment)\b/.test(query)));
  } finally { await db.$disconnect(); }
});
