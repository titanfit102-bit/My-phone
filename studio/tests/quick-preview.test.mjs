import test from "node:test";
import assert from "node:assert/strict";
import {makeZip} from "./zip-fixtures.mjs";
import {buildQuickPreview} from "../src/quick-preview.js";

function makeBuild(method=8){
  return makeZip([
    {name:"myapp-main/dist/index.html",method,content:'<!doctype html><html><head><link rel="stylesheet" href="/assets/site.css"><script type="module" src="/assets/site.js"></script></head><body><div id="root"></div></body></html>'},
    {name:"myapp-main/dist/assets/site.css",method,content:"#root{color:teal}"},
    {name:"myapp-main/dist/assets/site.js",method,content:"document.getElementById('root').textContent='Live ZIP Quick Preview';"}
  ]);
}
test("ZIP built assets are decoded and embedded in opaque iframe HTML",async()=>{
  const result=await buildQuickPreview(makeBuild(8),"demo.zip");
  assert.match(result.srcDoc,/Live ZIP Quick Preview/);
  assert.match(result.srcDoc,/root\{color:teal\}/);
  assert.match(result.srcDoc,/localStorage/);
  assert.match(result.srcDoc,/connect-src 'none'/);
  assert.match(result.srcDoc,/frame-src 'none'/);
  assert.match(result.srcDoc,/worker-src 'none'/);
  assert.equal(result.indexPath,"myapp-main/dist/index.html");
  assert.equal(result.filename,"demo.zip");
});
test("stored ZIP entries work without compression",async()=>{
  const result=await buildQuickPreview(makeBuild(0),"stored.zip");
  assert.match(result.srcDoc,/Live ZIP Quick Preview/);
});
test("source-only GitHub ZIP cannot be rendered without a build",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/package.json",content:"{}"},{name:"repo-main/src/App.tsx",content:"React"}]),"source.zip"),/dist\/index.html/);
});
test("missing JS prevents false success",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/dist/index.html",content:'<script type="module" src="/assets/missing.js"></script>'}]),"bad.zip"),/mungon/i);
});
test("unsafe paths cannot be rendered",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/dist/index.html",content:'<script type="module" src="/../../secret.js"></script>'}]),"bad.zip"),/pasigurta/i);
});
test("multiple builds rejected until explicit selection exists",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/dist/index.html",content:""},{name:"repo-main/build/index.html",content:""}]),"multiple.zip"),/disa build/);
});
test("no external asset loading is permitted",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/dist/index.html",content:'<script type="module" src="https://evil.invalid/a.js"></script>'}]),"bad.zip"),/jashtme|pambështetura/);
});
test("built JS cannot close the sandbox document script tag",async()=>{
  const data=makeZip([{name:"repo-main/dist/index.html",content:'<script type="module" src="/assets/index.js"></script>'},
    {name:"repo-main/dist/assets/index.js",content:'console.log("</script><h1>Injected</h1>");'}]);
  const result=await buildQuickPreview(data,"esc.zip");
  assert.ok(!result.srcDoc.includes('console.log("</script>'));
});


