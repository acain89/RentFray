import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { stage2Load, representativeRequest } from "./representative-stage2-fixture";
import { representativeAgreementDates, representativeExpiration } from "../lib/representativeCalendar";
import type * as Session from "../lib/representativeSession";
import type * as Auth from "../lib/representativeAuth";
import type * as Reports from "../lib/representativeReports";
import type * as Throttle from "../lib/representativeThrottle";

const fixturePath = process.env.REPRESENTATIVE_STAGE2_TEST_FIXTURE;
test("isolated PostgreSQL representative authentication and reporting", { skip: !fixturePath }, async t => {
  const fixture = JSON.parse(readFileSync(fixturePath!, "utf8")) as { root: string; url: string };
  const root = realpathSync(fixture.root).replaceAll("\\", "/"), target = new URL(fixture.url);
  assert.match(root, /\/rentfray-representative-stage1-[a-f0-9]{32}$/);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55447");
  assert.equal(target.username, "representative_stage1"); assert.equal(target.pathname, "/rentfray_representative_stage2_verified");
  const runtime = createRequire(__filename)(join(fixture.root, "generated-client")) as typeof import("@prisma/client");
  const db = new runtime.PrismaClient({ datasources: { db: { url: fixture.url } }, log: [{ emit: "event", level: "query" }] });
  const queries: string[] = []; db.$on("query", event => queries.push(event.query));
  try {
    const [identity] = await db.$queryRaw<{ directory: string; database: string }[]>`SELECT current_setting('data_directory') AS directory, current_database() AS database`;
    assert.equal(realpathSync(identity.directory).replaceAll("\\", "/"), root + "/data"); assert.equal(identity.database, target.pathname.slice(1));
    const mocks = { "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: runtime.Prisma },
      "next/headers": { cookies: async () => ({ get: () => undefined, set() {} }) } };
    const session = stage2Load<typeof Session>("lib/representativeSession.ts", mocks);
    const auth = stage2Load<typeof Auth>("lib/representativeAuth.ts", { ...mocks, "@/lib/representativeSession": session });
    const throttle = stage2Load<typeof Throttle>("lib/representativeThrottle.ts", mocks);
    const reports = stage2Load<typeof Reports>("lib/representativeReports.ts", { ...mocks, "@/lib/representativeReferrals": { REPRESENTATIVE_ORIGIN: "https://www.rentfray.com" } });
    const run = randomUUID(), password = "isolated-representative-password", passwordHash = await bcrypt.hash(password, 12);
    const rep = await db.representative.create({ data: { email: `${run}@example.invalid`, slug: `rep-${run}`, displayName: "Representative A", loginEnabled: true, passwordHash, createdAt: new Date("2020-01-01") } });
    const other = await db.representative.create({ data: { email: `other-${run}@example.invalid`, slug: `other-${run}`, displayName: "PRIVATE_OTHER_REP", loginEnabled: true, passwordHash, createdAt: new Date("2020-01-01") } });
    const agreement = await db.representativeAgreement.create({ data: { representativeId: rep.id, ...representativeAgreementDates(new Date("2022-01-01T06:00:00Z")), approvedAt: new Date("2021-01-01"), approvedByAdminId: "PRIVATE_ADMIN" } });

    await t.test("bcrypt cost-12 login survives expired agreement; disabled and wrong credentials fail", async () => {
      assert.equal(bcrypt.getRounds(passwordHash), 12);
      assert.equal((await auth.authenticateRepresentative(rep.email, password))?.id, rep.id);
      assert.equal(await auth.authenticateRepresentative(rep.email, "incorrect-password"), null);
      await db.representative.update({ where: { id: rep.id }, data: { loginEnabled: false } });
      assert.equal(await auth.authenticateRepresentative(rep.email, password), null);
      await db.representative.update({ where: { id: rep.id }, data: { loginEnabled: true } });
    });
    await t.test("session version revocation and logout invalidate copied sessions", async () => {
      const token = session.createRepresentativeSessionToken(rep.id, 0);
      assert.equal((await session.validateRepresentativeSession(token))?.id, rep.id);
      await auth.revokeRepresentativeSessions({ id: rep.id, displayName: rep.displayName, sessionVersion: 0 });
      assert.equal(await session.validateRepresentativeSession(token), null);
    });
    await t.test("hashed reset is latest-only, single-use, thirty minutes, and revokes prior sessions", async () => {
      const before = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      const token = session.createRepresentativeSessionToken(rep.id, before.sessionVersion);
      const first = await auth.issueRepresentativeRecovery(rep.email);
      const [{ now: beforeIssue }] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
      const second = await auth.issueRepresentativeRecovery(rep.email);
      const [{ now: afterIssue }] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
      assert.ok(first && second && first.token !== second.token);
      const row = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      assert.notEqual(row.resetTokenHash, second.token); assert.equal(row.resetTokenHash?.length, 64);
      assert.ok(row.resetTokenExpiresAt!.getTime() >= beforeIssue.getTime() + 30 * 60000 - 1);
      assert.ok(row.resetTokenExpiresAt!.getTime() <= afterIssue.getTime() + 30 * 60000 + 1);
      assert.equal(await auth.redeemRepresentativeRecovery(first.token, password), false);
      assert.equal(await auth.redeemRepresentativeRecovery(second.token, password), true);
      assert.equal(await auth.redeemRepresentativeRecovery(second.token, password), false);
      assert.equal(await session.validateRepresentativeSession(token), null);
      assert.equal((await db.representative.findUniqueOrThrow({ where: { id: rep.id } })).resetTokenHash, null);
    });
    await t.test("expired and version-stale recovery links fail without updating credentials", async () => {
      const expired = await auth.issueRepresentativeRecovery(rep.email); assert.ok(expired);
      await db.representative.update({ where: { id: rep.id }, data: { resetTokenExpiresAt: new Date(0) } });
      assert.equal(await auth.redeemRepresentativeRecovery(expired.token, password), false);
      const stale = await auth.issueRepresentativeRecovery(rep.email); assert.ok(stale);
      await db.representative.update({ where: { id: rep.id }, data: { sessionVersion: { increment: 1 } } });
      assert.equal(await auth.redeemRepresentativeRecovery(stale.token, password), false);
      assert.equal(await auth.issueRepresentativeRecovery(`unknown-${run}@example.invalid`), null);
    });
    await t.test("concurrent reset redemption permits one update only", async () => {
      const issued = await auth.issueRepresentativeRecovery(rep.email); assert.ok(issued);
      const before = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      const results = await Promise.all([auth.redeemRepresentativeRecovery(issued.token, password), auth.redeemRepresentativeRecovery(issued.token, password)]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal((await db.representative.findUniqueOrThrow({ where: { id: rep.id } })).sessionVersion, before.sessionVersion + 1);
    });
    await t.test("durable throttle shares exact limits across independent module callers", async () => {
      const second = stage2Load<typeof Throttle>("lib/representativeThrottle.ts", mocks);
      const results = await Promise.all(Array.from({ length: 15 }, (_, index) => (index % 2 ? second : throttle).admitRepresentativeAuth("login", `limit-${run}`)));
      assert.equal(results.filter(result => result.admitted).length, 10);
      assert.equal((await throttle.admitRepresentativeAuth("login", `another-${run}`)).admitted, true);
      const recovery = await Promise.all(Array.from({ length: 7 }, () => throttle.admitRepresentativeAuth("request", `recovery-${run}`)));
      assert.equal(recovery.filter(result => result.admitted).length, 5);
    });
    await t.test("global throttle fails closed and representative cleanup preserves other roles", async () => {
      await db.authThrottleBucket.upsert({ where: { key: "admin:stage2-sentinel" }, update: {}, create: { key: "admin:stage2-sentinel", attemptCount: 77, windowExpiresAt: new Date(0) } });
      const before = await db.authThrottleBucket.findUniqueOrThrow({ where: { key: "representative:login:global" } });
      await db.authThrottleBucket.update({ where: { key: before.key }, data: { attemptCount: 200, windowExpiresAt: new Date(Date.now() + 60000) } });
      assert.equal((await throttle.admitRepresentativeAuth("login", `blocked-${run}`)).admitted, false);
      await db.authThrottleBucket.update({ where: { key: before.key }, data: { attemptCount: before.attemptCount, windowExpiresAt: before.windowExpiresAt } });
      await throttle.admitRepresentativeAuth("request", `cleanup-${run}`);
      assert.equal((await db.authThrottleBucket.findUniqueOrThrow({ where: { key: "admin:stage2-sentinel" } })).attemptCount, 77);
    });

    const now = new Date("2026-10-15T12:00:00Z");
    const businessStart = new Date("2024-10-01T05:00:00Z");
    const p = await db.property.create({ data: { name: "Acquired business", propertyCode: `stage2-${run}`, createdAt: businessStart,
      contactEmail: "PRIVATE_OWNER@example.invalid", contactPhone: "PRIVATE_OWNER_PHONE", stripeAccountId: "acct_PRIVATE" } });
    const unit = await db.unit.create({ data: { propertyId: p.id, unitNumber: "PRIVATE_UNIT", portalFirstName: "PRIVATE_TENANT", tenantPinHash: "PRIVATE_PIN" } });
    await db.unit.create({ data: { propertyId: p.id, unitNumber: "2", isActive: true } });
    await db.unit.create({ data: { propertyId: p.id, unitNumber: "3", isActive: false } });
    const tenant = await db.tenantAssignment.create({ data: { propertyId: p.id, unitId: unit.id, firstName: "PRIVATE_TENANT", email: "PRIVATE_TENANT@example.invalid", phone: "PRIVATE_PHONE" } });
    const referral = await db.representativeReferral.create({ data: { representativeId: rep.id, propertyId: p.id, businessNameSnapshot: p.name,
      businessCreatedAt: businessStart, capturedAt: businessStart, attributedAt: businessStart, businessExpiresAt: representativeExpiration(businessStart),
      productScope: "RENTFRAY", authorizingAgreementId: agreement.id } });
    async function payment(paidAt: Date | null, patch: Partial<import("@prisma/client").Prisma.PaymentUncheckedCreateInput> = {}, collection = true) {
      const id = randomUUID().replaceAll("-", "");
      const row = await db.payment.create({ data: { propertyId: p.id, unitId: unit.id, tenantAssignmentId: tenant.id, amountCents: 10000,
        status: "PAID", paymentMethod: "ACH", paidAt, stripePaymentIntentId: `pi_${id}`, ...patch } });
      if (collection) await db.ledgerEntry.create({ data: { propertyId: row.propertyId, unitId: row.unitId, tenantAssignmentId: row.tenantAssignmentId,
        paymentId: row.id, entryType: "PAYMENT", amountCents: -(row.amountCents + (row.processingFeeCents ?? 0)),
        referenceNumber: row.stripePaymentIntentId, effectiveDate: paidAt ?? now } });
      return row;
    }
    await payment(businessStart); await payment(new Date("2026-10-01T04:59:59.999Z"));
    await payment(new Date("2026-10-01T05:00:00Z")); const currentPayment = await payment(new Date("2026-10-10T12:00:00Z"));
    for (const status of ["UNPAID", "PENDING", "FAILED", "REVERSED"] as const) await payment(now, { status });
    await payment(null); await payment(now, { amountCents: 0 }); await payment(now, { paymentMethod: "CASH" });
    await payment(now, { stripePaymentIntentId: null }); await payment(now, {}, false);
    const partial = await payment(now);
    await db.ledgerEntry.create({ data: { propertyId: p.id, unitId: unit.id, tenantAssignmentId: tenant.id, paymentId: partial.id,
      entryType: "ADJUSTMENT", amountCents: 100, referenceNumber: `${partial.stripePaymentIntentId}:returned-principal`, effectiveDate: now } });
    await payment(new Date(businessStart.getTime() - 1)); await payment(referral.businessExpiresAt);
    const lastEligible = await payment(new Date(referral.businessExpiresAt.getTime() - 1));

    // A separate portfolio must never affect the authenticated representative.
    const foreignProperty = await db.property.create({ data: { name: "PRIVATE_OTHER_BUSINESS", propertyCode: `other-${run}`, createdAt: businessStart } });
    const foreignAgreement = await db.representativeAgreement.create({ data: { representativeId: other.id, ...representativeAgreementDates(new Date("2022-01-01T06:00:00Z")), approvedAt: new Date("2021-01-01"), approvedByAdminId: "PRIVATE_ADMIN" } });
    await db.representativeReferral.create({ data: { representativeId: other.id, propertyId: foreignProperty.id, businessNameSnapshot: foreignProperty.name,
      businessCreatedAt: businessStart, capturedAt: businessStart, attributedAt: businessStart, businessExpiresAt: representativeExpiration(businessStart), productScope: "RENTFRAY", authorizingAgreementId: foreignAgreement.id } });
    const foreignUnit = await db.unit.create({ data: { propertyId: foreignProperty.id, unitNumber: "1" } });
    const foreignTenant = await db.tenantAssignment.create({ data: { propertyId: foreignProperty.id, unitId: foreignUnit.id, firstName: "PRIVATE_FOREIGN_TENANT" } });
    const foreignPayment = await db.payment.create({ data: { propertyId: foreignProperty.id, unitId: foreignUnit.id, tenantAssignmentId: foreignTenant.id,
      amountCents: 50000, status: "PAID", paymentMethod: "ACH", paidAt: new Date("2026-10-10"), stripePaymentIntentId: `pi_${run.replaceAll("-", "")}` } });
    await db.ledgerEntry.create({ data: { propertyId: foreignProperty.id, unitId: foreignUnit.id, tenantAssignmentId: foreignTenant.id,
      paymentId: foreignPayment.id, amountCents: -50000, entryType: "PAYMENT", referenceNumber: foreignPayment.stripePaymentIntentId, effectiveDate: now } });
    for (let index = 0; index < 30; index++) {
      const created = new Date("2021-01-01");
      await db.representativeReferral.create({ data: { representativeId: rep.id, propertyId: `retained-${run}-${index}`, businessNameSnapshot: `Historical business ${index}`,
        businessCreatedAt: created, capturedAt: created, attributedAt: created, businessExpiresAt: representativeExpiration(created), productScope: index % 2 ? "UNKNOWN" : "RENTFRAY" } });
    }
    await db.representativePayout.create({ data: { representativeId: rep.id, amountCents: 500, paidAt: new Date("2026-09-10"),
      recordedByAdminId: "PRIVATE_ADMIN", reportingMonth: "2026-08", operationKey: `stage2-${run}`, externalPayoutReference: `PRIVATE_BANK_${run}`, note: "PRIVATE_INTERNAL_NOTE" } });

    await t.test("PAID tenant ACH counts use flat $2.50 and survive agreement expiration", async () => {
      const report = await reports.getRepresentativeDashboard(rep.id, {}, now);
      assert.equal(report.agreement?.status, "EXPIRED");
      assert.equal(report.summary.currentMonthPayments, 2); assert.equal(report.summary.currentMonthCents, 500);
      assert.equal(report.summary.lifetimeCents, 1000); assert.equal(report.summary.paidCents, 500); assert.equal(report.summary.outstandingCents, 500);
      const business = report.businesses.items.find(row => row.id === referral.id)!;
      assert.equal(business.activeUnits, 2); assert.equal(business.status, "ELIGIBLE"); assert.equal(business.currentMonthPayments, 2);
      assert.equal(business.expiresAt, referral.businessExpiresAt.toISOString());
    });
    await t.test("Chicago month aggregation and exact business end boundary are independent", async () => {
      const report = await reports.getRepresentativeDashboard(rep.id, {}, now);
      assert.equal(report.history.items.find(row => row.month === "2026-09")?.payments, 1);
      assert.equal(report.history.items.find(row => row.month === "2026-10")?.payments, 2);
      const future = await reports.getRepresentativeDashboard(rep.id, {}, new Date("2028-01-01"));
      assert.equal(future.summary.lifetimeCents, 1250); assert.equal(future.businesses.items.find(row => row.id === referral.id)?.status, "WINDOW_ENDED");
      assert.ok(lastEligible.paidAt! < referral.businessExpiresAt);
    });
    await t.test("current-state reversals reduce totals without altering payout history", async () => {
      await db.payment.update({ where: { id: currentPayment.id }, data: { status: "REVERSED" } });
      const report = await reports.getRepresentativeDashboard(rep.id, {}, now);
      assert.equal(report.summary.currentMonthPayments, 1); assert.equal(report.summary.lifetimeCents, 750); assert.equal(report.summary.paidCents, 500);
      await db.payment.update({ where: { id: currentPayment.id }, data: { status: "PAID" } });
    });
    await t.test("tracking-only and UNKNOWN businesses never earn even with actual PAID tenant payments", async () => {
      await db.representativeReferral.update({ where: { id: referral.id }, data: { authorizingAgreementId: null } });
      assert.equal((await reports.getRepresentativeDashboard(rep.id, {}, now)).summary.lifetimeCents, 0);
      await db.representativeReferral.update({ where: { id: referral.id }, data: { productScope: "UNKNOWN" } });
      assert.equal((await reports.getRepresentativeDashboard(rep.id, {}, now)).summary.lifetimeCents, 0);
      await db.representativeReferral.update({ where: { id: referral.id }, data: { productScope: "RENTFRAY", authorizingAgreementId: agreement.id } });
    });
    await t.test("business cursors are bounded, nonduplicating, and always representative-scoped", async () => {
      const first = await reports.getRepresentativeDashboard(rep.id, {}, now);
      assert.equal(first.businesses.items.length, 25); assert.ok(first.businesses.nextCursor);
      const second = await reports.getRepresentativeDashboard(rep.id, { businessCursor: first.businesses.nextCursor }, now);
      assert.equal(second.businesses.items.length, 6); assert.equal(second.businesses.nextCursor, null);
      assert.equal(new Set([...first.businesses.items, ...second.businesses.items].map(row => row.id)).size, 31);
      assert.ok([...first.businesses.items, ...second.businesses.items].filter(row => row.id !== referral.id).every(row => row.status === "TRACKING_ONLY" && row.archived));
      assert.equal((await reports.getRepresentativeDashboard(other.id, {}, now)).businesses.items.length, 1);
    });
    await t.test("allowlisted DTO excludes tenants, contacts, Stripe, banking, admin and other portfolios", async () => {
      const report = await reports.getRepresentativeDashboard(rep.id, {}, now);
      const json = JSON.stringify(report);
      assert.doesNotMatch(json, /PRIVATE_|passwordHash|tenantAssignmentId|stripePaymentIntentId|contactEmail|recordedByAdminId|externalPayoutReference|operationKey/);
      assert.equal(report.payouts.items[0].amountCents, 500);
      assert.deepEqual(Object.keys(report.payouts.items[0]).sort(), ["id", "amountCents", "paidAt", "reportingMonth"].sort());
    });
    await t.test("report requests issue no data writes and preserve all financial records", async () => {
      const before = await db.$queryRaw<{ data: unknown }[]>`SELECT jsonb_agg(to_jsonb(p) ORDER BY p."id") AS data FROM "Payment" p`;
      const start = queries.length;
      await reports.getRepresentativeDashboard(rep.id, {}, now);
      const issued = queries.slice(start);
      assert.ok(issued.some(query => /SET TRANSACTION READ ONLY/.test(query)));
      assert.ok(!issued.some(query => /^\s*(INSERT|UPDATE|DELETE|TRUNCATE)/i.test(query)));
      assert.deepEqual(await db.$queryRaw`SELECT jsonb_agg(to_jsonb(p) ORDER BY p."id") AS data FROM "Payment" p`, before);
    });
    await t.test("monthly and payout histories have independent bounded cursors", async () => {
      for (let index = 0; index < 22; index++) await db.representativePayout.create({ data: { representativeId: rep.id, amountCents: 1,
        paidAt: new Date(Date.UTC(2026, 7, index + 1)), recordedByAdminId: "PRIVATE_ADMIN", reportingMonth: "2026-08", operationKey: `${run}-${index}`, externalPayoutReference: `${run}-${index}` } });
      const first = await reports.getRepresentativeDashboard(rep.id, {}, now);
      assert.equal(first.payouts.items.length, 20); assert.ok(first.payouts.nextCursor); assert.equal(first.history.items.length, 12); assert.ok(first.history.nextMonthBefore);
      const second = await reports.getRepresentativeDashboard(rep.id, { payoutCursor: first.payouts.nextCursor!, monthBefore: first.history.nextMonthBefore! }, now);
      assert.equal(second.payouts.items.length, 3); assert.equal(second.payouts.nextCursor, null);
      assert.equal(second.history.items.length, 12); assert.ok(second.history.items.every(row => row.month < first.history.items[11].month));
    });
    await t.test("dashboard handler denies management cookies and browser-supplied portfolio selectors", async () => {
      const api = stage2Load<{ GET(request: Request): Promise<Response> }>("app/api/representative/dashboard/route.ts", {
        "next/server": { NextResponse: { json: (body: unknown, options: ResponseInit) => Response.json(body, options) } },
        "@/lib/representativeSession": { ...session, getRepresentativeSession: async () => ({ id: rep.id }) }, "@/lib/representativeReports": reports,
      });
      assert.equal((await api.GET(representativeRequest(`/api/representative/dashboard?representativeId=${other.id}`))).status, 400);
      assert.equal(await session.getRepresentativeSession(), null);
    });
    await t.test("a thousand-business portfolio still returns bounded pages and query count", async () => {
      await db.representativeReferral.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({
        representativeId: rep.id, propertyId: `large-${run}-${index}`, businessNameSnapshot: `Historical ${index}`,
        businessCreatedAt: new Date("2020-01-01"), capturedAt: new Date("2020-01-01"), attributedAt: new Date("2020-01-01"), businessExpiresAt: new Date("2023-01-01"),
      })) });
      const start = queries.length;
      const report = await reports.getRepresentativeDashboard(rep.id, {}, now);
      assert.equal(report.summary.acquiredBusinesses, 1031); assert.equal(report.businesses.items.length, 25);
      assert.equal(report.history.items.length, 12); assert.equal(report.payouts.items.length, 20);
      assert.ok(queries.length - start < 25);
    });
  } finally { await db.$disconnect(); }
});
