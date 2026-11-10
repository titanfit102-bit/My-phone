// Fail-closed full dependency audit, including devDependencies. A05 removed the previous High
// findings, so no temporary High/Critical advisory exceptions are permitted.
// Moderate findings are reported unchanged for independent risk review.
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";

function viaIds(name, vulnerabilities, visited = new Set()) {
  if (visited.has(name)) return [];
  visited.add(name);
  const entry = vulnerabilities[name];
  if (!entry || !Array.isArray(entry.via)) return [];
  const ids = [];
  for (const item of entry.via) {
    if (typeof item === "string") {
      ids.push(...viaIds(item, vulnerabilities, visited));
      continue;
    }
    if (item && typeof item === "object") {
      if (item.severity !== "high" && item.severity !== "critical") continue;
      const match = String(item.url || "").match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i);
      ids.push(match ? match[0] : "UNKNOWN_DIRECT_ADVISORY");
    }
  }
  return [...new Set(ids)];
}

export function evaluateAudit(data) {
  if (!data || typeof data !== "object" || !data.metadata ||
      !data.metadata.vulnerabilities || !data.vulnerabilities ||
      typeof data.vulnerabilities !== "object" || Array.isArray(data.vulnerabilities))
    throw new Error("Malformed npm audit JSON — deny release, never silently skip.");
  const counts = data.metadata.vulnerabilities;
  for (const key of ["critical", "high", "moderate"]) {
    if (!Number.isSafeInteger(counts[key]) || counts[key] < 0)
      throw new Error("npm audit count missing/invalid: " + key);
  }
  const vulnerabilities = data.vulnerabilities;
  const blocking = [];
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (!entry || (entry.severity !== "high" && entry.severity !== "critical"))
      continue;
    blocking.push({package:name,severity:entry.severity,rootIds:viaIds(name,vulnerabilities)});
  }
  if (counts.critical > 0 && !blocking.some(x => x.severity === "critical")) {
    blocking.push({package:"UNEXPLAINED_CRITICAL",severity:"critical",rootIds:[]});
  }
  if (counts.high > 0 && !blocking.some(x => x.severity === "high")) {
    blocking.push({package:"UNEXPLAINED_HIGH",severity:"high",rootIds:[]});
  }
  return {
    counts,
    exceptional: [],
    blocking,
    pass:counts.critical === 0 && counts.high === 0 && blocking.length === 0
  };
}

export function auditCli() {
  const run = spawnSync("npm",["audit","--include=dev","--json"],{
    encoding:"utf8",maxBuffer:12*1024*1024,timeout:60000
  });
  if (run.error || !run.stdout) throw new Error(
    "npm audit unavailable: "+(run.error?.message||run.stderr||run.status));
  let report;
  try { report=JSON.parse(run.stdout); }
  catch { throw new Error("npm audit did not return valid JSON; fail closed."); }
  if (report.error) throw new Error("npm audit service error: "+String(report.error.code||"unknown"));
  const x=evaluateAudit(report);
  console.log("Dependency audit:",JSON.stringify({
    critical:x.counts.critical,high:x.counts.high,moderate:x.counts.moderate,
    reviewedHighPaths:0,blocked:x.blocking
  },null,2));
  if (!x.pass) process.exitCode=1;
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  auditCli();
