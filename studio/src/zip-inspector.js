// Read-only ZIP metadata inspector. Never extract, execute, upload, or render archive contents.
// GitHub "Download ZIP" files commonly include a single <repo>-<branch>/ prefix.
export const MAX_ZIP_BYTES = 32 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 5000;
export const MAX_DECLARED_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

function fail(message) {throw new Error(message);}
const read16=(view,offset)=>view.getUint16(offset,true);
const read32=(view,offset)=>view.getUint32(offset,true);
function safePath(name) {
  if (!name || name.length > 1024 || name.includes("\\") || name.includes("\0") ||
      name.startsWith("/") || /^[A-Za-z]:/.test(name) ||
      name.split("/").some(part=>part==="." || part===".." || /[\u0000-\u001f]/.test(part)))
    fail("ZIP ka rrugë skedarësh të pasigurta ose të pavlefshme.");
  return name;
}
function normalizeEntries(names) {
  const parts=names.map(n=>n.split("/").filter(Boolean));
  // GitHub ZIPs have one common root directory. Strip exactly one segment.
  // Strip a GitHub repository wrapper, not actual build/source directories.
  // Preserve semantic roots even when every entry shares a first path segment.
  // Retain legacy GitHub wrapper normalization for one-file repository archives.
  const reserved=new Set(["dist","build","out","src","app","android","ios","public"]);
  const shared=parts.length>0 && !reserved.has((parts[0]?.[0]||"").toLowerCase()) &&
    parts.every(p=>p.length>=2 && p[0]===parts[0][0]);
  const root=shared ? parts[0][0] : "";
  return {root,paths:parts.map(p=>(shared?p.slice(1):p).join("/")).filter(Boolean)};
}
function classify(paths) {
  const normalized=paths.map(p=>p.toLowerCase());
  const files=new Set(normalized);
  const hasEnd=name=>normalized.some(p=>p.endsWith("/"+name)||p===name);
  const hasPrefix=start=>normalized.some(p=>p.startsWith(start+"/"));
  const packageJson=hasEnd("package.json");
  const expo=hasEnd("app.json") || hasEnd("app.config.js") || hasEnd("app.config.ts") ||
    hasEnd("expo-env.d.ts") || hasEnd("metro.config.js");
  const next=hasEnd("next.config.js") || hasEnd("next.config.mjs") ||
    hasEnd("next.config.ts") || hasEnd("next.config.cjs");
  const vite=hasEnd("vite.config.js") || hasEnd("vite.config.ts") ||
    hasEnd("vite.config.mjs") || hasEnd("vite.config.mts");
  const web=normalized.some(p=>p==="index.html" || /^(dist|build|out)\/index\.html$/.test(p));
  const source=packageJson || normalized.some(p=>p.startsWith("src/") || p.startsWith("app/"));
  if (expo && source) return {kind:"source",framework:"Expo / React Native (indikacion)",previewReady:false};
  if (next) return {kind:"source",framework:"Next.js (indikacion)",previewReady:false};
  if (vite) return {kind:"source",framework:"Vite / React ose framework tjetër (indikacion)",previewReady:false};
  if (packageJson) return {kind:"source",framework:"JavaScript / Node (i pakonfirmuar)",previewReady:false};
  if (web) return {kind:"static",framework:"HTML statik / build kandidat",previewReady:false};
  if (hasPrefix("android") || hasEnd("gradlew")) return {kind:"native",framework:"Android source (indikacion)",previewReady:false};
  return {kind:"unknown",framework:"Strukturë e panjohur",previewReady:false};
}
export function inspectZip(arrayBuffer, filename="archive.zip") {
  if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength<22)
    fail("ZIP është bosh ose i pavlefshëm.");
  if (arrayBuffer.byteLength>MAX_ZIP_BYTES)
    fail("ZIP tejkalon 32 MB. Përdor një arkiv më të vogël për analizën fillestare.");
  if (typeof filename!=="string" || !/\.zip$/i.test(filename))
    fail("Zgjidh një skedar .zip.");
  const view=new DataView(arrayBuffer), len=view.byteLength;
  // EOCD is located in the last 22 bytes plus at most 65,535 bytes of comment.
  let eocd=-1;
  for(let p=len-22;p>=Math.max(0,len-22-65535);p--){
    if(read32(view,p)===0x06054b50 && p+22+read16(view,p+20)===len){eocd=p;break;}
  }
  if(eocd<0)fail("Nuk u gjet struktura ZIP. Arkivi mund të jetë i dëmtuar.");
  const disk=read16(view,eocd+4),cdDisk=read16(view,eocd+6);
  const diskEntries=read16(view,eocd+8),total=read16(view,eocd+10);
  const cdSize=read32(view,eocd+12),cdOffset=read32(view,eocd+16);
  if(disk!==0 || cdDisk!==0 || diskEntries!==total)
    fail("ZIP me disa volume nuk mbështetet.");
  if(total===0 || total===0xffff || cdSize===0xffffffff || cdOffset===0xffffffff)
    fail("Arkiv bosh ose ZIP64 i pambështetur.");
  if(total>MAX_ZIP_ENTRIES)fail("ZIP ka shumë skedarë (maksimumi 5000).");
  if(cdOffset+cdSize>eocd)fail("Indeksi i ZIP është i dëmtuar.");
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let pos=cdOffset, declared=0;
  const names=[],dedupe=new Set();
  for(let i=0;i<total;i++){
    if(pos+46>eocd || read32(view,pos)!==0x02014b50)
      fail("Indeksi i skedarëve ZIP është i dëmtuar.");
    const flags=read16(view,pos+8),method=read16(view,pos+10);
    const compressed=read32(view,pos+20),size=read32(view,pos+24);
    const nameLength=read16(view,pos+28),extraLength=read16(view,pos+30);
    const commentLength=read16(view,pos+32),start=pos+46;
    if(start+nameLength+extraLength+commentLength>eocd)fail("Indeksi ZIP është i prerë.");
    if(flags&1 || flags&64)fail("ZIP i enkriptuar nuk mbështetet.");
    if(method!==0 && method!==8)fail("ZIP ka një metodë kompresimi të pambështetur.");
    if(compressed===0xffffffff || size===0xffffffff)fail("ZIP64 i pambështetur.");
    declared+=size;
    if(declared>MAX_DECLARED_UNCOMPRESSED_BYTES)fail("ZIP deklaron tepër të dhëna (maksimumi 512 MB).");
    const attrs=read32(view,pos+38);
    const unixMode=attrs>>>16;
    if((unixMode&0xf000)===0xa000)fail("ZIP përmban symbolic links, të pambështetura.");
    let name;
    try{name=decoder.decode(new Uint8Array(arrayBuffer,start,nameLength));}
    catch {fail("Emër skedari me UTF-8 të pavlefshëm.");}
    safePath(name);
    if(dedupe.has(name))fail("ZIP ka skedarë me emra të përsëritur.");
    dedupe.add(name);
    if(!name.endsWith("/"))names.push(name);
    pos=start+nameLength+extraLength+commentLength;
  }
  if(pos!==cdOffset+cdSize)fail("Indeksi ZIP nuk ka madhësi të përputhshme.");
  if(!names.length)fail("ZIP nuk përmban skedarë.");
  const normalized=normalizeEntries(names);
  const uniquePaths=new Set(normalized.paths.map(x=>x.toLowerCase()));
  if(uniquePaths.size!==normalized.paths.length)fail("ZIP ka skedarë të dyfishtë pas normalizimit.");
  const result=classify(normalized.paths);
  // Detect build entries independently of framework; GitHub source ZIPs may include dist/.
  const candidates=normalized.paths.filter(path=>/(^|\/)(dist|build|out)\/index\.html$/i.test(path));
  return {
    filename,
    buildCandidateCount:candidates.length,
    buildCandidates:candidates.slice(0,10),
    count:names.length,
    archivedBytes:len,
    declaredBytes:declared,
    root:normalized.root || "(pa dosje rrënjë)",
    framework:result.framework,
    kind:result.kind,
    previewReady:false,
    sample:normalized.paths.slice(0,8),
    advice:result.kind==="source"
      ? "Ky ZIP përmban kod burimor. Nevojitet një build i izoluar për preview; nuk është ndërtuar ose publikuar asgjë."
      : result.kind==="static"
      ? "U gjet një kandidat Web statik. Përpara shfaqjes duhen verifikim i aseteve dhe shërbim i izoluar; ZIP-i nuk është ekzekutuar."
      : result.kind==="native"
      ? "Për Android real kërkohet APK e ndërtuar dhe një emulator i autorizuar. Kodi nuk është APK."
      : "Nuk u identifikua format i mbështetur. Studio nuk mund të premtojë preview për këtë ZIP."
  };
}
