// Include the shared PWA regressions in the existing TypeScript test command.
import { createRequire } from "node:module";
createRequire(import.meta.url)("./pwa-installation.test.mjs");
