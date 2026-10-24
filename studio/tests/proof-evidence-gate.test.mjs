import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {evaluateProofEvidence,PROOF_FORMAT} from "../src/proof-evidence-gate.js";

const good=()=>({format:PROOF_FORMAT,experimentExecuted:true,controls:[
  {name:"nominal-observation",passed:true},
  {name:"deliberate-fault-detected",passed:true}
],observations:[{name:"synthetic capability",status:"PASS"}]});

test("A04: valid experiment and security verdict are separate axes",()=>{
  const normal=evaluateProofEvidence(good());
  assert.deepEqual({evidenceValid:normal.evidenceValid,securityConcern:normal.securityConcern,
    releaseReady:normal.releaseReady},{evidenceValid:true,securityConcern:false,releaseReady:true});
  const critical=good();critical.observations[0].status="CRITICAL_LEAK";
  const leak=evaluateProofEvidence(critical);
  assert.equal(leak.evidenceValid,true);
  assert.equal(leak.securityConcern,true);
  assert.equal(leak.releaseReady,false);
});

test("A04: missing, duplicated or failed deliberate-fault positives fail closed",()=>{
  const variants=[
    {...good(),controls:[good().controls[0]]},
    {...good(),controls:[good().controls[0],{name:"deliberate-fault-detected",passed:false}]},
    {...good(),controls:[...good().controls,good().controls[0]]},
    {...good(),experimentExecuted:false},
    {...good(),observations:null},
    {...good(),format:"wrong"}
  ];
  for(const bad of variants)assert.equal(evaluateProofEvidence(bad).evidenceValid,false);
});

test("A04: actual process exit code fails on injected bad controls and missing proof",()=>{
  const dir=mkdtempSync(join(tmpdir(),"my-phone-proof-evidence-"));
  const run=report=>{
    const path=join(dir,"proof.json");
    writeFileSync(path,JSON.stringify(report));
    return spawnSync(process.execPath,["scripts/verify-proof-evidence.mjs",path],
      {encoding:"utf8",cwd:new URL("..",import.meta.url).pathname});
  };
  try{
    const positive=run(good());
    assert.equal(positive.status,0,positive.stderr);
    for(const fault of [
      {...good(),controls:[{name:"nominal-observation",passed:true}]},
      {...good(),controls:[{name:"nominal-observation",passed:true},
        {name:"deliberate-fault-detected",passed:false}]},
      {...good(),experimentExecuted:false}
    ]){
      const out=run(fault);
      assert.notEqual(out.status,0,"fault injection must fail the process, not merely note FAIL");
      assert.match(out.stdout,/evidenceValid":false/);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
