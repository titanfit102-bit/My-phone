import {execFileSync} from "node:child_process";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";

let revision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
if (!revision) {
  try {revision = execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();}
  catch {revision = "local"; }
}
if (!/^[A-Za-z0-9._-]{1,128}$/.test(revision)) throw Error("Invalid build revision");
const output = resolve(import.meta.dirname,"../dist");
await mkdir(output,{recursive:true});
await writeFile(resolve(output,"build-info.json"),
  JSON.stringify({revision,builtAt:new Date().toISOString()},null,2)+"\n");
console.log("Deployment metadata written to dist/build-info.json");
