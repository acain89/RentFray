import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { Prisma } from "@prisma/client";
import { representativeAgreementDates, representativeExpiration } from "../lib/representativeCalendar";
import { loadRepresentativeModule, referrals } from "./representative-fixture";

// Opt in with an explicit independently prepared fixture, never DATABASE_URL or .env.
const fixturePath = process.env.REPRESENTATIVE_STAGE1_TEST_FIXTURE;

test("isolated PostgreSQL representative foundation and signup", { skip: !fixturePath }, async t => {
  const fixture = JSON.parse(readFileSync(fixturePath!, "utf8")) as { root: string; url: string };
  const fixtureRoot = realpathSync(fixture.root).replaceAll("\\", "/");
  assert.match(fixtureRoot, /\/rentfray-representative-stage1-[a-f0-9]{32}$/);
  assert.equal(resolve(fixturePath!), resolve(fixture.root, "fixture.json"));
  const url = new URL(fixture.url);
  assert.equal(url.protocol, "postgresql:"); assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55447"); assert.equal(url.username, "representative_stage1");
  assert.equal(url.pathname, "/rentfray_representative_stage1_verified");
  const runtime = createRequire(__filename)(join(fixture.root, "generated-client")) as typeof import("@prisma/client");
  const db = new runtime.PrismaClient({ datasources: { db: { url: fixture.url } }, log: [] });
  const runId = randomUUID();
  try {
    const identity = await db.$queryRaw<{ directory: string; database: string; username: string; port: number }[]>`
      SELECT current_setting('data_directory') AS directory, current_database() AS database,
        current_user AS username, inet_server_port() AS port`;
    assert.equal(realpathSync(identity[0].directory).replaceAll("\\", "/"), fixtureRoot + "/data");
    assert.equal(identity[0].database, url.pathname.slice(1)); assert.equal(identity[0].username, url.username);
    assert.equal(identity[0].port, Number(url.port));

    const representative = await db.representative.create({ data: {
      email: `stage1-${runId}@example.invalid`, displayName: "Isolated representative",
      slug: `rep-${runId}`, createdAt: new Date("2020-01-01"), loginEnabled: false,
    } });
    const captured = (date: Date, representativeId = representative.id) => referrals.readRepresentativeReferral(
      referrals.signRepresentativeReferral(representativeId, date), date)!;
    const property = (createdAt: Date) => db.property.create({ data: {
      propertyCode: `isolated-${randomUUID()}`, name: "Isolated business", createdAt,
    } });
    const effectiveAt = new Date("2024-01-01T06:00:00Z");
    const agreement = await db.representativeAgreement.create({ data: {
      representativeId: representative.id, ...representativeAgreementDates(effectiveAt),
      approvedAt: new Date("2023-12-01"), approvedByAdminId: "isolated-admin",
    } });

    await t.test("confirmed RentFray uses approved agreement and original business timestamp", async () => {
      const p = await property(new Date("2026-12-31T06:00:00Z"));
      await db.$transaction(tx => referrals.attributeRepresentative(tx, captured(p.createdAt), p, "RENTFRAY"));
      const row = await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: p.id } });
      assert.equal(row.authorizingAgreementId, agreement.id); assert.equal(row.productScope, "RENTFRAY");
      assert.equal(row.businessCreatedAt.getTime(), p.createdAt.getTime());
      assert.equal(row.businessExpiresAt.getTime(), representativeExpiration(p.createdAt).getTime());
      assert.ok(row.businessExpiresAt > agreement.expiresAt);
    });

    await t.test("agreement interval includes effective instant and excludes expiration instant", async () => {
      for (const [date, eligible] of [[agreement.effectiveAt, true], [agreement.expiresAt, false],
        [new Date(agreement.effectiveAt.getTime() - 1), false], [new Date(agreement.expiresAt.getTime() - 1), true]] as const) {
        const p = await property(date);
        await db.$transaction(tx => referrals.attributeRepresentative(tx, captured(date), p, "RENTFRAY"));
        const row = await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: p.id } });
        assert.equal(row.authorizingAgreementId, eligible ? agreement.id : null);
      }
    });

    await t.test("approval after business creation cannot authorize it automatically", async () => {
      const p = await property(new Date("2030-01-01T06:00:00Z"));
      await db.representativeAgreement.create({ data: { representativeId: representative.id,
        ...representativeAgreementDates(p.createdAt), approvedAt: new Date(p.createdAt.getTime() + 1), approvedByAdminId: "isolated-admin" } });
      await db.$transaction(tx => referrals.attributeRepresentative(tx, captured(p.createdAt), p, "RENTFRAY"));
      assert.equal((await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: p.id } })).authorizingAgreementId, null);
    });

    await t.test("overlapping agreement ambiguity remains tracking-only", async () => {
      const second = await db.representativeAgreement.create({ data: { representativeId: representative.id,
        ...representativeAgreementDates(new Date("2025-01-01")), approvedAt: new Date("2024-01-01"), approvedByAdminId: "isolated-admin" } });
      const p = await property(new Date("2026-01-01"));
      await db.$transaction(tx => referrals.attributeRepresentative(tx, captured(p.createdAt), p, "RENTFRAY"));
      assert.equal((await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: p.id } })).authorizingAgreementId, null);
      await db.representativeAgreement.delete({ where: { id: second.id } });
    });

    await t.test("UNKNOWN is tracking-only and Lite creates no attribution", async () => {
      const p = await property(new Date("2026-01-01"));
      assert.equal(await db.$transaction(tx => referrals.attributeRepresentative(tx, captured(p.createdAt), p)), true);
      const row = await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: p.id } });
      assert.equal(row.productScope, "UNKNOWN"); assert.equal(row.authorizingAgreementId, null);
      const lite = await property(p.createdAt);
      assert.equal(await db.$transaction(tx => referrals.attributeRepresentative(tx, captured(lite.createdAt), lite, "LITE")), false);
      assert.equal(await db.representativeReferral.count({ where: { propertyId: lite.id } }), 0);
    });

    await t.test("concurrent duplicate business attribution inserts exactly one row", async () => {
      const p = await property(new Date("2026-01-01"));
      const results = await Promise.allSettled([1, 2].map(() => db.$transaction(tx =>
        referrals.attributeRepresentative(tx, captured(p.createdAt), p, "RENTFRAY"))));
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(await db.representativeReferral.count({ where: { propertyId: p.id } }), 1);
    });

    await t.test("composite foreign key rejects another representative's agreement", async () => {
      const other = await db.representative.create({ data: { email: `other-${runId}@example.invalid`, displayName: "Other", slug: `other-${runId}` } });
      const p = await property(new Date("2026-01-01"));
      await assert.rejects(db.representativeReferral.create({ data: {
        representativeId: other.id, propertyId: p.id, businessNameSnapshot: p.name,
        businessCreatedAt: p.createdAt, capturedAt: p.createdAt, attributedAt: p.createdAt,
        businessExpiresAt: representativeExpiration(p.createdAt), productScope: "RENTFRAY", authorizingAgreementId: agreement.id,
      } }), (error: unknown) => (error as { code: string }).code === "P2003");
    });

    await t.test("database rejects malformed identities, dates, scopes and payout records", async () => {
      for (const patch of [{ email: " UPPER@example.invalid" }, { slug: "portal" }, { sessionVersion: -1 }, { resetTokenHash: "a".repeat(64) }]) {
        await assert.rejects(db.representative.create({ data: {
          email: `bad-${randomUUID()}@example.invalid`, displayName: "Bad fixture", slug: `bad-${randomUUID()}`, ...patch,
        } }));
      }
      await assert.rejects(db.representativeAgreement.create({ data: { representativeId: representative.id,
        effectiveAt, expiresAt: effectiveAt, approvedAt: effectiveAt, approvedByAdminId: "isolated-admin" } }));
      const p = await property(new Date("2026-01-01"));
      const data = { representativeId: representative.id, propertyId: p.id, businessNameSnapshot: p.name,
        businessCreatedAt: p.createdAt, capturedAt: p.createdAt, attributedAt: p.createdAt,
        businessExpiresAt: representativeExpiration(p.createdAt), productScope: "UNKNOWN" };
      for (const patch of [{ productScope: "LITE" }, { authorizingAgreementId: agreement.id }, { businessExpiresAt: p.createdAt },
        { capturedAt: new Date(p.createdAt.getTime() + 1) }]) await assert.rejects(db.representativeReferral.create({ data: { ...data, ...patch } }));
      const payout = { representativeId: representative.id, amountCents: 0, paidAt: new Date("2026-01-01"),
        recordedByAdminId: "isolated-admin", reportingMonth: "2026-01", operationKey: runId, externalPayoutReference: runId };
      await assert.rejects(db.representativePayout.create({ data: payout }));
      await assert.rejects(db.representativePayout.create({ data: { ...payout, amountCents: 250, reportingMonth: "2026-13" } }));
    });

    await t.test("deleting a property retains its representative snapshot", async () => {
      const p = await property(new Date("2026-01-01"));
      await db.$transaction(tx => referrals.attributeRepresentative(tx, captured(p.createdAt), p));
      await db.property.delete({ where: { id: p.id } });
      const row = await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: p.id } });
      assert.equal(row.businessNameSnapshot, p.name); assert.equal(row.businessCreatedAt.getTime(), p.createdAt.getTime());
      await assert.rejects(db.representative.delete({ where: { id: representative.id } }));
    });

    type Reply = { status: number; body: { propertyId: string }; cleared: string[] };
    const creator = loadRepresentativeModule<{
      signReferral(id: string, now?: Date): string;
      attributeCreator(tx: Prisma.TransactionClient, cookie: string | undefined, p: { id: string; name: string }): Promise<boolean>;
      REFERRAL_COOKIE: string; referralCookieOptions: unknown;
    }>("lib/creatorReferrals.ts", {});
    const route = (cookie: string | undefined, creatorCookie?: string, failAttribution = false) => {
      const scopedDb = { $transaction: (work: (tx: Prisma.TransactionClient) => Promise<unknown>, settings: object) =>
        db.$transaction(tx => work(failAttribution ? new Proxy(tx, { get(target, key) {
          if (key === "representativeReferral") return { create: async () => { await target.$executeRaw`SELECT 1 / 0`; } };
          return Reflect.get(target, key);
        } }) : tx), settings) };
      return loadRepresentativeModule<{ POST(req: unknown): Promise<Reply> }>("app/api/setup/create-account/route.ts", {
        "next/server": { NextResponse: { json: (body: Reply["body"], options?: { status?: number }) => {
          const result = { status: options?.status ?? 200, body, cleared: [] as string[], cookies: { set(name: string) { result.cleared.push(name); } } }; return result;
        } } },
        "next/headers": { cookies: async () => ({ get: (name: string) => {
          const value = name === referrals.REPRESENTATIVE_COOKIE ? cookie : name === creator.REFERRAL_COOKIE ? creatorCookie : undefined;
          return value ? { value } : undefined;
        } }) },
        "@prisma/client": { Prisma: runtime.Prisma }, "@/lib/prisma": { prisma: scopedDb },
        "bcryptjs": { hash: async (_password: string, cost: number) => { assert.equal(cost, 12); return "isolated-owner-hash"; } },
        "@/lib/creatorReferrals": creator, "@/lib/representativeReferrals": referrals,
        "@/lib/email": { sendVerificationEmail: async ({ managementUserId }: { managementUserId: string }) => {
          assert.equal(await db.managementUser.count({ where: { id: managementUserId } }), 1, "email only after commit");
        } },
      });
    };
    const submit = (handler: ReturnType<typeof route>, email: string, overrides: Record<string, unknown> = {}) => handler.POST({ json: async () => ({
      firstName: "Isolated", lastName: "Owner", email, password: "isolated-password", representativeId: "client-forged", productScope: "RENTFRAY",
      ...overrides,
    }) });

    await t.test("real signup atomically preserves creator/representative coexistence and clears after commit", async () => {
      const now = new Date();
      const c = await db.creator.create({ data: { name: "Isolated creator", slug: `creator-${runId}`, startsAt: new Date("2020-01-01"), expiresAt: new Date("2021-01-01") } });
      const result = await submit(route(referrals.signRepresentativeReferral(representative.id, now), creator.signReferral(c.id, now)), `coexist-${runId}@example.invalid`);
      assert.equal(result.status, 200);
      const p = await db.property.findUniqueOrThrow({ where: { id: result.body.propertyId } });
      const ref = await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: p.id } });
      assert.equal(ref.representativeId, representative.id); assert.equal(ref.businessCreatedAt.getTime(), p.createdAt.getTime());
      assert.equal(ref.productScope, "RENTFRAY"); assert.equal(ref.authorizingAgreementId, agreement.id);
      assert.equal((await db.creatorReferral.findUniqueOrThrow({ where: { propertyId: p.id } })).creatorId, c.id);
      assert.equal(await db.managementUser.count({ where: { propertyId: p.id } }), 1);
      assert.equal(await db.propertySettings.count({ where: { propertyId: p.id } }), 1);
      assert.equal(await db.paymentConnectionStatus.count({ where: { propertyId: p.id } }), 1);
      assert.deepEqual(result.cleared.sort(), [creator.REFERRAL_COOKIE, referrals.REPRESENTATIVE_COOKIE].sort());
    });

    for (const kind of ["approved", "expired", "none", "future-effective", "future-approval"] as const) {
      await t.test("public signup fixes RENTFRAY scope despite client product values; agreement=" + kind, async () => {
        const now = new Date();
        const rep = await db.representative.create({ data: {
          email: `${kind}-${runId}@example.invalid`, displayName: "Classification fixture",
          slug: `scope-${randomUUID()}`, createdAt: new Date("2020-01-01"),
        } });
        const effectiveAt = kind === "expired" ? new Date("2020-01-01") :
          new Date(now.getTime() + (kind === "future-effective" ? 86400000 : -86400000));
        const applicable = kind === "none" ? null : await db.representativeAgreement.create({ data: {
          representativeId: rep.id, ...representativeAgreementDates(effectiveAt),
          approvedAt: new Date(now.getTime() + (kind === "future-approval" ? 86400000 : -86400000)),
          approvedByAdminId: "isolated-admin",
        } });
        for (const productScope of ["LITE", "UNKNOWN", "RENTFRAY", "arbitrary"]) {
          const result = await submit(route(referrals.signRepresentativeReferral(rep.id)),
            `${kind}-${productScope.toLowerCase()}-${runId}@example.invalid`,
            { productScope, product: "RentFrayLite", productId: "lite", productType: "LITE", isLite: true });
          assert.equal(result.status, 200);
          const ref = await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: result.body.propertyId } });
          assert.equal(ref.productScope, "RENTFRAY"); assert.equal(ref.representativeId, rep.id);
          assert.equal(ref.authorizingAgreementId, kind === "approved" ? applicable!.id : null);
          const p = await db.property.findUniqueOrThrow({ where: { id: result.body.propertyId } });
          assert.equal(ref.businessCreatedAt.getTime(), p.createdAt.getTime());
          assert.equal(ref.businessExpiresAt.getTime(), representativeExpiration(p.createdAt).getTime());
        }
      });
    }

    await t.test("new public signups never backfill existing UNKNOWN referrals", async () => {
      const unknownBefore = await db.representativeReferral.findMany({ where: { productScope: "UNKNOWN" }, orderBy: { id: "asc" } });
      assert.ok(unknownBefore.length > 0);
      const result = await submit(route(referrals.signRepresentativeReferral(representative.id)), `preserve-unknown-${runId}@example.invalid`);
      assert.equal(result.status, 200);
      assert.equal((await db.representativeReferral.findUniqueOrThrow({ where: { propertyId: result.body.propertyId } })).productScope, "RENTFRAY");
      assert.deepEqual(await db.representativeReferral.findMany({ where: { productScope: "UNKNOWN" }, orderBy: { id: "asc" } }), unknownBefore);
    });

    await t.test("invalid/missing/expired/unknown cookies preserve legitimate signup", async () => {
      const now = new Date();
      const values = [undefined, "tampered", referrals.signRepresentativeReferral(representative.id, new Date(now.getTime() - 90 * 86400000)), referrals.signRepresentativeReferral("missing", now)];
      for (const [index, value] of values.entries()) {
        const result = await submit(route(value), `unattributed-${index}-${runId}@example.invalid`);
        assert.equal(result.status, 200); assert.deepEqual(result.cleared, []);
        assert.equal(await db.representativeReferral.count({ where: { propertyId: result.body.propertyId } }), 0);
      }
    });

    await t.test("concurrent same-email registrations create one complete account and one attribution", async () => {
      const handler = route(referrals.signRepresentativeReferral(representative.id));
      const email = `concurrent-${runId}@example.invalid`;
      const results = await Promise.all([submit(handler, email), submit(handler, email.toUpperCase())]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      const owner = await db.managementUser.findFirstOrThrow({ where: { email } });
      assert.equal(await db.managementUser.count({ where: { email } }), 1);
      assert.equal(await db.representativeReferral.count({ where: { propertyId: owner.propertyId } }), 1);
      assert.deepEqual(results.find(result => result.status === 409)!.cleared, []);
    });

    await t.test("real attribution SQL failure rolls back account, creator referral and settings", async () => {
      const counts = await Promise.all([db.property.count(), db.managementUser.count(), db.creatorReferral.count(),
        db.representativeReferral.count(), db.propertySettings.count(), db.paymentConnectionStatus.count()]);
      const c = await db.creator.findFirstOrThrow();
      const result = await submit(route(referrals.signRepresentativeReferral(representative.id), creator.signReferral(c.id), true), `rollback-${runId}@example.invalid`);
      assert.equal(result.status, 500); assert.deepEqual(result.cleared, []);
      assert.deepEqual(await Promise.all([db.property.count(), db.managementUser.count(), db.creatorReferral.count(),
        db.representativeReferral.count(), db.propertySettings.count(), db.paymentConnectionStatus.count()]), counts);
    });

    await t.test("original financial and creator sentinel rows remain unchanged", async () => {
      const expected = JSON.parse(readFileSync(join(fixture.root, "sentinel-before.json"), "utf8")) as Record<string, string>;
      for (const table of ["Property", "Unit", "Payment", "LedgerEntry", "Creator", "CreatorReferral"] as const) {
        // Table name comes only from the fixed test allowlist; ID is parameterized.
        const rows = await db.$queryRawUnsafe<{ json: string }[]>(`SELECT row_to_json(t)::text AS json FROM "${table}" t WHERE "id" = $1`,
          { Property: "stage1-sentinel-property", Unit: "stage1-sentinel-unit", Payment: "stage1-sentinel-payment",
            LedgerEntry: "stage1-sentinel-ledger", Creator: "stage1-sentinel-creator", CreatorReferral: "stage1-sentinel-creator-referral" }[table]);
        assert.equal(rows[0].json, expected[table]);
      }
    });
  } finally { await db.$disconnect(); }
});