test("multiple CSS bundles inline local images and fonts with no network access",async()=>{
  const pixel=Uint8Array.from(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/G8cAAAAASUVORK5CYII=","base64"));
  const cssMain='#root{background-image:url("../images/pixel.png");color:teal}'+
    '@font-face{font-family:demo;src:url("./demo.woff2") format("woff2")}';
  const cssExtra='.item{background:url("../images/pixel.png") center no-repeat}';
  const zip=makeZip([
    {name:"demo-main/dist/index.html",content:'<!doctype html><link rel="stylesheet" href="/assets/main.css"><link rel="stylesheet" href="/assets/extra.css"><script type="module" src="/assets/main.js"></script>'},
    {name:"demo-main/dist/assets/main.js",content:"document.getElementById('root').textContent='Advanced ZIP';"},
    {name:"demo-main/dist/assets/main.css",content:cssMain,method:8},
    {name:"demo-main/dist/assets/extra.css",content:cssExtra,method:8},
    {name:"demo-main/dist/images/pixel.png",bytes:pixel,method:8},
    {name:"demo-main/dist/assets/demo.woff2",bytes:new TextEncoder().encode("fake-font-fixture"),method:8}
  ]);
  const result=await buildQuickPreview(zip,"assets.zip");
  assert.equal(result.cssCount,2);
  assert.equal(result.localAssetCount,2,"repeated asset reference is cached");
  assert.match(result.srcDoc,/data:image\/png;base64,/);
  assert.match(result.srcDoc,/data:font\/woff2;base64,/);
  assert.match(result.srcDoc,/background-image:url\("data:image\/png/);
  assert.match(result.srcDoc,/Advanced ZIP/);
  assert.match(result.srcDoc,/connect-src 'none'/);
  assert.doesNotMatch(result.srcDoc,/url\("\.\.\/images\/pixel.png"\)/);
});

test("CSS can resolve relative dot paths but cannot escape the current Web build",async()=>{
  const intro='<script type="module" src="/assets/a.js"></script><link rel="stylesheet" href="/assets/a.css">';
  const base=[
    {name:"dist/index.html",content:intro},
    {name:"dist/assets/a.js",content:"document.getElementById('root').textContent='ok';"}
  ];
  const good=await buildQuickPreview(makeZip([...base,
    {name:"dist/assets/a.css",content:'.ok{background:url("./picture.webp")}'},
    {name:"dist/assets/picture.webp",content:"fixture"}
  ]),"good.zip");
  assert.match(good.srcDoc,/data:image\/webp;base64,/);
  await assert.rejects(buildQuickPreview(makeZip([...base,
    {name:"dist/assets/a.css",content:'.bad{background:url("../../secret.png")}'}
  ]),"traversal.zip"),/jashtë build-it/);
});

test("missing, external and unsupported CSS assets fail closed",async()=>{
  const base=[
    {name:"app-main/dist/index.html",content:'<script type="module" src="/assets/a.js"></script><link rel="stylesheet" href="/assets/a.css">'},
    {name:"app-main/dist/assets/a.js",content:"console.log('ready')"}
  ];
  for(const [css,message] of [
    ['.a{background:url("./missing.png")}',/mungon/],
    ['.a{background:url("https://evil.invalid/track.png")}',/pambështetura/],
    ['.a{background:url("./unsafe.svg")}',/pambështetur/],
    ['@import url("https://evil.invalid/style.css");',/@import/],
    ['.a{background:url("data:text/html;base64,PGgxPkE8L2gxPg==")}',/data URL/]
  ]){
    const zip=makeZip([...base,{name:"app-main/dist/assets/a.css",content:css}]);
    await assert.rejects(buildQuickPreview(zip,"unsafe.zip"),message);
  }
});

test("stylesheet count and individual asset size are bounded",async()=>{
  const header='<script type="module" src="/assets/app.js"></script>';
  const bundles=[{name:"dist/assets/app.js",content:"console.log('ok')"}];
  const five=makeZip([
    {name:"dist/index.html",content:header+
      Array.from({length:5},(_,i)=>'<link rel="stylesheet" href="/assets/style'+i+'.css">').join("")},
    ...bundles,
    ...Array.from({length:5},(_,i)=>({name:"dist/assets/style"+i+".css",content:"body{color:black}"}))
  ]);
  await assert.rejects(buildQuickPreview(five,"many-css.zip"),/katër CSS/);
  const oversized=makeZip([
    {name:"dist/index.html",content:header+'<link rel="stylesheet" href="/assets/style.css">'},
    ...bundles,
    {name:"dist/assets/style.css",content:"body{background:url('./large.png')}"},
    {name:"dist/assets/large.png",content:"A".repeat(512*1024+1),method:8}
  ]);
  await assert.rejects(buildQuickPreview(oversized,"large.zip"),/tepër i madh/);
});

test("local CSS asset count is limited to prevent unbounded embedded payloads",async()=>{
  const references=Array.from({length:25},(_,i)=>'.x'+i+'{background:url("./img'+i+'.png")}').join("\n");
  const items=[
    {name:"dist/index.html",content:'<script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css">'},
    {name:"dist/assets/main.js",content:"console.log('ok')"},
    {name:"dist/assets/main.css",content:references},
    ...Array.from({length:25},(_,i)=>({name:"dist/assets/img"+i+".png",content:"fixture"}))
  ];
  await assert.rejects(buildQuickPreview(makeZip(items),"many-assets.zip"),/numrin e asset-eve/);
});

test("repeated cached asset references cannot amplify generated CSS beyond 8 MiB",async()=>{
  const css=Array.from({length:7},(_,i)=>'.x'+i+'{background:url("./large.png")}').join("\n");
  const files=[
    {name:"dist/index.html",content:'<script src="/assets/main.js"></script><link rel="stylesheet" href="/assets/a.css"><link rel="stylesheet" href="/assets/b.css">'},
    {name:"dist/assets/main.js",content:"console.log('ok')"},
    {name:"dist/assets/a.css",content:css},
    {name:"dist/assets/b.css",content:css},
    {name:"dist/assets/large.png",bytes:new Uint8Array(512*1024),method:8}
  ];
  await assert.rejects(buildQuickPreview(makeZip(files),"amplification.zip"),/CSS.*gjeneruar.*kufirin/);
});

test("HTML style-tag escaping is included in the generated CSS budget",async()=>{
  const css='.x{background:url("./large.png")}\n'.repeat(11)+
    '/*'+'</style'.repeat(98000)+'*/';
  await assert.rejects(buildQuickPreview(makeZip([
    {name:"dist/index.html",content:'<script src="/assets/main.js"></script><link rel="stylesheet" href="/assets/a.css">'},
    {name:"dist/assets/main.js",content:"console.log('ok')"},
    {name:"dist/assets/a.css",content:css,method:8},
    {name:"dist/assets/large.png",bytes:new Uint8Array(512*1024),method:8}
  ])),/CSS.*gjeneruar.*kufirin/);
});

test("aggregate extracted asset bytes and CSS source bytes remain bounded",async()=>{
  const base=[
    {name:"dist/index.html",content:'<script src="/assets/main.js"></script><link rel="stylesheet" href="/assets/a.css"><link rel="stylesheet" href="/assets/b.css">'},
    {name:"dist/assets/main.js",content:"console.log('ok')"}
  ];
  await assert.rejects(buildQuickPreview(makeZip([...base,
    {name:"dist/assets/a.css",content:"/*"+"x".repeat(1024*1024)+"*/",method:8},
    {name:"dist/assets/b.css",content:"/*"+"x".repeat(1024*1024)+"*/",method:8}
  ])),/CSS.*madhësinë totale/);
  await assert.rejects(buildQuickPreview(makeZip([...base,
    {name:"dist/assets/a.css",content:Array.from({length:7},(_,i)=>'.x'+i+'{background:url("./img'+i+'.png")}').join("")},
    {name:"dist/assets/b.css",content:"body{}"},
    ...Array.from({length:7},(_,i)=>({name:'dist/assets/img'+i+'.png',bytes:new Uint8Array(512*1024),method:8}))
  ])),/CSS.*madhësinë totale të asset-eve/);
});

test("corrupted stored bytes and forged deflated CRC fail integrity validation",async()=>{
  const files=[
    {name:"dist/index.html",content:'<script src="/assets/main.js"></script>'},
    {name:"dist/assets/main.js",content:"console.log('original')"}
  ];
  const stored=makeZip(files);
  // Change a JS string literal without updating its checksums or breaking syntax.
  const bytes=new Uint8Array(stored),position=Buffer.from(stored).indexOf("original");
  bytes[position]^=1;
  await assert.rejects(buildQuickPreview(stored),/CRC/);
  const deflated=makeZip(files.map(f=>({...f,method:8}))),d=new DataView(deflated);
  const cd=d.getUint32(deflated.byteLength-6,true);
  d.setUint32(14,0xffffffff,true);d.setUint32(cd+16,0xffffffff,true);
  await assert.rejects(buildQuickPreview(deflated),/CRC/);
});

test("selected local headers must match central flags and sizes",async()=>{
  const make=()=>makeZip([
    {name:"dist/index.html",content:'<script src="/assets/main.js"></script>'},
    {name:"dist/assets/main.js",content:"console.log('ok')"}
  ]);
  const flags=make();new DataView(flags).setUint16(6,1,true);
  await assert.rejects(buildQuickPreview(flags),/local header/);
  const size=make();new DataView(size).setUint32(22,1,true);
  await assert.rejects(buildQuickPreview(size),/local header/);
});

test("deflate output cannot exceed a forged declared size",async()=>{
  const zip=makeZip([
    {name:"dist/index.html",content:'<script src="/assets/main.js"></script>'},
    {name:"dist/assets/main.js",content:"A".repeat(1024*1024),method:8,size:1}
  ]);
  await assert.rejects(buildQuickPreview(zip),/tejkalon|nuk përputhet/);
});

test("valid streaming ZIP data descriptors remain compatible",async()=>{
  const zip=makeZip([
    {name:"dist/index.html",content:'<script src="/assets/main.js"></script>',method:8,flags:8},
    {name:"dist/assets/main.js",content:"console.log('descriptor build')",method:8,flags:8}
  ]);
  const result=await buildQuickPreview(zip);
  assert.match(result.srcDoc,/descriptor build/);
});

test("selected entry payload cannot overlap the central directory",async()=>{
  const zip=makeZip([
    {name:"dist/index.html",content:'<script src="/assets/main.js"></script>'},
    {name:"dist/assets/main.js",content:"console.log('ok')"}
  ]),d=new DataView(zip);
  const cd=d.getUint32(zip.byteLength-6,true);
  const forged=cd+1-(30+d.getUint16(26,true));
  d.setUint32(18,forged,true);d.setUint32(22,forged,true);
  d.setUint32(cd+20,forged,true);d.setUint32(cd+24,forged,true);
  await assert.rejects(buildQuickPreview(zip),/prerë/);
});
