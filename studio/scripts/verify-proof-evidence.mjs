import {readFileSync} from "node:fs";
import {evaluateProofEvidence} from "../src/proof-evidence-gate.js";

// Strict, fail-closed CLI gate. The path is supplied by the independent proof
// producer; never mark missing, malformed, or unverified positive controls green.
try {
  if(process.argv.length!==3)throw Error("Usage: node scripts/verify-proof-evidence.mjs <report.json>");
  const report=JSON.parse(readFileSync(process.argv[2],"utf8"));
  const result=evaluateProofEvidence(report);
  console.log(JSON.stringify(result));
  if(!result.evidenceValid)process.exitCode=1;
  // The security verdict remains separate from a valid experiment.
  // A separate release gate must explicitly require releaseReady=true.
}catch(error){console.error("PROOF GATE FAILURE:",error.message);process.exitCode=1;}
