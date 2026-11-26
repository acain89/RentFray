// Isolated acceptance only. Existing application credentials never select a target.
import { spawnSync } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = realpathSync(tmpdir());
const artifacts = mkdtempSync(join(temporary, "rf-postgres-acceptance-"));
const postgresBin = process.env.RF_POSTGRES_BIN ?? "C:/Program Files/PostgreSQL/17/bin";
const executable = name => join(postgresBin, process.platform === "win32" ? name + ".exe" : name);
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"].includes(key.toUpperCase())));
const environment = { ...clean, NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: "--import " + new URL("verification-network-guard.mjs", import.meta.url).href, STRIPE_SECRET_KEY: "sk_test_synthetic_local_not_a_credential" };
const owned = [];
const summary = { stages: [], startupRejections: 0, cleanup: false };
let sequence = 0;
function run(command, args, env, cwd, label, timeout = 180000) {
  const log = join(artifacts, `${++sequence}-${label}.log`);
  const fd = openSync(log, "w", 0o600);
  try {
    const result = spawnSync(command, args, { env, cwd, stdio: ["ignore", fd, fd], timeout });
    return { code: result.status, log: basename(log) };
  } finally { closeSync(fd); }
}
function requireSuccess(result, stage) {
  summary.stages.push({ stage, ...result });
  if (result.code !== 0) throw new Error(`${stage} failed; see ${result.log}`);
  console.log(`${stage}: PASS`);
}
function checkedRoot(root) {
  if (dirname(root) !== temporary || !/^rentfray-disposable-[a-f0-9]{32}$/.test(basename(root)) || lstatSync(root).isSymbolicLink() || realpathSync(root) !== root) throw new Error("Disposable cleanup target rejected");
  if (existsSync(join(root, "data")) && (lstatSync(join(root, "data")).isSymbolicLink() || realpathSync(join(root, "data")) !== join(root, "data"))) throw new Error("Linked data directory rejected");
}
function dispose(cluster) {
  checkedRoot(cluster.root);
  if (existsSync(join(cluster.root, "operation.lock"))) throw new Error("Active disposable lease prevents cleanup");
  if (existsSync(join(cluster.root, "data/postmaster.pid"))) {
    const result = run(executable("pg_ctl"), ["-D", join(cluster.root, "data"), "-m", "fast", "-w", "stop"], clean, artifacts, "shutdown", 30000);
    if (result.code !== 0) throw new Error("Disposable cluster shutdown failed");
  }
  rmSync(cluster.root, { recursive: true });
  cluster.disposed = true;
}
const preflight = `const {openDisposableUtility}=require(${JSON.stringify(join(repository, "scripts/operational-safety.ts"))});(async()=>{const lease=await openDisposableUtility('qa-audit',process.argv[1],true);await lease.close()})().catch(error=>{console.error(error.code||'PREFLIGHT_FAILED');process.exitCode=2});`;
function provision(name) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const nonce = randomBytes(16).toString("hex"), root = join(temporary, "rentfray-disposable-" + nonce);
    mkdirSync(root, { mode: 0o700 });
    const cluster = { root, disposed: false }; owned.push(cluster);
    const username = "rf_disposable_" + nonce, password = randomBytes(24).toString("hex"), port = randomInt(55000, 65000);
    const pgEnvironment = { ...clean, PGPASSWORD: password };
    const passwordFile = join(root, "password.tmp"); writeFileSync(passwordFile, password, { mode: 0o600 });
    try {
      requireSuccess(run(executable("initdb"), ["-D", join(root, "data"), "-U", username, "--pwfile=" + passwordFile, "--auth-host=scram-sha-256", "--auth-local=scram-sha-256", "--encoding=UTF8", "--locale=C"], pgEnvironment, artifacts, "initdb"), name + " initdb");
    } finally { unlinkSync(passwordFile); }
    const configPath = join(root, "data/postgresql.conf");
    writeFileSync(configPath, readFileSync(configPath, "utf8") + `\nlisten_addresses='127.0.0.1'\nport=${port}\ncluster_name='rentfray-disposable-${nonce}'\nmax_connections=12\nshared_buffers=16MB\n`);
    requireSuccess(run(executable("pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "start"], pgEnvironment, artifacts, "startup"), name + " startup");
    requireSuccess(run(executable("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", username, username], pgEnvironment, artifacts, "createdb"), name + " create empty database");
    const manifest = { version: 1, operation: "qa-audit", root, nonce, databaseUrl: `postgresql://${username}:${password}@127.0.0.1:${port}/${username}?schema=public&connection_limit=4&pool_timeout=30&connect_timeout=10`, database: username, username, port, propertyCodes: ["9920"] };
    const manifestPath = join(root, "manifest.json"); writeFileSync(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
    const identity = run(process.execPath, ["--import", "tsx", "-e", preflight, manifestPath], environment, repository, "identity");
    if (identity.code !== 0) {
      summary.startupRejections++; dispose(cluster);
      console.log(name + ": strict preflight rejected startup evidence; provisioning a new cluster"); continue;
    }
    requireSuccess(identity, name + " independent identity preflight");
    requireSuccess(run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"], { ...environment, DATABASE_URL: manifest.databaseUrl }, repository, "migrations"), name + " committed migrations");
    return { manifest, manifestPath };
  }
  throw new Error(name + ": strict preflight failed in five independent attempts");
}
try {
  for (const name of ["initdb", "postgres", "pg_ctl", "createdb"]) if (!existsSync(executable(name))) throw new Error("PostgreSQL binaries unavailable; set RF_POSTGRES_BIN to a local PostgreSQL 14+ bin directory");
  const suites = ["representative-postgres", "representative-stage2-postgres", "representative-stage3-postgres", "representative-activation", "representative-slugs", "tier-counter-postgres", "financial-postgres"];
  const config = {};
  for (const name of suites) config[name] = provision(name).manifestPath;
  const fixtureConfig = join(artifacts, "fixtures.json"); writeFileSync(fixtureConfig, JSON.stringify(config), { mode: 0o600 });
  const browserFixture = join(artifacts, "browser-fixture.json"); writeFileSync(browserFixture, JSON.stringify({ root: artifacts }));
  const utility = provision("financial utilities");
  for (const [operation, flags] of [["production-smoke", []], ["financial-regression", []], ["qa-audit", ["--stress", "--all-presets"]]]) {
    utility.manifest.operation = operation; utility.manifest.propertyCodes = operation === "production-smoke" ? ["9998"] : ["9920"];
    writeFileSync(utility.manifestPath, JSON.stringify(utility.manifest), { mode: 0o600 });
    requireSuccess(run(process.execPath, [join(repository, "node_modules/tsx/dist/cli.mjs"), "--tsconfig", join(repository, "tsconfig.json"), join(repository, "scripts/run-operational.ts"), operation, "--manifest", utility.manifestPath, "--execute", ...flags], environment, artifacts, operation), operation);
  }
  requireSuccess(run(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", "--test-timeout=300000", "tests/*.test.ts", "tests/*.test.tsx"], { ...environment, RF_POSTGRES_TEST_CONFIG: fixtureConfig, REPRESENTATIVE_STAGE3_TEST_FIXTURE: browserFixture }, repository, "all-regressions", 1800000), "complete TS/TSX and database regression suites");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Isolated acceptance failed"); process.exitCode = 1;
} finally {
  let cleanShutdown = true;
  for (const cluster of owned.filter(value => !value.disposed).reverse()) {
    try { dispose(cluster); } catch { cleanShutdown = false; console.error("Disposable cleanup requires review: " + basename(cluster.root)); }
  }
  summary.cleanup = cleanShutdown;
  if (!cleanShutdown) process.exitCode = 1;
  writeFileSync(join(artifacts, "summary.json"), JSON.stringify(summary, null, 2));
  console.log("Sanitized acceptance evidence: " + artifacts);
}
