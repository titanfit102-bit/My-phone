import test from "node:test";
import assert from "node:assert/strict";
import {BACKUP_FORMAT, MAX_BACKUP_BYTES, MAX_PROJECTS,
  validateProjectList, readProjectRegistry, writeProjectRegistry,
  serializeProjectBackup, parseProjectBackup
} from "../src/project-storage.js";
import {STORAGE_KEY, newProject} from "../src/project-model.js";

const fixture=()=>newProject({
  name:"Demo Test",github:"https://github.com/example/demo",
  web:"https://demo.example.test",native:""
},"project-demo-test");

test("empty storage is writable and save/restore round-trips",()=>{
  const values=new Map();
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  assert.deepEqual(readProjectRegistry(storage),{ok:true,projects:[],reason:null});
  assert.equal(writeProjectRegistry(storage,[fixture()]).ok,true);
  assert.deepEqual(readProjectRegistry(storage).projects,[fixture()]);
});
test("read failures and unavailable localStorage cannot silently mark registry writable",()=>{
  assert.equal(readProjectRegistry(null).ok,false);
  const blocked={getItem:()=>{throw Error("SecurityError");},setItem:()=>{throw Error("SecurityError");}};
  assert.equal(readProjectRegistry(blocked).reason,"unreadable");
  assert.equal(writeProjectRegistry(blocked,[fixture()]).ok,false);
});
test("invalid registry is preserved rather than rewritten with an empty list",()=>{
  const saved="{old broken registry";
  let overwritten=false;
  const storage={getItem:()=>saved,setItem:()=>{overwritten=true;}};
  const status=readProjectRegistry(storage);
  assert.equal(status.ok,false);
  assert.equal(status.reason,"unreadable");
  assert.equal(overwritten,false);
});
test("corrupt entries or duplicate IDs are never silently discarded during bootstrap",()=>{
  const p=fixture();
  for(const candidates of [[p,p],[p,{bad:true}],{projects:[p]},new Array(MAX_PROJECTS+1).fill(p)]) {
    const storage={getItem:()=>JSON.stringify(candidates)};
    assert.equal(readProjectRegistry(storage).ok,false);
  }
});
test("quota failure is propagated and existing values are not deleted",()=>{
  const storage={getItem:()=>JSON.stringify([fixture()]),setItem:()=>{throw Error("QuotaExceededError");}};
  assert.equal(readProjectRegistry(storage).ok,true);
  assert.equal(writeProjectRegistry(storage,[]).reason,"write_failed");
  assert.deepEqual(readProjectRegistry(storage).projects,[fixture()]);
});
test("backup JSON accepts validated projects and preserves identifiers",()=>{
  const text=serializeProjectBackup([fixture()]);
  const parsed=JSON.parse(text);
  assert.equal(parsed.format,BACKUP_FORMAT);
  assert.equal(parsed.projects.length,1);
  assert.deepEqual(parseProjectBackup(text),[fixture()]);
});
test("untrusted backup data is rejected in full",()=>{
  const p=fixture();
  const bad=[
    "{}","not-json",JSON.stringify({format:"other",projects:[p]}),
    JSON.stringify({format:BACKUP_FORMAT,projects:[p,p]}),
    JSON.stringify({format:BACKUP_FORMAT,projects:[{...p,web:"javascript:alert(1)"}]}),
    JSON.stringify({format:BACKUP_FORMAT,projects:[p,{bad:true}]}),
    JSON.stringify({format:BACKUP_FORMAT,projects:new Array(MAX_PROJECTS+1).fill(p)}),
    "x".repeat(MAX_BACKUP_BYTES+1)
  ];
  for(const example of bad) assert.throws(()=>parseProjectBackup(example));
});
test("valid registry never contains secret-shaped malformed URLs",()=>{
  const invalid={...fixture(),github:"https://u:secret@github.com/example/demo"};
  assert.throws(()=>validateProjectList([invalid]));
  assert.equal(STORAGE_KEY,"my-phone-studio-projects-v1");
});
