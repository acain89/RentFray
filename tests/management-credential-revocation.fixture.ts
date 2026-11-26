import { restoreVerifiedEmailNarrowing } from "./reviewed-application.fixture";

import assert from "node:assert/strict";

import { fixture as authorityFixture } from "./admin-session-revalidation.fixture";



export const credentialA = "$2b$synthetic-credential-A";
export const credentialB = "$2b$synthetic-credential-B";
export function bound(role = "OWNER") {
  const f = authorityFixture();
  f.state.management = { id: "m", role, propertyId: "p", isActive: true, passwordHash: credentialA };
  const binding = f.session.createManagementCredentialBinding("m", credentialA);
  const claims = { role, propertyId: "p", managementUserId: "m", managementCredentialBinding: binding };
  const token = f.session.createSessionToken(claims); f.values.set("rf_session", token);
  return { ...f, claims, managementToken: token, binding };
}

export function restoreApprovedSessionConfiguration(before: string, after: string): string {
  const approved = "function getSessionSecret(): string {\n  const secret = process.env.SESSION_SECRET;\n  if (\n    typeof secret !== \"string\" ||\n    secret.trim().length === 0 ||\n    Buffer.byteLength(secret, \"utf8\") < 32 ||\n    secret === \"rentfray-dev-session-secret-change-me\"\n  ) {\n    throw new Error(\"Invalid session configuration.\");\n  }\n  return secret;\n}\n\nexport function validateSessionConfiguration(): void {\n  getSessionSecret();\n}\n\n";
  const original = "function getSessionSecret() {\n  return process.env.SESSION_SECRET || \"rentfray-dev-session-secret-change-me\";\n}\n\n";
  assert.equal(after.split(approved).length, 2, "Exactly one fail-closed AUD-02 validator must remain present");
  return before.replace(/\r\n/g, "\n").includes(approved) ? after : after.replace(approved, original);
}
export function assertApprovedSessionConfigurationChange(before: string, after: string): void {
  assert.equal(restoreApprovedSessionConfiguration(before, after.replace(/\r\n/g, "\n")), before.replace(/\r\n/g, "\n"),
    "Only the exact AUD-02 secret validator may differ; all session authority remains preserved");
}

// Reverse only the exact RF-15 additions, then retain whole-source equality.
export function assertApprovedCredentialChange(file: string, before: string, after: string) {
  let restored = after.replace(/\r\n/g, "\n"); const original = before.replace(/\r\n/g, "\n");
  if (file === "lib/session.ts") {
    restored = restoreApprovedSessionConfiguration(original, restored);
    restored = restored.replace(/export function createManagementCredentialBinding[\s\S]*?\n}\n\nfunction isManagementCredentialBinding[\s\S]*?\n}\n\n/, "");
    restored = restored.replace(/^  managementCredentialBinding\?: string;\n/m, "").replace(/^      managementCredentialBinding: string;\n/m, "");
    restored = restored.replace('isNonEmptyString(parsed.managementUserId) &&\n      isManagementCredentialBinding(parsed.managementCredentialBinding)', 'isNonEmptyString(parsed.managementUserId)');
    restored = restored.replace('      if (!isManagementCredentialBinding(input.managementCredentialBinding)) {\n        throw new Error("Invalid management session.");\n      }\n', "");
    restored = restored.replace('        managementCredentialBinding: input.managementCredentialBinding,\n', "");
    restored = restored.replace('      ...((parsed.role === "OWNER" || parsed.role === "MANAGER" || parsed.role === "STAFF")\n        ? { managementCredentialBinding: parsed.managementCredentialBinding }\n        : {}),\n', "");
    restored = restored.replace('!isNonEmptyString(session.propertyId) ||\n      !isManagementCredentialBinding(session.managementCredentialBinding)', '!isNonEmptyString(session.propertyId)');
    const start = restored.indexOf("async function hasCurrentManagementAuthority"); const end = restored.indexOf("async function hasCurrentTenantAuthority", start);
    const current = restored.slice(start, end).replace('        passwordHash: true,\n', "").replace('      user.id === session.managementUserId &&\n', "").replace('user.role === session.role &&\n      isNonEmptyString(user.passwordHash) &&\n      safeEqual(session.managementCredentialBinding, createManagementCredentialBinding(user.id, user.passwordHash))', 'user.role === session.role');
    restored = restored.slice(0, start) + current + restored.slice(end);
    restored = restored.replace('      managementCredentialBinding: session.managementCredentialBinding!,\n', "");
    assert.match(after, /safeEqual\(session\.managementCredentialBinding, createManagementCredentialBinding\(user\.id, user\.passwordHash\)\)/);
    assert.match(after, /managementCredentialBinding: session\.managementCredentialBinding!/);
  } else if (file === "app/api/auth/verify-email/route.ts") {
    restored = restoreVerifiedEmailNarrowing(restored);
    restored = restored.replace('createSessionToken, createManagementCredentialBinding, setSessionCookie', 'createSessionToken, setSessionCookie');
    restored = restored.replace('emailVerifiedAt: true, passwordHash: true,', 'emailVerifiedAt: true,');
    restored = restored.replace('      managementCredentialBinding: createManagementCredentialBinding(manager.id, manager.passwordHash),\n', "");
  } else throw Error("Unsupported RF-15 source guard " + file);
  assert.equal(restored.replace(/\n$/, ""), original.replace(/\n$/, ""), "Only approved RF-15 credential additions may differ: " + file);
}
