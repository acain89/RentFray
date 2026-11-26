# RF operational safety restoration

This inventory reviews all 71 original operational paths plus the shared safety entry points. Classification is static repository evidence, not a production execution claim. No production database or provider was contacted. See OPERATIONAL-SAFETY-INVENTORY.csv for every disposition.

## Retired and quarantined repairs

`fix-stripe.js` unconditionally cleared stripeAccountId on every property; `fix-tuc.js` selected the first property without a scope and set its unitCount to 76. Their histories identify one-time repairs, and repository/package/deployment references do not establish a recurring dependency. They are deleted without execution. Historical file-list artifacts are not operational dependencies.

The billing-cycle rewrite and two hardcoded historical property repairs retain their source but throw OPERATIONAL_REVIEW_REQUIRED before main. External use cannot be proved absent, so they are not silently deleted. `smoke-test.ps1` is similarly quarantined: it targets a local HTTP application with real-looking property/PIN defaults and authenticated mutation probes; localhost does not prove its application's database is disposable. None was executed.

## Disposable database capability

Use `scripts/run-operational.ts` with a finite operation name, a verified manifest and explicit `--execute`. Without execute, the utility reports that no mutation ran and fails rather than reporting a false QA pass. The Prisma seed and financial QA package commands enter this boundary. Direct imports of mutation entry points fail without its private in-process capability.

A manifest alone, NODE_ENV, a database name or a Boolean flag cannot grant access. The boundary requires all of:

- An independently provisioned local PostgreSQL 14+ cluster in the real OS temporary directory, under `rentfray-disposable-<32 lowercase hex nonce>`, with a non-linked `data` directory and regular `manifest.json`.
- A live PID and matching data directory, start timestamp and high loopback port from `postmaster.pid`.
- A loopback URL with exact nonce-bound database/user, no host overrides or duplicate parameters, and bounded pool settings.
- An actual read-only server identity transaction proving database, user, address, port, data directory, nonce-bound cluster_name and postmaster timestamp match the independent filesystem/process evidence.
- An exclusive operation.lock. Stale locks fail closed and require operator investigation; they are not automatically removed.

Manifest version is 1. Fields: operation, root, nonce, databaseUrl, database, username, port and propertyCodes. The finite operation/property-code registry is authoritative in operational-safety.ts. Provision the isolated cluster and existing schema independently; this batch does not create a cluster, run migrations or destructively exercise any database. Restrict manifest access to its owner because its URL may contain disposable credentials. Do not commit it.

After verification, the driver binds all utility imports to the verified client, waits for the exported completion promise, then disconnects and releases the lock. Middleware rejects unfiltered update/delete/upsert, unsafe raw methods, non-SELECT raw SQL, known administrative side-effect SELECT functions and raw DML/DDL. Registered utilities do not use unsafe raw methods. Closing revokes the capability, including retained client references. The initial seed checks every schema model is empty; it no longer erases records to prepare a seed. Existing test fixtures are authorized only within the isolated cluster, never by their property code alone.

## Scoped Creator maintenance

The existing Creator creation capability is retained through run-maintenance.ts. It requires a reviewed plan and explicit execute. A plan pins the exact name/slug, database/user/address/port, data directory and PostgreSQL system identifier. A read-only transaction independently confirms the server before the capability is installed. An unavailable identity permission fails closed. Transport requires sslmode=require and sslaccept=strict; certificate verification is not disabled. The client permits only the existing exact Creator create shape and at most one attempt. Existing slug validation, date/anniversary calculations and uniqueness handling remain authoritative. No actual maintenance/database interoperability is claimed from mocked tests.

## Required recurring production operation

run-production-billing-cron.ts remains the existing canonical monthly-rent/late-fee operation. Its production scheduling and financial calculations were not changed or executed. It is classified separately from destructive test/repair utilities. Existing application authorization and job idempotency remain in place. Read-only diagnostic utilities may expose operational data if deliberately run; none is invoked by this validation assignment.

## Preservation and validation

Reviewed mapper/report annotations preserve emitted JavaScript. Exact preservation exceptions remain scoped to named spans; unrelated financial/session mutations still fail negative checks. JSX apostrophe entities preserve rendered text. Dashboard changes affect read refresh coordination and effect dependencies, not transaction writers or financial calculations. Original UTF-8 text is preserved.

Positive filesystem/server bootstrap tests use mocked identity responses. They demonstrate enforcement order, failed-identity cleanup, exclusive capabilities and rejection before mutation; they do not establish real PostgreSQL interoperability. Real destructive test execution requires the independent disposable cluster above. Validation uses blocked database and external networking with synthetic configuration.
