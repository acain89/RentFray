import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { stage2Load } from "./representative-stage2-fixture";
import type * as Auth from "../lib/representativeAuth";
import type * as Session from "../lib/representativeSession";

const activationMs = 168 * 60 * 60 * 1000, resetMs = 30 * 60 * 1000;
function fixture(passwordHash: string | null = null) {
  let now = new Date("2026-10-30T12:00:00Z"); // Seven days crosses Chicago's fall DST change.
  const row = { id: "representative", email: "rep@example.invalid", loginEnabled: true, passwordHash, sessionVersion: 2,
    resetTokenHash: null as string | null, resetTokenExpiresAt: null as Date | null, resetTokenSessionVersion: null as number | null };
  let writes = 0;
  type Update = Partial<Pick<typeof row, "passwordHash" | "resetTokenHash" | "resetTokenExpiresAt" | "resetTokenSessionVersion">> & { sessionVersion?: { increment: number } };
  const representative = {
    findUnique: async ({ where }: { where: { resetTokenHash?: string } }) =>
      where.resetTokenHash && where.resetTokenHash !== row.resetTokenHash ? null : row,
    update: async ({ data: { sessionVersion, ...data } }: { data: Update }) => {
      writes++; Object.assign(row, data); row.sessionVersion += sessionVersion?.increment ?? 0; return row;
    },
  };
  const tx = { representative, $queryRaw: async (strings: TemplateStringsArray) =>
    strings.join("").includes("clock_timestamp") ? [{ now }] : [{ id: row.id }] };
  const db = { ...tx, $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  const auth = stage2Load<typeof Auth>("lib/representativeAuth.ts", { "@/lib/prisma": { prisma: db }, "@/lib/representativeSession": {} });
  return { auth, row, time: () => now, at: (value: Date) => { now = value; }, writes: () => writes };
}

for (const mode of ["activation", "recovery", "activated-admin-setup"] as const) {
  for (const offset of [-1, 0, 1]) {
    test(`${mode} redemption at expiration ${offset >= 0 ? "+" : ""}${offset}ms`, async () => {
      const f = fixture(mode === "activated-admin-setup" ? "existing-password-hash" : null);
      const issued = await (mode === "recovery" ? f.auth.issueRepresentativeRecovery(f.row.email) : f.auth.issueRepresentativeSetup(f.row.email));
      assert.ok(issued); assert.match(issued.token, /^[a-f0-9]{64}$/);
      const lifetime = mode === "activation" ? activationMs : resetMs;
      assert.equal(issued.purpose, mode === "activation" ? "ACTIVATION" : "PASSWORD_RESET");
      assert.equal(f.row.resetTokenExpiresAt!.getTime(), f.time().getTime() + lifetime);
      assert.equal(f.row.resetTokenHash, createHash("sha256").update(issued.token).digest("hex"));
      f.at(new Date(f.row.resetTokenExpiresAt!.getTime() + offset));
      const before = f.writes();
      assert.equal(await f.auth.redeemRepresentativeRecovery(issued.token, "safe-password"), offset < 0);
      if (offset < 0) {
        assert.equal(f.row.sessionVersion, 3); assert.equal(f.row.resetTokenHash, null);
        assert.equal(await f.auth.redeemRepresentativeRecovery(issued.token, "safe-password"), false);
      } else { assert.equal(f.writes(), before); assert.equal(f.row.sessionVersion, 2); }
    });
  }
}

test("activation and recovery supersede each other using one latest-token slot", async () => {
  const f = fixture();
  const first = await f.auth.issueRepresentativeSetup(f.row.email); assert.ok(first);
  const reset = await f.auth.issueRepresentativeRecovery(f.row.email); assert.ok(reset);
  assert.equal(f.row.resetTokenExpiresAt!.getTime(), f.time().getTime() + resetMs);
  assert.equal(await f.auth.redeemRepresentativeRecovery(first.token, "safe-password"), false);
  const latest = await f.auth.issueRepresentativeSetup(f.row.email); assert.ok(latest);
  assert.equal(await f.auth.redeemRepresentativeRecovery(reset.token, "safe-password"), false);
  assert.equal(await f.auth.redeemRepresentativeRecovery(latest.token, "safe-password"), true);
  const afterActivation = await f.auth.issueRepresentativeSetup(f.row.email); assert.ok(afterActivation);
  assert.equal(afterActivation.purpose, "PASSWORD_RESET");
  assert.equal(f.row.resetTokenExpiresAt!.getTime(), f.time().getTime() + resetMs);
});

test("previously issued thirty-minute tokens are never extended at redemption", async () => {
  const f = fixture(), token = "b".repeat(64);
  const expiration = new Date(f.time().getTime() + resetMs);
  f.row.resetTokenHash = createHash("sha256").update(token).digest("hex");
  f.row.resetTokenExpiresAt = expiration; f.row.resetTokenSessionVersion = f.row.sessionVersion;
  f.at(expiration);
  assert.equal(await f.auth.redeemRepresentativeRecovery(token, "safe-password"), false);
  assert.equal(f.row.resetTokenExpiresAt, expiration); assert.equal(f.writes(), 0);
});

test("activation fails after disable or session-version revocation", async () => {
  for (const reason of ["disabled", "revoked"]) {
    const f = fixture(), issued = await f.auth.issueRepresentativeSetup(f.row.email); assert.ok(issued);
    if (reason === "disabled") f.row.loginEnabled = false; else f.row.sessionVersion++;
    const writes = f.writes();
    assert.equal(await f.auth.redeemRepresentativeRecovery(issued.token, "safe-password"), false);
    assert.equal(f.writes(), writes);
    if (reason === "disabled") assert.equal(await f.auth.issueRepresentativeSetup(f.row.email), null);
  }
});

test("schema, migrations and manager recovery remain byte-for-byte committed content", () => {
  const files = ["prisma/schema.prisma", "app/api/manager/password-recovery/request/route.ts", "app/api/manager/password-recovery/reset/route.ts"];
  for (const file of files) assert.equal(readFileSync(file, "utf8").replace(/\r\n/g, "\n"),
    execFileSync("git", ["show", `7061ea58ff31ce8a8eba6a0d3a6f66e394bd8644:${file}`], { encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n"));
  assert.equal(execFileSync("git", ["diff", "--name-only", "7061ea58ff31ce8a8eba6a0d3a6f66e394bd8644", "--", "prisma/migrations"], { encoding: "utf8", windowsHide: true }), "");
});

const fixturePath = process.env.REPRESENTATIVE_STAGE2_TEST_FIXTURE;
test("isolated PostgreSQL activation and recovery preserve security", { skip: !fixturePath }, async t => {
  const config = JSON.parse(readFileSync(fixturePath!, "utf8")) as { root: string; url: string };
  const root = realpathSync(config.root).replaceAll("\\", "/"), target = new URL(config.url);
  assert.match(root, /\/rentfray-representative-stage1-[a-f0-9]{32}$/);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55447");
  assert.equal(target.username, "representative_stage1"); assert.equal(target.pathname, "/rentfray_representative_stage2_verified");
  const runtime = createRequire(__filename)(join(root, "generated-client")) as typeof import("@prisma/client");
  const db = new runtime.PrismaClient({ datasources: { db: { url: config.url } }, log: [] });
  try {
    const [identity] = await db.$queryRaw<{ directory: string }[]>`SELECT current_setting('data_directory') AS directory`;
    assert.equal(realpathSync(identity.directory).replaceAll("\\", "/"), root + "/data");
    const mocks = { "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: runtime.Prisma },
      "next/headers": { cookies: async () => ({ get: () => undefined, set() {} }) } };
    const session = stage2Load<typeof Session>("lib/representativeSession.ts", mocks);
    const auth = stage2Load<typeof Auth>("lib/representativeAuth.ts", { ...mocks, "@/lib/representativeSession": session });
    const rep = await db.representative.create({ data: { email: `activation-${randomUUID()}@example.invalid`, slug: `activation-${randomUUID()}`, displayName: "Activation test", loginEnabled: true } });
    await t.test("initial activation lasts exactly 168 hours from the database clock", async () => {
      const [{ now: before }] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const issued = await auth.issueRepresentativeSetup(rep.email); assert.ok(issued);
      const [{ now: after }] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const row = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      assert.equal(issued.purpose, "ACTIVATION"); assert.notEqual(row.resetTokenHash, issued.token);
      assert.ok(row.resetTokenExpiresAt!.getTime() >= before.getTime() + activationMs);
      assert.ok(row.resetTokenExpiresAt!.getTime() <= after.getTime() + activationMs);
    });
    await t.test("public reset for an unactivated account stays thirty minutes and supersedes activation", async () => {
      const old = await auth.issueRepresentativeSetup(rep.email); assert.ok(old);
      const [{ now: before }] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const issued = await auth.issueRepresentativeRecovery(rep.email); assert.ok(issued);
      const [{ now: after }] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const row = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      assert.equal(issued.purpose, "PASSWORD_RESET");
      assert.ok(row.resetTokenExpiresAt!.getTime() >= before.getTime() + resetMs);
      assert.ok(row.resetTokenExpiresAt!.getTime() <= after.getTime() + resetMs);
      assert.equal(await auth.redeemRepresentativeRecovery(old.token, "safe-password"), false);
    });
    await t.test("concurrent activation redemption is single-use and revokes prior sessions", async () => {
      const issued = await auth.issueRepresentativeSetup(rep.email); assert.ok(issued);
      const token = session.createRepresentativeSessionToken(rep.id, 0);
      const result = await Promise.all([auth.redeemRepresentativeRecovery(issued.token, "safe-password"), auth.redeemRepresentativeRecovery(issued.token, "safe-password")]);
      assert.equal(result.filter(Boolean).length, 1);
      const row = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      assert.equal(row.sessionVersion, 1); assert.equal(row.resetTokenHash, null);
      assert.equal(await session.validateRepresentativeSession(token), null);
      assert.equal(await auth.redeemRepresentativeRecovery(issued.token, "safe-password"), false);
    });
    await t.test("admin setup for an activated account stays thirty minutes", async () => {
      const [{ now: before }] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const issued = await auth.issueRepresentativeSetup(rep.email); assert.ok(issued);
      const [{ now: after }] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const row = await db.representative.findUniqueOrThrow({ where: { id: rep.id } });
      assert.equal(issued.purpose, "PASSWORD_RESET");
      assert.ok(row.resetTokenExpiresAt!.getTime() >= before.getTime() + resetMs);
      assert.ok(row.resetTokenExpiresAt!.getTime() <= after.getTime() + resetMs);
    });
  } finally { await db.$disconnect(); }
});
