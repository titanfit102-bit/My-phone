// A fail-closed npm audit gate with SHORT-LIVED exceptions for unpatched upstream
// advisories. We do not fake zero vulnerabilities or downgrade Expo to pass CI.
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";

export const REVIEWED_HIGH = new Map([
  ["GHSA-vfj7-8cjw-p6xm", {package:"braces", reviewBy:"2026-11-21"}],
  ["GHSA-86w9-cpqp-85rv", {package:"node-forge", reviewBy:"2026-11-21"}]
]);
export const BASELINE_HIGH_COUNT = 15;

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
      // npm may attach a MODERATE root advisory to a HIGH transitive package.
      // Independently track HIGH/CRITICAL roots here; lower severity alone
      // must never become an unexplained high. New HIGH roots still fail.
      if (item.severity !== "high" && item.severity !== "critical") continue;
      const match = String(item.url || "").match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i);
      ids.push(match ? match[0] : "UNKNOWN_DIRECT_ADVISORY");
    }
  }
  return [...new Set(ids)];
}

export function evaluateAudit(data, today = new Date().toISOString().slice(0, 10)) {
  if (!data || typeof data !== "object" || !data.metadata ||
      !data.metadata.vulnerabilities || !data.vulnerabilities)
    throw new Error("Malformed npm audit JSON — deny release, never silently skip.");
  const counts = data.metadata.vulnerabilities;
  for (const key of ["critical", "high", "moderate"]) {
    if (!Number.isSafeInteger(counts[key]) || counts[key] < 0)
      throw new Error("npm audit count missing/invalid: " + key);
  }
  const vulnerabilities = data.vulnerabilities;
  const exceptional = [];
  const blocking = [];
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (!entry || (entry.severity !== "high" && entry.severity !== "critical"))
      continue;
    const ids = viaIds(name, vulnerabilities);
    if (entry.severity === "critical" || ids.length === 0 ||
        ids.some(id => !REVIEWED_HIGH.has(id) || today > REVIEWED_HIGH.get(id).reviewBy ||
          (name === "braces" && id !== "GHSA-vfj7-8cjw-p6xm") ||
          (name === "node-forge" && id !== "GHSA-86w9-cpqp-85rv"))) {
      blocking.push({package:name,severity:entry.severity,rootIds:ids});
    } else {
      exceptional.push({package:name,rootIds:ids});
    }
  }
  if (counts.critical > 0 && !blocking.some(x=>x.severity==="critical"))
    blocking.push({package:"UNEXPLAINED_CRITICAL",severity:"critical",rootIds:[]});
  if (counts.high > BASELINE_HIGH_COUNT)
    blocking.push({package:"BASELINE_GROWTH",severity:"high",rootIds:[],
      detail:"High findings increased above documented baseline."});
  if (counts.high > 0 && exceptional.length + blocking.length === 0)
    blocking.push({package:"UNEXPLAINED_HIGH",severity:"high",rootIds:[]});
  return {counts,exceptional,blocking,pass:blocking.length===0};
}

export function auditCli() {
  const run = spawnSync("npm",["audit","--omit=dev","--json"],{
    encoding:"utf8",maxBuffer:12*1024*1024,timeout:60000
  });
  if(run.error || !run.stdout) throw new Error(
    "npm audit unavailable: "+(run.error?.message||run.stderr||run.status));
  let report;
  try { report=JSON.parse(run.stdout); }
  catch { throw new Error("npm audit did not return valid JSON; fail closed."); }
  if (report.error) throw new Error("npm audit service error: "+String(report.error.code||"unknown"));
  const x=evaluateAudit(report);
  console.log("Dependency audit:",JSON.stringify({
    critical:x.counts.critical,high:x.counts.high,moderate:x.counts.moderate,
    reviewedHighPaths:x.exceptional.length,blocked:x.blocking
  },null,2));
  if (x.exceptional.length)
    console.warn("KNOWN HIGH RISK REMAINS: "+[...REVIEWED_HIGH.keys()].join(", ")+
      ". Temporary exceptions expire 2026-11-21. This is NOT a clean security audit.");
  if (!x.pass) process.exitCode=1;
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  auditCli();
