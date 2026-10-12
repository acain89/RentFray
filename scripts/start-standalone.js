/* eslint-disable @typescript-eslint/no-require-imports -- The standalone Node launcher is CommonJS. */
const path = require("node:path");

async function start() {
  const standalone = path.resolve(__dirname, "../.next/standalone");
  require("next/dist/server/node-environment");
  const hook = require(path.resolve(standalone, ".next/server/instrumentation.js"));
  if (typeof hook.register !== "function") {
    throw new Error("Missing compiled session validator.");
  }
  await hook.register();
  require(path.resolve(standalone, "server.js"));
}

start().catch(() => {
  console.error("RentFray startup failed: session configuration could not be validated.");
  process.exitCode = 1;
});
