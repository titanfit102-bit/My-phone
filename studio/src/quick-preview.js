import {inspectZip} from "./zip-inspector.js";
// Offline preview only: one prebuilt JS bundle, multiple local CSS files and bounded raster/font assets.
// No source ZIP execution in the Studio origin, network access or unbounded extraction.
const MAX_HTML=256*1024, MAX_JS=8*1024*1024, MAX_CSS_TOTAL=2*1024*1024;
const MAX_STYLESHEETS=4, MAX_LOCAL_ASSETS=24, MAX_ASSET_BYTES=512*1024;
const MAX_TOTAL_ASSET_BYTES=3*1024*1024;
// Count every replacement, including cache hits: a small stylesheet can repeat
// one large data URI thousands of times despite a bounded unique-asset cache.
const MAX_EMBEDDED_CSS_BYTES=8*1024*1024;
const encoder=new TextEncoder();
const MIME_BY_EXT={
  png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",
  webp:"image/webp",avif:"image/avif",woff:"font/woff",woff2:"font/woff2",
  ttf:"font/ttf",otf:"font/otf"
};
const decoder=new TextDecoder("utf-8",{fatal:true});
const u16=(v,p)=>v.getUint16(p,true),u32=(v,p)=>v.getUint32(p,true);
const reject=message=>{throw Error(message);};
const crcTable=Uint32Array.from({length:256},(_,i)=>{
  let value=i;
  for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
  return value>>>0;
});
function verifyCrc(bytes,expected){
  let crc=0xffffffff;
  for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&255];
  if(((crc^0xffffffff)>>>0)!==expected)reject("CRC ZIP nuk përputhet.");
  return bytes;
}

