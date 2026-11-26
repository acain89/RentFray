import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { disposableOperations, operationName, openDisposableUtility, OperationalSafetyError, isRecord } from "./operational-safety";

async function main() {
  const args = process.argv.slice(2), operation = operationName(args[0]);
  const flags = args.slice(1);
  if (flags.filter(value => value === "--manifest").length > 1 || flags.filter(value => value === "--execute").length > 1) throw new OperationalSafetyError("AMBIGUOUS_OPERATION_ARGUMENTS");
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === "--manifest") { i++; continue; }
    if (flags[i] === "--execute" || operation === "qa-audit" && /^(?:--stress|--all-presets|--months=[1-9][0-9]*|--units=[1-9][0-9]*|--preset=(?:default|small-landlord|average-apartment|high-delinquency))$/.test(flags[i])) continue;
    throw new OperationalSafetyError("OPERATION_ARGUMENT_REJECTED");
  }
  const index = args.indexOf("--manifest");
  if (index >= 0 && (!args[index + 1] || args[index + 1].startsWith("--"))) throw new OperationalSafetyError("DISPOSABLE_MANIFEST_REQUIRED");
  const lease = await openDisposableUtility(operation, index >= 0 ? args[index + 1] : process.env.RF_DISPOSABLE_MANIFEST, args.includes("--execute"));
  try {
    const loaded: unknown = await import(pathToFileURL(resolve(__dirname, "..", disposableOperations[operation].module)).href);
    const exports = isRecord(loaded) && isRecord(loaded.default) ? loaded.default : loaded;
    if (!isRecord(exports) || !isRecord(exports.operationalCompletion) || typeof exports.operationalCompletion.then !== "function") {
      throw new OperationalSafetyError("UTILITY_COMPLETION_NOT_EXPORTED");
    }
    await exports.operationalCompletion;
  }
  finally { await lease.close(); }
}
main().catch((error: unknown) => {
  console.error(error instanceof OperationalSafetyError ? error.code : "OPERATIONAL_EXECUTION_FAILED");
  process.exitCode = 2;
});
