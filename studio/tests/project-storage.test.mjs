import test from "node:test";
import assert from "node:assert/strict";
import {BACKUP_FORMAT, MAX_BACKUP_BYTES, MAX_PROJECTS,
  validateProjectList, readProjectRegistry, writeProjectRegistry,
  serializeProjectBackup, parseProjectBackup
} from "../src/project-storage.js";
import {STORAGE_KEY, newProject, utf8ByteLength} from "../src/project-model.js";

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

const manyProjects=(n,querySize=0)=>Array.from({length:n},(_,i)=>newProject({
  name:"Test "+i,
  github:"https://github.com/example/demo",
  web:"https://demo.example.test/?id="+i+"&pad="+"x".repeat(querySize),
  native:""
},"project-"+String(i).padStart(5,"0")));

test("A06: 99 and 100 projects persist and export; 101st fails without overwriting storage",()=>{
  const saved=new Map();
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
  const ninetyNine=manyProjects(99),hundred=manyProjects(100),oneMore=manyProjects(101);
  assert.equal(validateProjectList(ninetyNine).length,99);
  assert.equal(validateProjectList(hundred).length,MAX_PROJECTS);
  assert.deepEqual(parseProjectBackup(serializeProjectBackup(hundred)),hundred);
  assert.equal(writeProjectRegistry(storage,hundred).ok,true);
  assert.throws(()=>validateProjectList(oneMore),/maksimumi 100/);
  assert.equal(writeProjectRegistry(storage,oneMore).ok,false);
  assert.deepEqual(readProjectRegistry(storage).projects,hundred);
  const changed=[...hundred];changed[50]={...changed[50],name:"Edited at limit"};
  assert.equal(validateProjectList(changed).length,100);
  assert.equal(writeProjectRegistry(storage,changed).ok,true);
  assert.equal(readProjectRegistry(storage).projects[50].name,"Edited at limit");
  assert.throws(()=>validateProjectList([...hundred,{...fixture(),id:"project-extra"}]),/maksimumi 100/);
});

test("A07: every accepted registry is exportable as a <=200000-byte backup",()=>{
  const accepted=manyProjects(100,500);
  const raw=serializeProjectBackup(accepted);
  assert.ok(utf8ByteLength(raw)<=MAX_BACKUP_BYTES);
  assert.deepEqual(parseProjectBackup(raw),accepted);
  // Each URL is individually valid, but 100 such references exceed the total export budget.
  const tooLarge=manyProjects(100,1950);
  assert.throws(()=>validateProjectList(tooLarge),/backup-it/);
  const storage={getItem:()=>null,setItem:()=>{throw Error("must not write invalid registry");}};
  assert.equal(writeProjectRegistry(storage,tooLarge).ok,false);
  assert.throws(()=>serializeProjectBackup(tooLarge),/backup-it/);
});

test("A07: parse rejects UTF-8-byte oversized files even if JS length is under limit",()=>{
  const multibyte=JSON.stringify({
    format:BACKUP_FORMAT,
    projects:[fixture()],
    note:"é".repeat(100_000)
  });
  assert.ok(multibyte.length<MAX_BACKUP_BYTES);
  assert.ok(utf8ByteLength(multibyte)>MAX_BACKUP_BYTES);
  assert.throws(()=>parseProjectBackup(multibyte),/tepër e madhe/);
});

test("A07: backup parser permits exactly 200000 UTF-8 bytes but refuses 200001",()=>{
  const base=JSON.stringify({format:BACKUP_FORMAT,projects:[fixture()],note:""});
  const exact=base.replace('"note":""','"note":"'+"a".repeat(MAX_BACKUP_BYTES-utf8ByteLength(base))+'"');
  assert.equal(utf8ByteLength(exact),MAX_BACKUP_BYTES);
  assert.deepEqual(parseProjectBackup(exact),[fixture()]);
  assert.throws(()=>parseProjectBackup(exact+"x"),/tepër e madhe/);
});
