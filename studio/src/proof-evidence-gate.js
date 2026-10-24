// A04: separate experimental observations from *evidence quality* and release risk.
// A green workflow is not equivalent to successful security validation.
export const PROOF_FORMAT="my-phone-proof-evidence-v1";
export const REQUIRED_CONTROLS=["nominal-observation","deliberate-fault-detected"];

export function evaluateProofEvidence(report) {
  const problems=[];
  if(!report || typeof report!=="object" || Array.isArray(report) ||
     report.format!==PROOF_FORMAT) problems.push("invalid evidence format");
  if(report?.experimentExecuted!==true)
    problems.push("experiment execution not confirmed");
  const controls=Array.isArray(report?.controls)?report.controls:[];
  const names=new Set();
  for(const c of controls){
    if(!c || typeof c.name!=="string" || names.has(c.name) ||
       typeof c.passed!=="boolean") {
      problems.push("invalid or duplicate positive control");
      continue;
    }
    names.add(c.name);
  }
  for(const required of REQUIRED_CONTROLS){
    const c=controls.find(x=>x?.name===required);
    if(!c || c.passed!==true)problems.push("missing or failed positive control: "+required);
  }
  const observations=Array.isArray(report?.observations)?report.observations:[];
  if(!Array.isArray(report?.observations))problems.push("missing observations array");
  for(const ob of observations)
    if(!ob || typeof ob.name!=="string" || typeof ob.status!=="string")
      problems.push("malformed security observation");
  if(observations.length===0)problems.push("no security observations provided");
  const evidenceValid=problems.length===0;
  const securityConcern=observations.some(o=>["FAIL","CRITICAL_LEAK","UNEXPECTED_RENDER"].includes(o?.status));
  // A correct experiment can discover a vulnerability; no set of synthetic
  // observations on its own authorizes production release.
  const securityReview=securityConcern?"FINDING_REQUIRES_REVIEW":"NO_RECORDED_FAILURE";
  return {evidenceValid,securityConcern,securityReview,
    problems,observationsCount:observations.length};
}
