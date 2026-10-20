import { cp, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
await mkdir(output, {recursive: true});
await cp(resolve(root, "web"), output, {recursive: true, force: true});
let revision = process.env.VERCEL_GIT_COMMIT_SHA || "";
if (!revision) {
  try { revision = execFileSync("git", ["rev-parse", "HEAD"], {cwd: root, encoding: "utf8"}).trim(); }
  catch { revision = "local"; }
}
const info = {revision, builtAt: new Date().toISOString()};
await writeFile(resolve(output, "build-info.json"), JSON.stringify(info, null, 2) + "\n");
console.log("Built standalone web demo into dist/, revision " + revision);
