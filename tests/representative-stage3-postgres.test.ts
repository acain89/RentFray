import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { stage3Fixture } from "./representative-stage3-fixture";
import { representativeRequest } from "./representative-stage2-fixture";
import { representativeExpiration } from "../lib/representativeCalendar";

const fixturePath = process.env.REPRESENTATIVE_STAGE3_TEST_FIXTURE;
test("isolated PostgreSQL representative administration", { skip: !fixturePath }, async t => {
  const fixture = JSON.parse(readFileSync(fixturePath!, "utf8")) as { root: string; url: string };
  const root = realpathSync(fixture.root).replaceAll("\\", "/"), target = new URL(fixture.url);
  assert.match(root, /\/rentfray-representative-stage1-[a-f0-9]{32}$/);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55447");
  assert.equal(target.username, "representative_stage1"); assert.equal(target.pathname, "/rentfray_representative_stage3_verified");
  const runtime = createRequire(__filename)(join(root, "generated-client")) as typeof import("@prisma/client");
  const db = new runtime.PrismaClient({ datasources: { db: { url: fixture.url } }, log: [{ emit: "event", level: "query" }] });
  const queries: string[] = []; db.$on("query", e => queries.push(e.query));
  try {
    const [identity] = await db.$queryRaw<{ directory: string }[]>`SELECT current_setting('data_directory') AS directory`;
    assert.equal(realpathSync(identity.directory).replaceAll("\\", "/"), root + "/data");
    const f = stage3Fixture(db, runtime.Prisma), a = f.admin, actor = { adminAccessId: "stage3-admin" }, run = randomUUID();
    const rep = await a.createRepresentative(actor, { displayName: "Stage Three", email: `  STAGE3-${run}@EXAMPLE.INVALID ` });
    const other = await a.createRepresentative(actor, { displayName: "Other", email: `other-${run}@example.invalid` });
    await t.test("real administrator sessions are revalidated; disabled admins and representative tokens are denied", async () => {
      const access = await db.adminAccess.create({ data: { codeHash: "fixture-only" } });
      f.cookies.set("rf_session", f.originalSession.createSessionToken({ role: "ADMIN", adminAccessId: access.id }));
      const request = representativeRequest("/api/admin/representatives");
      assert.equal((await a.runRepresentativeAdmin(request, false, async () => ({}))).status, 200);
      await db.adminAccess.update({ where: { id: access.id }, data: { isActive: false } });
      assert.equal((await a.runRepresentativeAdmin(request, false, async () => ({}))).status, 401);
      f.cookies.set("rf_session", f.repSession.createRepresentativeSessionToken(rep.id, 0));
      assert.equal((await a.runRepresentativeAdmin(request, false, async () => ({}))).status, 401);
      f.cookies.clear();
    });
    await t.test("provisioning normalizes email, generates permanent slug, and audits without credentials", async () => {
      assert.equal(rep.email, `stage3-${run}@example.invalid`); assert.equal(rep.slug, "stage-three");
      const row = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      assert.equal(row.passwordHash, null); assert.equal(row.loginEnabled, true);
      assert.equal(await db.auditLog.count({ where: { action: "REPRESENTATIVE_CREATED", targetId: rep.id, actorAdminId: actor.adminAccessId } }), 1);
      assert.ok(!JSON.stringify(rep).includes("password"));
    });
    await t.test("duplicate email cannot create partial representatives", async () => {
      await assert.rejects(a.createRepresentative(actor, { displayName: "Duplicate", email: rep.email }), /already exists/);
      assert.equal(await db.representative.count({ where: { email: rep.email } }), 1);
    });
    await t.test("slug collisions use numeric suffixes without altering the existing representative", async () => {
      const name = `collision-${run.slice(0, 8)}`;
      await db.representative.create({ data: { email: `collision-${run}@example.invalid`, displayName: "Existing", slug: name } });
      const created = await a.createRepresentative(actor, { displayName: name, email: `retry-${run}@example.invalid` });
      assert.equal(created.slug, `${name}-2`);
    });
    await t.test("provisioned account survives mocked email delivery failure", async () => {
      const failedEmail = stage3Fixture(db, runtime.Prisma, { send: async () => { throw new Error("mock transport unavailable"); } }).admin;
      assert.equal(await failedEmail.sendRepresentativeSetup(actor, rep.id), false);
      assert.ok(await db.representative.findUnique({ where: { id: rep.id } }));
    });
    await t.test("initial setup uses hashed seven-day latest-only activation and mocked email", async () => {
      assert.equal(await a.sendRepresentativeSetup(actor, rep.id), true);
      const first = f.delivered[0].token;
      assert.equal(await a.sendRepresentativeSetup(actor, rep.id), true);
      const row = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      assert.notEqual(f.delivered[1].token, first); assert.notEqual(row.resetTokenHash, first);
      assert.equal(f.delivered[1].purpose, "ACTIVATION");
      assert.ok(row.resetTokenExpiresAt!.getTime() > Date.now() + 167 * 60 * 60 * 1000);
    });
    await t.test("disable revokes sessions and reset tokens without changing referral URL", async () => {
      const token = f.repSession.createRepresentativeSessionToken(rep.id, 0);
      await a.setRepresentativeLogin(actor, rep.id, { loginEnabled: false });
      assert.equal(await f.repSession.validateRepresentativeSession(token), null);
      await assert.rejects(a.sendRepresentativeSetup(actor, rep.id), /Enable/);
      await a.setRepresentativeLogin(actor, rep.id, { loginEnabled: true });
      assert.equal(await f.repSession.validateRepresentativeSession(token), null);
      const row = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      assert.equal(row.slug, rep.slug); assert.equal(row.sessionVersion, 2); assert.equal(row.resetTokenHash, null);
    });
    const start = new Date(Date.now() - 86400000).toISOString();
    const agreement = await a.createRepresentativeAgreement(actor, rep.id, { effectiveAt: start, agreementReference: "approved-3" });
    await t.test("agreements use exactly thirty-six calendar months and reject overlapping concurrent creation", async () => {
      assert.equal(agreement.expiresAt, representativeExpiration(new Date(start)).toISOString());
      const results = await Promise.allSettled([1, 2].map(() => a.createRepresentativeAgreement(actor, other.id, { effectiveAt: start })));
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      await assert.rejects(a.createRepresentativeAgreement(actor, rep.id, { effectiveAt: start }), /overlaps/);
      await a.createRepresentativeAgreement(actor, rep.id, { effectiveAt: agreement.expiresAt });
    });
    const birth = new Date(Date.now() - 180 * 86400000);
    async function referral(scope = "RENTFRAY", expired = false, representativeId = rep.id) {
      const created = expired ? new Date("2020-01-01") : birth;
      return db.representativeReferral.create({ data: { representativeId, propertyId: randomUUID(), businessNameSnapshot: "Acquired business",
        businessCreatedAt: created, businessExpiresAt: representativeExpiration(created), capturedAt: created, attributedAt: created, productScope: scope } });
    }
    const r = await referral();
    let granted = "";
    await t.test("tracking-only authorization is concurrent-idempotent, server-timed, and preserves original clocks", async () => {
      const before = Date.now();
      const results = await Promise.all([1, 2].map(() => a.authorizeRepresentativeBusiness(actor, rep.id, r.id, { agreementId: agreement.id })));
      assert.equal(results[0].commissionEligibleFrom, results[1].commissionEligibleFrom); granted = results[0].commissionEligibleFrom;
      assert.ok(Date.parse(granted) >= before && Date.parse(granted) <= Date.now());
      const row = await db.representativeReferral.findUniqueOrThrow({ where: { id: r.id } });
      assert.equal(row.businessCreatedAt.getTime(), birth.getTime()); assert.equal(row.businessExpiresAt.getTime(), r.businessExpiresAt.getTime());
      const logs = await db.auditLog.findMany({ where: { action: "REPRESENTATIVE_BUSINESS_AUTHORIZED", targetId: r.id } });
      assert.equal(logs.length, 1); assert.equal(logs[0].actorAdminId, actor.adminAccessId);
      const metadata = JSON.parse(logs[0].metadataJson!);
      assert.equal(metadata.propertyId, r.propertyId); assert.equal(metadata.representativeId, rep.id);
      assert.equal(metadata.agreementId, agreement.id); assert.equal(metadata.commissionEligibleFrom, granted);
    });
    await t.test("expired, UNKNOWN, foreign, and invalid-agreement authorizations are rejected", async () => {
      for (const row of [await referral("UNKNOWN"), await referral("RENTFRAY", true)])
        await assert.rejects(a.authorizeRepresentativeBusiness(actor, rep.id, row.id, { agreementId: agreement.id }));
      const foreign = await referral("RENTFRAY", false, other.id);
      await assert.rejects(a.authorizeRepresentativeBusiness(actor, rep.id, foreign.id, { agreementId: agreement.id }));
      const tracking = await referral();
      await assert.rejects(a.authorizeRepresentativeBusiness(actor, rep.id, tracking.id, { agreementId: "missing" }));
      assert.equal((await db.representativeReferral.findUniqueOrThrow({ where: { id: tracking.id } })).authorizingAgreementId, null);
      const foreignAgreement = await db.representativeAgreement.findFirstOrThrow({ where: { representativeId: other.id } });
      await assert.rejects(a.authorizeRepresentativeBusiness(actor, rep.id, tracking.id, { agreementId: foreignAgreement.id }));
      const future = await db.representativeAgreement.findFirstOrThrow({ where: { representativeId: rep.id, effectiveAt: new Date(agreement.expiresAt) } });
      await assert.rejects(a.authorizeRepresentativeBusiness(actor, rep.id, tracking.id, { agreementId: future.id }));
      await assert.rejects(a.authorizeRepresentativeBusiness(actor, rep.id, r.id, { agreementId: future.id }));
    });
    await t.test("representative list cursor pages are bounded and do not duplicate records", async () => {
      await db.representative.createMany({ data: Array.from({ length: 28 }, (_, i) => ({ email: `page-${i}-${run}@example.invalid`, displayName: `Page ${i}`, slug: `page-${i}-${run}` })) });
      const first = await a.listRepresentatives(); assert.equal(first.items.length, 25); assert.ok(first.nextCursor);
      const second = await a.listRepresentatives(first.nextCursor!);
      const ids = [...first.items, ...second.items].map(x => x.id); assert.equal(new Set(ids).size, ids.length);
      for (const row of [...first.items, ...second.items]) assert.deepEqual(Object.keys(row).sort(), ["id", "displayName", "email", "slug", "loginEnabled", "createdAt", "referralUrl"].sort());
    });
    // Deliberately fail only AuditLog insertion, inside the real database transaction.
    const failingDb = new Proxy(db, { get(target, key) {
      if (key === "$transaction") return (work: (tx: unknown) => unknown) => target.$transaction(async tx => work(new Proxy(tx, { get(transaction, name) {
        if (name === "auditLog") return { create: async () => { throw new Error("injected audit failure"); } };
        const value = Reflect.get(transaction, name); return typeof value === "function" ? value.bind(transaction) : value;
      } })));
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    await t.test("audit failure atomically rolls back later authorization", async () => {
      const row = await referral(); const broken = stage3Fixture(failingDb, runtime.Prisma).admin;
      await assert.rejects(broken.authorizeRepresentativeBusiness(actor, rep.id, row.id, { agreementId: agreement.id }), /audit failure/);
      const after = await db.representativeReferral.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(after.authorizingAgreementId, null); assert.equal(after.commissionEligibleFrom, null);
    });
    const property = await db.property.create({ data: { id: r.propertyId, name: "Business", propertyCode: run } });
    const unit = await db.unit.create({ data: { propertyId: property.id, unitNumber: "1" } });
    const tenant = await db.tenantAssignment.create({ data: { propertyId: property.id, unitId: unit.id, firstName: "PRIVATE_TENANT" } });
    async function payment(at: Date) {
      const p = await db.payment.create({ data: { propertyId: property.id, unitId: unit.id, tenantAssignmentId: tenant.id,
        amountCents: 10000, paymentMethod: "ACH", status: "PAID", paidAt: at, stripePaymentIntentId: "pi_" + randomUUID().replaceAll("-", "") } });
      await db.ledgerEntry.create({ data: { propertyId: property.id, unitId: unit.id, tenantAssignmentId: tenant.id, paymentId: p.id,
        entryType: "PAYMENT", amountCents: -10000, referenceNumber: p.stripePaymentIntentId, effectiveDate: at } });
    }
    await payment(new Date(Date.parse(granted) - 1)); await payment(new Date(granted)); await payment(new Date(Date.parse(granted) + 1));
    await payment(r.businessExpiresAt);
    const financialSnapshot = JSON.stringify(await db.payment.findMany({ orderBy: { id: "asc" } }));
    const queryStart = queries.length;
    await t.test("later grants exclude retroactive and exact-expiration earnings and include exact authorization", async () => {
      const report = await f.reports.getRepresentativeDashboard(rep.id, {}, new Date(Date.parse(granted) + 1000));
      assert.equal(report.summary.lifetimeCents, 500); assert.equal(report.businesses.items.find(b => b.id === r.id)?.status, "ELIGIBLE");
      const ended = await f.reports.getRepresentativeDashboard(rep.id, {}, new Date(r.businessExpiresAt.getTime() + 1000));
      assert.equal(ended.summary.lifetimeCents, 500);
    });
    const payout = { amountUsd: "5.00", paidAt: new Date(Date.now() - 86400000).toISOString(), reportingMonth: "2026-10",
      externalPayoutReference: "external-" + run, operationKey: randomUUID(), note: "Completed outside RentFray" };
    await t.test("concurrent identical payout retries create exactly one permanent audited record", async () => {
      const rows = await Promise.all([1, 2].map(() => a.recordRepresentativePayout(actor, rep.id, payout)));
      assert.equal(rows[0].id, rows[1].id); assert.equal(rows[0].amountCents, 500);
      assert.equal(await db.representativePayout.count({ where: { operationKey: payout.operationKey } }), 1);
      assert.equal(await db.auditLog.count({ where: { targetId: rows[0].id, action: "REPRESENTATIVE_PAYOUT_RECORDED" } }), 1);
    });
    await t.test("conflicting payout retries, duplicate external references, future dates and nonpositive amounts fail", async () => {
      for (const patch of [{ amountUsd: "6.00" }, { note: "changed" }, { reportingMonth: "2026-09" }])
        await assert.rejects(a.recordRepresentativePayout(actor, rep.id, { ...payout, ...patch }));
      await assert.rejects(a.recordRepresentativePayout(actor, rep.id, { ...payout, operationKey: randomUUID() }));
      await assert.rejects(a.recordRepresentativePayout(actor, rep.id, { ...payout, amountUsd: "0" }));
      await assert.rejects(a.recordRepresentativePayout(actor, rep.id, { ...payout, operationKey: randomUUID(), externalPayoutReference: randomUUID(), paidAt: "2099-01-01" }));
    });
    await t.test("audit failure atomically rolls back payout insertion", async () => {
      const key = randomUUID(); const broken = stage3Fixture(failingDb, runtime.Prisma).admin;
      await assert.rejects(broken.recordRepresentativePayout(actor, rep.id, { ...payout, operationKey: key, externalPayoutReference: key }), /audit failure/);
      assert.equal(await db.representativePayout.count({ where: { operationKey: key } }), 0);
    });
    await t.test("admin details reuse reports, scope metadata, preserve payouts and expose no tenant records", async () => {
      const detail = await a.getRepresentativeAdminDetail(rep.id);
      assert.equal(detail.report.summary.paidCents, 500);
      assert.equal(detail.businesses.find(b => b.id === r.id)?.lifetimeCents, 500);
      assert.equal(detail.payouts[0].externalPayoutReference, payout.externalPayoutReference);
      assert.ok(!JSON.stringify(detail).includes("PRIVATE_TENANT"));
      assert.ok(!JSON.stringify(detail).includes("resetToken"));
    });
    await t.test("durable per-admin throttling survives new helper instances", async () => {
      const mockSession = { getSession: async () => ({ role: "ADMIN", adminAccessId: "throttle-" + run }) };
      for (let i = 0; i < 60; i++) {
        const helper = stage3Fixture(db, runtime.Prisma, { session: mockSession }).admin;
        assert.equal((await helper.runRepresentativeAdmin(representativeRequest("/api/admin/representatives", {}), true, async () => ({}))).status, 200);
      }
      const helper = stage3Fixture(db, runtime.Prisma, { session: mockSession }).admin;
      assert.equal((await helper.runRepresentativeAdmin(representativeRequest("/api/admin/representatives", {}), true, async () => ({}))).status, 429);
    });
    await t.test("administrative operations never write existing financial tables", async () => {
      assert.equal(JSON.stringify(await db.payment.findMany({ orderBy: { id: "asc" } })), financialSnapshot);
      const writes = queries.slice(queryStart).filter(q => /^\s*(INSERT INTO|UPDATE|DELETE FROM)/i.test(q));
      for (const q of writes) assert.match(q, /"(?:RepresentativePayout|AuditLog|AuthThrottleBucket)"/);
    });
  } finally { await db.$disconnect(); }
});
