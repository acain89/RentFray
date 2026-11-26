import { openCreatorMaintenance } from "./maintenance-safety";
import { OperationalSafetyError } from "./operational-safety";
async function main() {
  const args = process.argv.slice(2), index = args.indexOf("--plan");
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--") || args.filter(value => value === "--plan").length !== 1 || args.filter(value => value === "--execute").length > 1 ||
      args.some((value, i) => i !== index + 1 && !["--plan", "--execute"].includes(value))) throw new OperationalSafetyError("MAINTENANCE_ARGUMENT_REJECTED");
  const lease = await openCreatorMaintenance(index >= 0 ? args[index + 1] : undefined, args.includes("--execute"));
  try { const operation = await import("./create-creator"); await operation.operationalCompletion; }
  finally { await lease.close(); }
}
main().catch((error: unknown) => { console.error(error instanceof OperationalSafetyError ? error.code : "MAINTENANCE_FAILED"); process.exitCode = 2; });