function entries(buffer){
  inspectZip(buffer,"selected.zip"); // Reject malicious ZIP metadata first.
  const view=new DataView(buffer),len=view.byteLength;
  let end=-1;
  for(let i=len-22;i>=Math.max(0,len-22-65535);i--){
    if(u32(view,i)===0x06054b50&&i+22+u16(view,i+20)===len){end=i;break;}
  }
  if(end<0)reject("Nuk u gjet indeksi ZIP.");
  const dataEnd=u32(view,end+16);
  let p=dataEnd;
  const entries=new Map(), count=u16(view,end+10);
  for(let i=0;i<count;i++){
    if(p+46>len||u32(view,p)!==0x02014b50)reject("Indeksi ZIP i dëmtuar.");
    const n=u16(view,p+28),ex=u16(view,p+30),comment=u16(view,p+32);
    if(p+46+n+ex+comment>len)reject("Indeksi ZIP i prerë.");
    const name=decoder.decode(new Uint8Array(buffer,p+46,n));
    if(!name.endsWith("/"))entries.set(name,{name,method:u16(view,p+10),
      flags:u16(view,p+8),crc:u32(view,p+16),dataEnd,
      packed:u32(view,p+20),size:u32(view,p+24),offset:u32(view,p+42)});
    p+=46+n+ex+comment;
  }
  return entries;
}
function locateAsset(index,url){
  if(!url||url.startsWith("//")||/^[a-z][a-z0-9+.-]*:/i.test(url)||
     /[?#\\]/.test(url))reject("Build-i ka lidhje asset-esh të pambështetura.");
  const prefix=index.slice(0,index.lastIndexOf("/")+1);
  const parts=(url.startsWith("/")?url.slice(1):url).split("/");
  if(parts.some(s=>s===".."||s==="."||!s))reject("Build-i ka rrugë asset-esh të pasigurta.");
  return prefix+parts.join("/");
}
function getAttribute(html,tag,attribute){
  const re=new RegExp("<"+tag+"\\b[^>]*>","gi");
  return [...html.matchAll(re)].map(([match])=>{
    const value=match.match(new RegExp("\\b"+attribute+"\\s*=\\s*[\"']([^\"']+)[\"']","i"));
    return value?.[1]??"";
  }).filter(Boolean);
}
async function getBytes(buffer,entry,limit){
  if(!entry||entry.size>limit)reject("Asset-i i Web-it mungon ose është tepër i madh.");
  const d=new DataView(buffer),p=entry.offset;
  if(p+30>entry.dataEnd||u32(d,p)!==0x04034b50||
      u16(d,p+8)!==entry.method||u16(d,p+6)!==entry.flags)
    reject("ZIP local header i dëmtuar.");
  // With data descriptors, CRC/sizes may be zero in the local header. The
  // central directory and actual decompressed bytes still remain authoritative.
  for(const [offset,expected] of [[14,entry.crc],[18,entry.packed],[22,entry.size]]){
    const value=u32(d,p+offset);
    if(value!==expected&&(!(entry.flags&8)||value!==0))
      reject("ZIP local header nuk përputhet me indeksin.");
  }
  const n=u16(d,p+26),ex=u16(d,p+28);
  const start=p+30+n+ex;
  if(start+entry.packed>entry.dataEnd)reject("Asset-i ZIP është i prerë.");
  if(decoder.decode(new Uint8Array(buffer,p+30,n))!==entry.name)
    reject("Emri i ZIP nuk përputhet.");
  const bytes=new Uint8Array(buffer,start,entry.packed);
  if(entry.method===0){
    if(bytes.length!==entry.size)reject("Madhësia ZIP nuk përputhet.");
    return verifyCrc(new Uint8Array(bytes),entry.crc);
  }
  if(entry.method!==8||typeof DecompressionStream!=="function")
    reject("ZIP Deflate nuk mbështetet në këtë shfletues.");
  let reader;
  try{
    reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const chunks=[];let total=0;
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.length;
      if(total>Math.min(limit,entry.size)){
        await reader.cancel();reject("Asset-i tejkalon kufirin ose madhësinë e deklaruar.");
      }
      chunks.push(value);
    }
    if(total!==entry.size)reject("Madhësia ZIP nuk përputhet.");
    const out=new Uint8Array(total);let i=0;
    for(const part of chunks){out.set(part,i);i+=part.length;}
    return verifyCrc(out,entry.crc);
  }catch(e){if(/tejkalon|nuk përputhet/.test(String(e)))throw e;
    reject("ZIP nuk mund të çkompresohet.");
  }finally{try{reader?.releaseLock();}catch{}}
}

function resolveCssAsset(index,stylesheet,url){
  if (!url || url.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(url) ||
      /[?#\\%]/.test(url)) reject("CSS ka lidhje asset-esh të pambështetura.");
  const root=index.slice(0,index.lastIndexOf("/")+1).split("/").filter(Boolean);
  const base=url.startsWith("/") ? [...root] : stylesheet.split("/").slice(0,-1);
  const segments=url.replace(/^\/+/,"").split("/");
  for (const segment of segments){
    if (!segment || segment==="." ){if(!segment)reject("CSS ka rrugë të pavlefshme.");continue;}
    if(segment===".."){
      if(base.length<=root.length) reject("CSS ka rrugë jashtë build-it.");
      base.pop();
    }else base.push(segment);
  }
  if (base.length<=root.length || !root.every((part,i)=>base[i]===part))
    reject("CSS ka rrugë jashtë build-it.");
  return base.join("/");
}
function toBase64(bytes){
  let text="";
  for(let i=0;i<bytes.length;i+=16384)
    text+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(text);
}
async function inlineCssReferences(css,stylesheet,index,all,buffer,cache,budget){
  if(/@import\b/i.test(css))
    reject("CSS @import nuk mbështetet në preview offline.");
  const ref=/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
  let output="",position=0;
  const append=text=>{
    text=escapeTag(text,"style");
    budget.cssBytes+=encoder.encode(text).length;
    if(budget.cssBytes>MAX_EMBEDDED_CSS_BYTES)
      reject("CSS i gjeneruar tejkalon kufirin 8 MiB.");
    output+=text;
  };
  for(const match of css.matchAll(ref)){
    const value=(match[1]??match[2]??match[3]??"").trim();
    append(css.slice(position,match.index));
    position=match.index+match[0].length;
    if(value.startsWith("#")){append(match[0]);continue;}
    if(value.startsWith("data:")){
      if(!/^data:(?:image\/(?:png|jpeg|gif|webp|avif)|font\/(?:woff2?|ttf|otf));base64,[A-Za-z0-9+/=]+$/i.test(value))
        reject("CSS data URL i pambështetur.");
      append(match[0]);continue;
    }
    const path=resolveCssAsset(index,stylesheet,value);
    const extension=path.split(".").at(-1)?.toLowerCase();
    const mime=MIME_BY_EXT[extension];
    if(!mime)reject("CSS kërkon një asset të pambështetur: "+extension);
    let uri=cache.get(path);
    if(!uri){
      if(cache.size>=MAX_LOCAL_ASSETS)
        reject("CSS tejkalon numrin e asset-eve lokale.");
      const file=all.get(path);
      if(!file)reject("CSS kërkon një asset që mungon.");
      const bytes=await getBytes(buffer,file,MAX_ASSET_BYTES);
      if(budget.bytes+bytes.length>MAX_TOTAL_ASSET_BYTES)
        reject("CSS tejkalon madhësinë totale të asset-eve.");
      budget.bytes+=bytes.length;
      uri="data:"+mime+";base64,"+toBase64(bytes);
      cache.set(path,uri);
    }
    append('url("'+uri+'")');
  }
  append(css.slice(position));
  return output;
}

const escapeTag=(s,tag)=>s.replace(new RegExp("</"+tag,"gi"),"<\\/"+tag);
// Sandbox origin is opaque. This virtual storage exists only for the iframe lifetime.
const sessionStorageShim= [
  "(()=>{const create=()=>{const m=new Map();return {",
  "get length(){return m.size;},key:i=>Array.from(m.keys())[i]??null,",
  "getItem:k=>m.has(String(k))?m.get(String(k)):null,",
  "setItem:(k,v)=>m.set(String(k),String(v)),",
  "removeItem:k=>m.delete(String(k)),clear:()=>m.clear()};};",
  "for(const k of ['localStorage','sessionStorage'])",
  "try{Object.defineProperty(window,k,{value:create(),configurable:false});}catch{}",
  "})();"
].join("");
export async function buildQuickPreview(buffer,filename="preview.zip"){
  const all=entries(buffer);
  const indexes=[...all.keys()].filter(x=>/(^|\/)(dist|build|out)\/index\.html$/i.test(x));
  if(indexes.length!==1)reject(indexes.length?"ZIP ka disa build-e Web.":"Nuk gjendet dist/index.html (ose build/out). Ngarko ZIP me build Web të gatshëm.");
  const index=indexes[0];
  const html=decoder.decode(await getBytes(buffer,all.get(index),MAX_HTML));
  const js=getAttribute(html,"script","src");
  const css=getAttribute(html,"link","href").filter(x=>/\.css(?:$|[?#])/i.test(x));
  if(js.length!==1||!js[0].endsWith(".js")||css.length>MAX_STYLESHEETS)
    reject("Quick Preview mbështet vetëm build Vite me një bundle JS dhe maksimumi katër CSS lokale.");
  const jsPath=locateAsset(index,js[0]);
  const code=decoder.decode(await getBytes(buffer,all.get(jsPath),MAX_JS));
  const cache=new Map(),budget={bytes:0,cssBytes:0};
  const styles=[];let totalCssBytes=0;
  for (const url of css){
    const path=locateAsset(index,url);
    const file=all.get(path);
    if(!file)reject("Mungon një CSS e referuar në Web build.");
    totalCssBytes+=file.size;
    if(totalCssBytes>MAX_CSS_TOTAL)reject("CSS tejkalon madhësinë totale të lejuar.");
    const source=decoder.decode(await getBytes(buffer,file,MAX_CSS_TOTAL));
    if(styles.length)budget.cssBytes+=1; // The separator in styles.join("\n").
    styles.push(await inlineCssReferences(source,path,index,all,buffer,cache,budget));
  }
  const style=styles.join("\n");
  const policy="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src blob: data:; font-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";
  const srcDoc='<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta http-equiv="Content-Security-Policy" content="'+policy+'">'+
    '<style>html,body,#root{min-height:100%;margin:0}</style><style>'+style+
    '</style></head><body><div id="root"></div><script>'+
    escapeTag(sessionStorageShim,"script")+'</script><script type="module">'+
    escapeTag(code,"script")+'</script></body></html>';
  return {filename,indexPath:index,srcDoc,cssCount:css.length,localAssetCount:cache.size,
    warning:"Preview offline i përkohshëm: API/backend, asete të tjera nga JavaScript dhe module shtesë mund të mos funksionojnë."};
}


// Limited, offline Expo Web profile. This is NOT a universal Metro/Expo source compiler.
// The verified PoF2.9 Expo single-bundle output can run with an opaque srcDoc origin,
// provided the referenced local PNGs are integrity checked and embedded as data URLs.
const EXPO_ENTRY=/^\/_expo\/static\/js\/web\/AppEntry-[A-Za-z0-9_-]+\.js$/;
function expoCandidateIndexes(all){
  return [...all.keys()].filter(index=>{
    if(index!=="index.html"&&!/(^|\/)(?:dist|build|out)\/index\.html$/i.test(index))return false;
    const prefix=index.slice(0,index.lastIndexOf("/")+1);
    return all.has(prefix+"metadata.json") &&
      [...all.keys()].some(p=>p.startsWith(prefix+"_expo/static/js/web/AppEntry-")&&p.endsWith(".js"));
  });
}
async function verifyPngStructure(bytes){
  if(bytes.length<45 || ![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))
    reject("PNG Expo ka signature të pavlefshme.");
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=8,hasHeader=false,hasImage=false,hasEnd=false;
  const idat=[];
  while(offset+12<=bytes.length){
    const len=view.getUint32(offset,false);
    if(len>bytes.length-offset-12)reject("PNG Expo është i prerë.");
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    let crc=0xffffffff;
    for(const byte of bytes.subarray(offset+4,offset+8+len))
      crc=(crc>>>8)^crcTable[(crc^byte)&255];
    if(((crc^0xffffffff)>>>0)!==view.getUint32(offset+8+len,false))
      reject("PNG Expo ka CRC të pavlefshëm.");
    if(type==="IHDR"){
      if(hasHeader||offset!==8||len!==13)reject("PNG Expo ka IHDR të pavlefshëm.");
      const width=view.getUint32(offset+8,false),height=view.getUint32(offset+12,false);
      if(!width||!height||width*height>4194304)
        reject("PNG Expo ka dimensione të pambështetura.");
      if(bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]>1)
        reject("PNG Expo ka format kompresimi të pambështetur.");
      hasHeader=true;
    }
    if(type==="IDAT"){
      hasImage=true;
      idat.push(bytes.subarray(offset+8,offset+8+len));
    }
    if(type==="IEND"){
      if(len!==0||offset+12!==bytes.length)reject("PNG Expo ka IEND të pavlefshëm.");
      hasEnd=true;break;
    }
    offset+=12+len;
  }
  if(!hasHeader||!hasImage||!hasEnd)reject("PNG Expo është i paplotë.");
  if(typeof DecompressionStream!=="function")
    reject("Verifikimi i PNG kërkon DecompressionStream.");
  // A correct PNG chunk CRC does not imply the zlib stream/Adler32 is valid.
  // Stream inflation with a strict, bounded decoded-byte limit (no zip bombs).
  let reader;
  try{
    reader=new Blob(idat).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
    let bytesDecoded=0;
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      bytesDecoded+=value.length;
      if(bytesDecoded>16*1024*1024)
        reject("PNG Expo tejkalon kufirin e dekompresimit.");
    }
    if(!bytesDecoded)reject("PNG Expo nuk ka pikselë të dekompresuar.");
  }catch(error){
    if(String(error).includes("tejkalon"))throw error;
    reject("PNG Expo ka IDAT/zlib të pavlefshëm.");
  }finally{
    try{await reader?.cancel();}catch{}
    try{reader?.releaseLock();}catch{}
  }
}
export async function buildExpoWebArtifactPreview(buffer,filename="expo-web.zip"){
  const all=entries(buffer),candidates=expoCandidateIndexes(all);
  if(candidates.length!==1)
    reject(candidates.length?"ZIP ka disa Expo Web builds.":"Nuk gjendet një Expo Web build i mbështetur me metadata.json.");
  const index=candidates[0],prefix=index.slice(0,index.lastIndexOf("/")+1);
  if([...all.keys()].some(path=>path!==index&&/(^|\/)index\.html$/i.test(path)))
    reject("ZIP përmban disa HTML entrypoints.");
  let metadata;
  try{metadata=JSON.parse(decoder.decode(await getBytes(buffer,all.get(prefix+"metadata.json"),64*1024)));}
  catch{reject("metadata.json Expo është i pavlefshëm.");}
  if(!metadata || metadata.bundler!=="metro" || metadata.version!==0 ||
      !metadata.fileMetadata || typeof metadata.fileMetadata!=="object" ||
      Array.isArray(metadata.fileMetadata) || Object.keys(metadata.fileMetadata).length!==0)
    reject("Profili Expo Web nuk mbështetet nga adapteri offline.");
  const html=decoder.decode(await getBytes(buffer,all.get(index),MAX_HTML));
  const scriptTags=[...html.matchAll(/<script\b[^>]*>/gi)];
  const scripts=getAttribute(html,"script","src");
  if(scriptTags.length!==1||scripts.length!==1||!EXPO_ENTRY.test(scripts[0])||
      /<link\b[^>]*rel\s*=\s*["']stylesheet/i.test(html))
    reject("Expo offline kërkon një Metro AppEntry klasik pa module/CSS të jashtme.");
  const bundlePath=prefix+scripts[0].slice(1);
  let code=decoder.decode(await getBytes(buffer,all.get(bundlePath),MAX_JS));
  const allowed=new Set([index,prefix+"metadata.json",bundlePath,prefix+"THIRD_PARTY_NOTICES.txt"]);
  const availableImages=[...all.keys()].filter(path=>path.startsWith(prefix+"assets/")&&
    /\.png$/i.test(path));
  if(availableImages.length>MAX_LOCAL_ASSETS)reject("Expo tejkalon kufirin e imazheve lokale.");
  for(const path of availableImages)allowed.add(path);
  if([...all.keys()].some(path=>!allowed.has(path)))
    reject("Expo Web ZIP ka skedarë të pambështetur për profilin offline.");
  const refs=[...code.matchAll(/uri:"(\/assets\/[^"\\]+)"/g)].map(m=>m[1]);
  if(new Set(refs).size!==availableImages.length)
    reject("Expo ka imazhe të papërdorura ose referenca të pambështetura.");
  let total=0;
  for(const ref of new Set(refs)){
    if(!/^\/assets\/[A-Za-z0-9._/-]+\.png$/.test(ref) || ref.includes(".."))
      reject("Expo ka referencë imazhi të pasigurt.");
    const path=prefix+ref.slice(1);
    if(!allowed.has(path) || !all.has(path))reject("Expo kërkon imazh lokal që mungon.");
    const bytes=await getBytes(buffer,all.get(path),MAX_ASSET_BYTES);
    total+=bytes.length;
    if(total>MAX_TOTAL_ASSET_BYTES)reject("Expo tejkalon kufirin e imazheve.");
    await verifyPngStructure(bytes);
    code=code.replaceAll('uri:"'+ref+'"','uri:"data:image/png;base64,'+toBase64(bytes)+'"');
  }
  const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";
  const srcDoc='<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta http-equiv="Content-Security-Policy" content="'+policy+'">'+
    '<style>html,body,#root{height:100%;margin:0}#root{display:flex;min-height:100%}</style>'+
    '</head><body><div id="root"></div><script>'+escapeTag(code,"script")+'</script></body></html>';
  return {filename,indexPath:index,srcDoc,cssCount:0,localAssetCount:availableImages.length,
    profile:"expo-metro-single-offline",
    warning:"Expo Web preview offline i kufizuar: vetëm Metro single bundle dhe PNG lokale. Backend, Router dhe modulet dinamike nuk mbështeten."};
}

// Never offer a fake "preview prepared" for Vite's relative dynamic chunks.
// PoF2.9 proved those via HTTP on distinct isolated origins, not srcDoc.
// A future trusted static artifact service must supply that boundary explicitly.
export async function buildSupportedWebPreview(buffer,filename="preview.zip"){
  const all=entries(buffer);
  if(expoCandidateIndexes(all).length ||
      [...all.keys()].some(p=>/(^|\/)metadata\.json$/.test(p)&&
        [...all.keys()].some(x=>x.includes("/_expo/static/js/web/AppEntry-"))))
    return buildExpoWebArtifactPreview(buffer,filename);
  const indexes=[...all.keys()].filter(p=>/(^|\/)(?:dist|build|out)\/index\.html$/i.test(p));
  if(indexes.length===1){
    const prefix=indexes[0].slice(0,indexes[0].lastIndexOf("/")+1);
    const jsFiles=[...all.keys()].filter(p=>p.startsWith(prefix)&&/\.m?js$/i.test(p));
    if(jsFiles.length>1)
      reject("Vite me shumë JS chunks kërkon preview me origin HTTP të izoluar; ZIP offline srcDoc nuk e mbështet ende.");
  }
  return buildQuickPreview(buffer,filename);
}
