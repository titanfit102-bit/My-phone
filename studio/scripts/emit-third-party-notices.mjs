import {existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync} from "node:fs";
import {resolve, dirname, relative, sep, basename} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

const hash = text => createHash("sha256").update(text).digest("hex");
// A05 defense-in-depth: these Node/build-time packages must not ship to
// Web users. This gate does NOT remediate Zod within Expo CLI tooling.
export const FORBIDDEN_WEB_PACKAGE_NAMES=new Set(["zod","@expo/cli"]);

const within = (root, path) => path === root || path.startsWith(root + sep);
const readJSON = path => JSON.parse(readFileSync(path,"utf8"));
function filesIn(root) {
  return readdirSync(root,{withFileTypes:true}).flatMap(entry => {
    const path=resolve(root,entry.name);
    return entry.isDirectory() ? filesIn(path) : entry.isFile() ? [path] : [];
  }).sort();
}
function sourcesFrom(map) {
  // Metro currently emits rooted source entries. Reject other map layouts rather
  // than silently treating relative dependency entries as original app code.
  if (map.sourceRoot !== undefined && map.sourceRoot !== "")
    throw Error("Nonempty sourceRoot is unsupported; refusing incomplete license coverage");
  if (Array.isArray(map.sections)) return map.sections.flatMap(section => {
    if (!section.map) throw Error("External indexed source maps are unsupported");
    return sourcesFrom(section.map);
  });
  if (!Array.isArray(map.sources) || !map.sources.every(x => typeof x === "string"))
    throw Error("Invalid source map sources");
  return map.sources;
}

/** Derive notices from every emitted Metro chunk; never fetch licenses at build time. */
export function emitThirdPartyNotices(projectRoot, exportDir) {
  projectRoot=realpathSync(projectRoot);
  const modules=resolve(projectRoot,"node_modules");
  const files=filesIn(exportDir), maps=files.filter(path => path.endsWith(".map"));
  if (!maps.length) throw Error("No source maps: dependency license coverage cannot be established");
  for (const js of files.filter(path => path.endsWith(".js")))
    if (!maps.includes(js+".map")) throw Error("Missing source map for exported JavaScript: "+basename(js));
  const packages=new Map();
  for (const map of maps) for (const source of sourcesFrom(readJSON(map))) {
    const normalized=source.replaceAll("\\","/");
    const marker=normalized.indexOf("node_modules/");
    if (marker < 0) continue; // App source and Metro's virtual prelude/polyfills.
    let path=resolve(projectRoot,normalized.slice(marker));
    if (!within(modules,path)) throw Error("Bundled source outside node_modules");
    if (!existsSync(path)) throw Error("Cannot resolve bundled source: "+source);
    path=realpathSync(path);
    if (!within(modules,path)) throw Error("Bundled source outside node_modules");
    let owner=statSync(path).isDirectory() ? path : dirname(path), found=false;
    while (owner !== modules && within(modules,owner)) {
      const metadata=resolve(owner,"package.json");
      if (existsSync(metadata)) {
        const pkg=readJSON(metadata);
        // @babel/runtime/helpers has a package.json specifying only module type.
        if (typeof pkg.name === "string" && typeof pkg.version === "string") {
          if(FORBIDDEN_WEB_PACKAGE_NAMES.has(pkg.name))
            throw Error("Forbidden development dependency in Web export: "+pkg.name);
          packages.set(owner,pkg); found=true; break;
        }
      }
      owner=dirname(owner);
    }
    if (!found) throw Error("Cannot find owning package for bundled source: "+source);
  }
  if (!packages.size) throw Error("No bundled dependency packages: refusing empty notices");
  const licenseRoot=resolve(projectRoot,"licenses");
  const sourcesFile=resolve(licenseRoot,"upstream-license-sources.json");
  const upstream=existsSync(sourcesFile) ? readJSON(sourcesFile) : {};
  const sections=[];
  for (const [directory,pkg] of [...packages].sort(([a],[b]) => a.localeCompare(b))) {
    const key=pkg.name+"@"+pkg.version;
    const documents=readdirSync(directory,{withFileTypes:true})
      .filter(entry => entry.isFile() && /^(?:licen[sc]e|copying|notice|copyright)(?:[._-].*)?$/i.test(entry.name))
      .sort((a,b) => a.name.localeCompare(b.name))
      .map(entry => ({name:entry.name,text:readFileSync(resolve(directory,entry.name),"utf8")}))
      .filter(doc => doc.text.trim());
    if (!documents.some(doc => /^(?:licen[sc]e|copying)(?:[._-].*)?$/i.test(doc.name))) {
      const entry=upstream[key];
      if (!entry || entry.license !== pkg.license) throw Error("Missing license text for "+key);
      const path=realpathSync(resolve(licenseRoot,entry.file));
      if (!within(licenseRoot,path)) throw Error("Upstream license outside licenses directory");
      const text=readFileSync(path,"utf8");
      if (!text.trim() || hash(text) !== entry.sha256) throw Error("Upstream license digest mismatch for "+key);
      documents.unshift({name:"Upstream LICENSE",text});
      documents.push({name:"Provenance",text:entry.source+"\nSHA-256: "+entry.sha256+"\n"});
    }
    sections.push([
      "Package: "+key,
      "Installed path: "+relative(projectRoot,directory).split(sep).join("/"),
      "Declared license: "+(typeof pkg.license === "string" ? pkg.license : "See license text"),
      ...documents.map(doc => "\n--- "+doc.name+" ---\n"+doc.text)
    ].join("\n"));
  }
  const text="THIRD-PARTY NOTICES — My Phone Expo Studio Web export\n"+
    "License and attribution texts for packages identified in the emitted Metro source maps.\n"+
    "These licenses apply to the respective third-party components, not the project's original code.\n\n"+
    sections.join("\n\n"+"=".repeat(72)+"\n\n")+"\n";
  writeFileSync(resolve(exportDir,"THIRD_PARTY_NOTICES.txt"),text);
  return {packages:packages.size,sourceMaps:maps.length};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root=resolve(process.argv[2] || resolve(import.meta.dirname,".."));
  console.log(JSON.stringify(emitThirdPartyNotices(root,resolve(process.argv[3] || resolve(root,"dist")))));
}
