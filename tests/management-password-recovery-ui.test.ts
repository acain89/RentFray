import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Forgot password uses a full-document recovery anchor", () => {
  const source = readFileSync("app/login/manager/ManagerLoginClient.tsx", "utf8");
  assert.match(source, /<a[\s\S]*?href=\{[^}]*forgot-password/);
  assert.ok(!source.includes("Contact property admin to reset password."));
});
