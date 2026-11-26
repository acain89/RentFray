import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { applyReviewedClientCompatibility, reviewedClientFiles } from "./reviewed-client-compatibility.fixture";

// This immutable baseline is the separately approved production commit, never mutable HEAD.
const approved = "99fe1a44225be7b3294419fa52aaa85c2c22206e";
assert.equal(reviewedClientFiles.length, 23);
for (const file of reviewedClientFiles) test("reviewed client compatibility retains all other source boundaries: " + file, () => {
  const before = execFileSync("git", ["show", approved + ":" + file], { encoding: "utf8", windowsHide: true });
  const expected = applyReviewedClientCompatibility(file, before);
  const actual = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  assert.notEqual(expected, before.replace(/\r\n/g, "\n"));
  assert.equal(actual, expected);
  assert.throws(() => assert.equal(actual + "\n// unauthorized source mutation\n", expected));
  if (actual.includes("JSON.stringify(operation)")) {
    assert.throws(() => assert.equal(actual.replace("JSON.stringify(operation)", "JSON.stringify({})"), expected));
  }
});
