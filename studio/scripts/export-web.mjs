import {mkdtempSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync, rmSync} from "node:fs";
import {resolve} from "node:path";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
import {emitThirdPartyNotices} from "./emit-third-party-notices.mjs";

const root=resolve(import.meta.dirname,"..");
const require=createRequire(import.meta.url);
const cache=resolve(root,"node_modules/.cache");
mkdirSync(cache,{recursive:true});
const staging=mkdtempSync(resolve(cache,"studio-web-export-"));
try {
  execFileSync(process.execPath,[require.resolve("expo/bin/cli"),"export","--platform","web","--source-maps","--output-dir",staging],
    {cwd:root,stdio:"inherit"});
  const coverage=emitThirdPartyNotices(root,staging);
  // Source maps serve license discovery only. Do not distribute source maps or local paths.
  const output=resolve(root,"dist");
  rmSync(output,{recursive:true,force:true}); // Only this build's generated local output.
  cpSync(staging,output,{recursive:true,filter:path => !path.endsWith(".map")});
  function stripMapLinks(directory) {
    for (const entry of readdirSync(directory,{withFileTypes:true})) {
      const path=resolve(directory,entry.name);
      if (entry.isDirectory()) stripMapLinks(path);
      else if (entry.isFile() && entry.name.endsWith(".js"))
        writeFileSync(path,readFileSync(path,"utf8").replace(/^\/\/# sourceMappingURL=.*(?:\r?\n|$)/gm,""));
    }
  }
  stripMapLinks(output);
  console.log(`Packaged full third-party notices: ${coverage.packages} packages from ${coverage.sourceMaps} source map(s).`);
} finally {
  rmSync(staging,{recursive:true,force:true}); // Temporary build inputs; never GitHub artifacts/history.
}
