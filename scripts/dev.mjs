import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";

const root = resolve(import.meta.dirname, "../web");
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const target = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (target !== root && !target.startsWith(root + sep)) {response.writeHead(403);response.end("Forbidden");return;}
    const metadata = await stat(target);
    if (!metadata.isFile()) throw new Error("Not found");
    const data = await readFile(target);
    response.writeHead(200, {"Content-Type":types[extname(target)] || "application/octet-stream", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"});
    response.end(data);
  } catch {response.writeHead(404);response.end("Not Found");}
}).listen(4173, "127.0.0.1", () => console.log("My Phone demo: http://127.0.0.1:4173"));
