// Optional adapter for other web repos. Copy this script into THAT app's own repo.
// Usage: node scripts/emit-build-info.mjs dist
// For a Next.js app, run with "public" BEFORE the framework builds.
import {mkdir, writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";

const destination = process.argv[2];
if (!destination || !/^[a-zA-Z0-9_./-]+$/.test(destination) || destination.includes("..")) {
  console.error("Choose a local build directory, e.g. dist, public or build.");
  process.exit(1);
}
let revision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
if (!revision) {
  try { revision = execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(); }
  catch { revision = "local"; }
}
const folder = resolve(process.cwd(), destination);
await mkdir(folder, {recursive: true});
await writeFile(resolve(folder, "build-info.json"),
  JSON.stringify({revision, builtAt: new Date().toISOString()}, null, 2) + "\n");
console.log("Created build-info.json in " + folder);
