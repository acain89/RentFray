import { existsSync, lstatSync, realpathSync, readdirSync, rmSync, cpSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
function inside(path) {
  const part = relative(root, path);
  if (!part || part.startsWith("..") || isAbsolute(part)) throw new Error("Asset path outside the repository");
}
function noLinks(path) {
  inside(path);
  if (!existsSync(path)) return;
  if (lstatSync(path).isSymbolicLink() || realpathSync(path) !== path) throw new Error("Linked build path rejected");
}
function sourceTree(path) {
  noLinks(path);
  if (lstatSync(path).isDirectory()) for (const name of readdirSync(path)) sourceTree(join(path, name));
}
function copyDir(from, to) {
  inside(from); inside(to);
  for (let parent = to; parent !== root; parent = dirname(parent)) noLinks(parent);
  for (let parent = from; parent !== root; parent = dirname(parent)) noLinks(parent);
  if (!existsSync(from)) return;
  sourceTree(from);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}
copyDir(join(root, "public"), join(root, ".next", "standalone", "public"));
copyDir(join(root, ".next", "static"), join(root, ".next", "standalone", ".next", "static"));
console.log("Standalone assets copied.");
