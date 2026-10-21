import {inspectZip} from "./zip-inspector.js";
// Offline preview only: built Vite single JS bundle. No scripts from source ZIP run in Studio origin.
const MAX_HTML=256*1024, MAX_JS=8*1024*1024, MAX_CSS=2*1024*1024;
const decoder=new TextDecoder("utf-8",{fatal:true});
const u16=(v,p)=>v.getUint16(p,true),u32=(v,p)=>v.getUint32(p,true);
const reject=message=>{throw Error(message);};

function entries(buffer){
  inspectZip(buffer,"selected.zip"); // Reject malicious ZIP metadata first.
  const view=new DataView(buffer),len=view.byteLength;
  let end=-1;
  for(let i=len-22;i>=Math.max(0,len-22-65535);i--){
    if(u32(view,i)===0x06054b50&&i+22+u16(view,i+20)===len){end=i;break;}
  }
  if(end<0)reject("Nuk u gjet indeksi ZIP.");
  let p=u32(view,end+16);
  const entries=new Map(), count=u16(view,end+10);
  for(let i=0;i<count;i++){
    if(p+46>len||u32(view,p)!==0x02014b50)reject("Indeksi ZIP i dëmtuar.");
    const n=u16(view,p+28),ex=u16(view,p+30),comment=u16(view,p+32);
    if(p+46+n+ex+comment>len)reject("Indeksi ZIP i prerë.");
    const name=decoder.decode(new Uint8Array(buffer,p+46,n));
    if(!name.endsWith("/"))entries.set(name,{name,method:u16(view,p+10),
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
  if(p+30>buffer.byteLength||u32(d,p)!==0x04034b50||
      u16(d,p+8)!==entry.method)reject("ZIP local header i dëmtuar.");
  const n=u16(d,p+26),ex=u16(d,p+28);
  const start=p+30+n+ex;
  if(start+entry.packed>buffer.byteLength)reject("Asset-i ZIP është i prerë.");
  if(decoder.decode(new Uint8Array(buffer,p+30,n))!==entry.name)
    reject("Emri i ZIP nuk përputhet.");
  const bytes=new Uint8Array(buffer,start,entry.packed);
  if(entry.method===0){
    if(bytes.length!==entry.size)reject("Madhësia ZIP nuk përputhet.");
    return new Uint8Array(bytes);
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
      if(total>limit){await reader.cancel();reject("Asset-i tejkalon kufirin.");}
      chunks.push(value);
    }
    if(total!==entry.size)reject("Madhësia ZIP nuk përputhet.");
    const out=new Uint8Array(total);let i=0;
    for(const part of chunks){out.set(part,i);i+=part.length;}
    return out;
  }catch(e){if(/tejkalon|nuk përputhet/.test(String(e)))throw e;
    reject("ZIP nuk mund të çkompresohet.");
  }finally{try{reader?.releaseLock();}catch{}}
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
  const css=getAttribute(html,"link","href").filter(x=>x.endsWith(".css"));
  if(js.length!==1||!js[0].endsWith(".js")||css.length>1)
    reject("Quick Preview mbështet vetëm build Vite me një bundle JS dhe maksimumi një CSS.");
  const jsPath=locateAsset(index,js[0]),cssPath=css[0]?locateAsset(index,css[0]):null;
  const code=decoder.decode(await getBytes(buffer,all.get(jsPath),MAX_JS));
  const style=cssPath?decoder.decode(await getBytes(buffer,all.get(cssPath),MAX_CSS)):"";
  const policy="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src blob: data:; font-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";
  const srcDoc='<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta http-equiv="Content-Security-Policy" content="'+policy+'">'+
    '<style>html,body,#root{min-height:100%;margin:0}</style><style>'+escapeTag(style,"style")+
    '</style></head><body><div id="root"></div><script>'+
    escapeTag(sessionStorageShim,"script")+'</script><script type="module">'+
    escapeTag(code,"script")+'</script></body></html>';
  return {filename,indexPath:index,srcDoc,
    warning:"Preview offline i përkohshëm: API/backend, media të jashtme dhe module shtesë mund të mos funksionojnë."};
}
