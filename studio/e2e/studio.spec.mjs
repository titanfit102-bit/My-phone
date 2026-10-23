import {test, expect} from "@playwright/test";

const MOCK_APP = "https://preview.example.test";
const GITHUB = "https://github.com/example/demo-app";
const addButton = page => page.getByRole("button", {name: "+ Shto", exact: true});

async function mockApplication(page, getRevision = () => "alpha") {
  let iframeLoads = 0;
  let manifestRequests = 0;
  await page.route(/^https:\/\/preview\.example\.test\//, async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname === "/build-info.json") {
      manifestRequests += 1;
      return route.fulfill({
        status: 200, contentType: "application/json",
        headers: {"Access-Control-Allow-Origin": "*", "Cache-Control": "no-store"},
        body: JSON.stringify({revision: getRevision()})
      });
    }
    iframeLoads += 1;
    return route.fulfill({
      status: 200, contentType: "text/html",
      body: `<!doctype html><html><head><title>Mock App</title></head><body>
        <h1 data-testid="mock-version">Version ${getRevision()}</h1>
        <input placeholder="Mock app form input" /></body></html>`
    });
  });
  return {get loads() {return iframeLoads;}, get manifests() {return manifestRequests;}};
}

async function createProject(page, name, web = MOCK_APP) {
  await addButton(page).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill(name);
  await page.getByPlaceholder("https://github.com/owner/app").fill(GITHUB);
  await page.getByPlaceholder("https://app.vercel.app").fill(web);
  await page.getByRole("button", {name: "Shto projektin"}).click();
}

function preview(page, name) {
  return page.frameLocator(`iframe[title="${name} · Expo Web"]`);
}

test("register, persist, edit, switch and remove projects", async ({page}) => {
  await mockApplication(page);
  await page.goto("/");
  await createProject(page, "Demo Alpha");
  await expect(page.getByRole("button", {name: "Hap Demo Alpha"})).toBeVisible();
  await expect(preview(page, "Demo Alpha").getByTestId("mock-version")).toHaveText("Version alpha");

  // localStorage should survive a full document navigation in the same browser.
  await page.reload();
  await expect(page.getByRole("button", {name: "Hap Demo Alpha"})).toBeVisible();
  await createProject(page, "Demo Beta");
  await expect(page.getByRole("button", {name: "Hap Demo Beta"})).toBeVisible();

  await page.getByRole("button", {name: "Hap Demo Alpha"}).click();
  await page.getByRole("button", {name: "✎ Ndrysho"}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Demo Updated");
  await page.getByRole("button", {name: "Ruaj ndryshimet"}).click();
  await expect(page.getByRole("button", {name: "Hap Demo Updated"})).toBeVisible();

  // Removal is intentionally a two-step operation and must never delete source.
  await page.getByRole("button", {name: "Hiq nga lista"}).click();
  await expect(page.getByRole("button", {name: "Hap Demo Updated"})).toBeVisible();
  await page.getByRole("button", {name: "Konfirmo heqjen"}).click();
  await expect(page.getByRole("button", {name: "Hap Demo Updated"})).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Hap Demo Beta"})).toBeVisible();
});

test("reject invalid project URLs without saving a project", async ({page}) => {
  await page.goto("/");
  await addButton(page).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Unsafe");
  await page.getByPlaceholder("https://github.com/owner/app").fill("https://github.com.evil.example/o/r");
  await page.getByPlaceholder("https://app.vercel.app").fill("http://insecure.example.test");
  await page.getByRole("button", {name: "Shto projektin"}).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", {name: "Hap Unsafe"})).toHaveCount(0);
  await page.getByPlaceholder("https://github.com/owner/app").fill(GITHUB);
  await page.getByRole("button", {name: "Shto projektin"}).click();
  await expect(page.getByRole("alert")).toContainText("HTTPS");
  await expect(page.getByRole("button", {name: "Hap Unsafe"})).toHaveCount(0);
});

test("sync checks a published manifest and refreshes only on a new revision", async ({page}) => {
  let revision = "alpha";
  const observed = await mockApplication(page, () => revision);
  await page.goto("/");
  await createProject(page, "Sync Test");
  await expect(preview(page, "Sync Test").getByTestId("mock-version")).toHaveText("Version alpha");
  await expect(page.getByText("Publikimi u verifikua")).toBeVisible();
  await expect(page.getByText("alpha", {exact: true}).first()).toBeVisible();
  const loadsBefore = observed.loads;
  revision = "beta";
  await expect(page.getByText("beta", {exact: true}).first()).toBeVisible({timeout: 34_000});
  await expect(preview(page, "Sync Test").getByTestId("mock-version")).toHaveText("Version beta");
  expect(observed.loads).toBeGreaterThan(loadsBefore);
  const stableLoads = observed.loads;
  await page.waitForTimeout(16_000);
  expect(observed.loads).toBe(stableLoads);
  expect(observed.manifests).toBeGreaterThan(1);
});

test("oversized published manifest is rejected without claiming a verified release", async ({page}) => {
  await page.route(/^https:\/\/preview\.example\.test\//, async route => {
    const pathname = new URL(route.request().url()).pathname;
    if(pathname==="/build-info.json")
      return route.fulfill({
        status:200, contentType:"application/json",
        headers:{"Access-Control-Allow-Origin":"*"},
        body:JSON.stringify({revision:"should-not-publish",padding:"x".repeat(70000)})
      });
    return route.fulfill({
      status:200,contentType:"text/html",
      body:"<!doctype html><h1>External preview survives</h1>"
    });
  });
  await page.goto("/");
  await createProject(page,"Oversized Manifest");
  await expect(page.getByText("Version i paverifikueshëm")).toBeVisible();
  await expect(page.getByText("should-not-publish",{exact:true})).toHaveCount(0);
  await expect(preview(page,"Oversized Manifest").getByRole("heading",{name:"External preview survives"})).toBeVisible();
});

test("unsupported manifest uses fallback and keeps the external-open action", async ({page}) => {
  await page.route(/^https:\/\/preview\.example\.test\//, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/build-info.json")
      return route.fulfill({status: 404, body: "not-found",
        headers: {"Access-Control-Allow-Origin": "*"}});
    return route.fulfill({status: 200, contentType: "text/html",
      body: "<html><body><h1>Fallback test page</h1></body></html>"});
  });
  await page.goto("/");
  await createProject(page, "Fallback Test");
  await expect(page.getByText("Version i paverifikueshëm")).toBeVisible();
  await expect(preview(page, "Fallback Test").getByRole("heading", {name: "Fallback test page"})).toBeVisible();
  await expect(page.getByRole("button", {name: /Hap jashtë studios/})).toBeVisible();
  await expect(page.getByText("I paverifikuar", {exact: true})).toBeVisible();
});

test("Session Freeze preserves an unfinished iframe form until the user accepts a new version", async ({page}) => {
  let release = "alpha";
  const observed = await mockApplication(page,()=>release);
  await page.goto("/");
  await createProject(page,"Freeze Test");
  const frame=preview(page,"Freeze Test");
  await expect(frame.getByTestId("mock-version")).toHaveText("Version alpha");
  await expect(page.getByText("Publikimi u verifikua")).toBeVisible();
  await page.getByRole("button",{name:"Aktivizo Session Freeze"}).click();
  await expect(page.getByText(/Session Freeze aktiv/)).toBeVisible();
  await frame.getByPlaceholder("Mock app form input").fill("Formular i paperfunduar");
  const initialLoads=observed.loads;
  release="beta";
  await expect(page.getByText("Version i ri në pritje: beta")).toBeVisible({timeout:34_000});
  expect(observed.loads).toBe(initialLoads);
  await expect(frame.getByTestId("mock-version")).toHaveText("Version alpha");
  await expect(frame.getByPlaceholder("Mock app form input")).toHaveValue("Formular i paperfunduar");
  await page.getByRole("button",{name:"Apliko versionin e ri"}).click();
  await expect(frame.getByTestId("mock-version")).toHaveText("Version beta");
  expect(observed.loads).toBe(initialLoads+1);
  await expect(page.getByText("Version i ri në pritje: beta")).toHaveCount(0);
  await page.getByRole("button",{name:"Çaktivizo Session Freeze"}).click();
  await expect(page.getByRole("button",{name:"Aktivizo Session Freeze"})).toBeVisible();
});

test("quota-denied writes show a warning and allow downloading a valid backup",async ({page})=>{
  await page.addInitScript(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==="my-phone-studio-projects-v1")throw new DOMException("Storage full","QuotaExceededError");
      return original.call(this,key,value);
    };
  });
  await mockApplication(page);
  await page.goto("/");
  await createProject(page,"Unsaved Demo");
  await expect(page.getByRole("alert")).toContainText("Ruajtja lokale dështoi");
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button",{name:"↓ Eksporto backup JSON"}).click()
  ]);
  expect(download.suggestedFilename()).toBe("my-phone-studio-projects-backup.json");
  const {readFile}=await import("node:fs/promises");
  const saved=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(saved.format).toBe("my-phone-studio-backup-v1");
  expect(saved.projects.map(x=>x.name)).toEqual(["Unsaved Demo"]);
  await page.reload();
  await expect(page.getByRole("button",{name:"Hap Unsaved Demo"})).toHaveCount(0);
});

test("corrupt preexisting registry is not silently erased on startup",async ({page})=>{
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem("corrupted-once")){
      localStorage.setItem("my-phone-studio-projects-v1","{damaged original");
      sessionStorage.setItem("corrupted-once","yes");
    }
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("nuk lexohen");
  await createProject(page,"Ephemeral Project");
  await expect(page.getByRole("button",{name:"Hap Ephemeral Project"})).toBeVisible();
  const raw=await page.evaluate(()=>localStorage.getItem("my-phone-studio-projects-v1"));
  expect(raw).toBe("{damaged original");
});

test("a validated JSON backup can restore projects using the browser file chooser",async ({page})=>{
  const project={
    id:"project-import-demo",name:"Restored Demo",
    github:"https://github.com/example/demo-app",web:"https://preview.example.test/",native:""
  };
  await mockApplication(page);
  await page.goto("/");
  const [picker]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Importo backup JSON"}).click()
  ]);
  await picker.setFiles({
    name:"backup.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify({format:"my-phone-studio-backup-v1",projects:[project]}))
  });
  await expect(page.getByRole("button",{name:"Hap Restored Demo"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:"Hap Restored Demo"})).toBeVisible();
  // Invalid backup is rejected in full; the valid imported project survives.
  const [picker2]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Importo backup JSON"}).click()
  ]);
  await picker2.setFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from('{"format":"wrong","projects":[]}')});
  await expect(page.getByText("Ky skedar nuk është backup i My Phone Studio.")).toBeVisible();
  await expect(page.getByRole("button",{name:"Hap Restored Demo"})).toBeVisible();
});

for(const defense of ["csp","x-frame-options"]){
  test("iframe blocked by "+defense+" remains explicitly unverified with external fallback",async ({page})=>{
    const blocked="https://blocked.example.test";
    let frameRequested=false;
    await page.route(/^https:\/\/blocked\.example\.test\//,async route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(pathname==="/build-info.json")
        return route.fulfill({status:404,headers:{"Access-Control-Allow-Origin":"*"},body:"Not Found"});
      frameRequested=true;
      const headers={"content-type":"text/html"};
      if(defense==="csp")headers["content-security-policy"]="frame-ancestors 'none'";
      else headers["x-frame-options"]="DENY";
      return route.fulfill({status:200,headers,body:"<html><body><h1 data-testid='must-not-show'>Forbidden Frame</h1></body></html>"});
    });
    await page.goto("/");
    await createProject(page,"Blocked Preview",blocked);
    await expect(page.locator('iframe[title="Blocked Preview · Expo Web"]')).toBeVisible();
    await expect(page.getByText("URL e lidhur · shfaqja në iframe e paverifikuar")).toBeVisible();
    await expect(page.getByText(/Nëse iframe është bosh ose i bllokuar/)).toBeVisible();
    await expect(page.getByRole("button",{name:/Hap jashtë studios/})).toBeVisible();
    await expect.poll(()=>frameRequested).toBe(true);
    await expect(preview(page,"Blocked Preview").getByTestId("must-not-show")).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Hap Blocked Preview"})).toBeVisible();
  });
}

import {makeZip} from "../tests/zip-fixtures.mjs";
import {localFont} from "../tests/font-fixture.mjs";

test("GitHub source-only ZIP explains that build is needed and does not execute source",async ({page})=>{
  await page.goto("/");
  const archive=makeZip([
    {name:"hello-main/package.json",content:'{"dependencies":{"expo":"latest"}}'},
    {name:"hello-main/app.json",content:"{}"},
    {name:"hello-main/App.tsx",content:"throw Error('do not run')"}
  ]);
  const [chooser]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()
  ]);
  await chooser.setFiles({name:"hello-main.zip",mimeType:"application/zip",buffer:Buffer.from(archive)});
  await expect(page.getByText(/Nuk gjendet dist\/index.html/)).toBeVisible();
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
});

test("unsafe ZIP entries are rejected before any preview is created",async ({page})=>{
  await page.goto("/");
  const file=makeZip([{name:"app-main/../../secret.txt",content:"password"}]);
  const [chooser]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()
  ]);
  await chooser.setFiles({name:"unsafe.zip",mimeType:"application/zip",buffer:Buffer.from(file)});
  await expect(page.getByText(/rrugë skedarësh të pasigurta/)).toBeVisible();
  await expect(page.getByText("Preview: NUK është gjeneruar. Build-i është fazë tjetër, me autorizim.")).toHaveCount(0);
});

test("HTML-only ZIP lacking its JS bundle cannot falsely claim working preview",async ({page})=>{
  await page.goto("/");
  const file=makeZip([{name:"dist/index.html",content:"<html><body>ZIP preview not running</body></html>"}]);
  const [chooser]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()
  ]);
  await chooser.setFiles({name:"static.zip",mimeType:"application/zip",buffer:Buffer.from(file)});
  await expect(page.getByText(/mbështet vetëm build Vite/)).toBeVisible();
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
});

test("ZIP Quick Preview displays built Vite HTML only in sandbox, and closes without saving",async ({page})=>{
  await page.goto("/");
  const zip=makeZip([
    {name:"sample-main/dist/index.html",method:8,content:'<!doctype html><script type="module" src="/assets/demo.js"></script><link rel="stylesheet" href="/assets/demo.css">'},
    {name:"sample-main/dist/assets/demo.js",method:8,content:"localStorage.setItem('ziponly','temporary');document.getElementById('root').innerHTML='<h1>ZIP Running</h1><button id=go>Click</button>';document.querySelector('#go').onclick=()=>{document.querySelector('h1').textContent=localStorage.getItem('ziponly');};"},
    {name:"sample-main/dist/assets/demo.css",method:8,content:"h1{color:teal}"}
  ]);
  const [chooser]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()
  ]);
  await chooser.setFiles({name:"demo.zip",mimeType:"application/zip",buffer:Buffer.from(zip)});
  const frame=page.frameLocator('iframe[title="Quick Preview · ZIP"]');
  await expect(frame.getByRole("heading",{name:"ZIP Running"})).toBeVisible();
  await frame.getByRole("button",{name:"Click"}).click();
  await expect(frame.getByRole("heading",{name:"temporary"})).toBeVisible();
  await expect(page.getByText("ZIP TEMPORARY")).toBeVisible();
  await expect(page.getByText("ENGINE CORE · OFFLINE_PAYLOAD_PREPARED")).toBeVisible();
  await expect(page.getByText("Aplikacionet (0)")).toBeVisible();
  const saved=await page.evaluate(()=>localStorage.getItem("my-phone-studio-projects-v1"));
  expect(!saved||!saved.includes("demo.zip")).toBe(true);
  await page.getByRole("button",{name:"✕ Mbyll Quick Preview"}).click();
  await expect(page.getByText("ENGINE CORE · OFFLINE_PAYLOAD_PREPARED")).toHaveCount(0);
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
  await expect(page.getByRole("button",{name:"↑ Ngarko ZIP"})).toBeVisible();
});

test("ZIP with only source gives actionable message and never opens a phone iframe",async ({page})=>{
  await page.goto("/");
  const zip=makeZip([{name:"repo-main/package.json",content:'{"name":"web"}'},
    {name:"repo-main/src/App.tsx",content:"export default function App(){}"}]);
  const [picker]=await Promise.all([page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()]);
  await picker.setFiles({name:"source.zip",mimeType:"application/zip",buffer:Buffer.from(zip)});
  await expect(page.getByText(/Nuk gjendet dist\/index.html/)).toBeVisible();
  await expect(page.getByText("ENGINE CORE · SOURCE_BUILD_REQUIRED")).toBeVisible();
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
});


test("premium desktop phone remains fully visible while both side panels scroll", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Fixed three-column workspace applies on desktop.");
  for (const viewport of [{width:1100,height:900},{width:1366,height:760},{width:1600,height:950}]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const phone=page.getByTestId("studio-phone-frame");
    const left=page.getByTestId("studio-projects-panel");
    const right=page.getByTestId("studio-diagnostics-panel");
    await expect(phone).toBeVisible();
    await expect(left).toBeVisible();
    await expect(right).toBeVisible();
    const before=await phone.boundingBox();
    expect(before).not.toBeNull();
    expect(before.x).toBeGreaterThanOrEqual(0);
    expect(before.y).toBeGreaterThanOrEqual(0);
    expect(before.x+before.width).toBeLessThanOrEqual(viewport.width+1);
    expect(before.y+before.height).toBeLessThanOrEqual(viewport.height+1);
    const moved=await page.evaluate(()=>{
      const panes=["studio-projects-panel","studio-diagnostics-panel"];
      return panes.map(id=>{
        const el=document.querySelector('[data-testid="'+id+'"]');
        if(!el?.firstElementChild) return false;
        const spacer=document.createElement("div");
        spacer.style.height="1500px";
        spacer.style.flexShrink="0";
        el.firstElementChild.appendChild(spacer);
        el.scrollTop=el.scrollHeight;
        return el.scrollTop>0;
      });
    });
    expect(moved).toEqual([true,true]);
    const after=await phone.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after.x-before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(1);
  }
});


test("Advanced ZIP keeps multiple CSS and local raster images inside isolated phone frame",async ({page})=>{
  await page.goto("/");
  const pixel=Uint8Array.from(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/G8cAAAAASUVORK5CYII=","base64"));
  const zip=makeZip([
    {name:"example-main/dist/index.html",content:'<!doctype html><link rel="stylesheet" href="/assets/a.css"><link rel="stylesheet" href="/assets/b.css"><script type="module" src="/assets/app.js"></script>'},
    {name:"example-main/dist/assets/app.js",content:"document.getElementById('root').textContent='Advanced ZIP Working';"},
    {name:"example-main/dist/assets/a.css",content:"@font-face{font-family:StudioFixture;src:url('./demo.woff') format('woff')}#root{font-family:StudioFixture;background-image:url('../images/pixel.png')}",method:8},
    {name:"example-main/dist/assets/b.css",content:"#root{color:rgb(10, 110, 90)}"},
    {name:"example-main/dist/images/pixel.png",bytes:pixel,method:8},
    {name:"example-main/dist/assets/demo.woff",bytes:localFont,method:8}
  ]);
  const [picker]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()
  ]);
  await picker.setFiles({name:"advanced.zip",mimeType:"application/zip",buffer:Buffer.from(zip)});
  const frame=page.frameLocator('iframe[title="Quick Preview · ZIP"]');
  const root=frame.locator("#root");
  await expect(root).toHaveText("Advanced ZIP Working");
  const styling=await root.evaluate(el=>({
    background:getComputedStyle(el).backgroundImage,
    color:getComputedStyle(el).color
  }));
  expect(styling.background).toContain("data:image/png;base64,");
  expect(styling.color).toBe("rgb(10, 110, 90)");
  const decoded=await root.evaluate(async el=>{
    const fonts=await document.fonts.load('16px StudioFixture','Advanced ZIP Working');
    const image=new Image();
    image.src=getComputedStyle(el).backgroundImage.slice(5,-2);
    await image.decode();
    return {fonts:fonts.length,fontStatus:fonts[0]?.status,imageWidth:image.naturalWidth};
  });
  expect(decoded).toEqual({fonts:1,fontStatus:'loaded',imageWidth:1});
  await expect(page.getByText("ENGINE CORE · OFFLINE_PAYLOAD_PREPARED")).toBeVisible();
  await page.getByRole("button",{name:"✕ Mbyll Quick Preview"}).click();
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
});

test("ZIP sandbox blocks parent access, fetch, remote images and popups; storage dies with frame",async ({page})=>{
  let sent=0;
  await page.route('https://zip-egress.example.test/**',route=>{sent++;return route.abort();});
  await page.goto('/');
  const zip=makeZip([
    {name:'dist/index.html',content:'<script src="/assets/main.js"></script>'},
    {name:'dist/assets/main.js',content:`(async()=>{
      const result={origin:self.origin,previous:localStorage.getItem('zip-session')};
      localStorage.setItem('zip-session','temporary');
      try{parent.document.body.dataset.zipTouched='yes';result.parentBlocked=false;}
      catch{result.parentBlocked=true;}
      result.popupBlocked=window.open('https://zip-egress.example.test/popup')===null;
      try{await fetch('https://zip-egress.example.test/fetch');result.fetchBlocked=false;}
      catch{result.fetchBlocked=true;}
      const image=new Image();
      result.imageBlocked=await new Promise(resolve=>{
        image.onload=()=>resolve(false);image.onerror=()=>resolve(true);
        image.src='https://zip-egress.example.test/pixel.png';
      });
      document.getElementById('root').textContent=JSON.stringify(result);
    })();`}
  ]);
  for(let i=0;i<2;i++){
    const [picker]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'↑ Ngarko ZIP'}).click()]);
    await picker.setFiles({name:'isolation.zip',mimeType:'application/zip',buffer:Buffer.from(zip)});
    const iframe=page.locator('iframe[title="Quick Preview · ZIP"]');
    await expect(iframe).toHaveAttribute('sandbox','allow-scripts');
    const root=page.frameLocator('iframe[title="Quick Preview · ZIP"]').locator('#root');
    await expect(root).toContainText('imageBlocked');
    expect(JSON.parse(await root.innerText())).toEqual({origin:'null',previous:null,parentBlocked:true,popupBlocked:true,fetchBlocked:true,imageBlocked:true});
    expect(await page.evaluate(()=>({touched:document.body.dataset.zipTouched??null,saved:localStorage.getItem('zip-session')}))).toEqual({touched:null,saved:null});
    await page.getByRole('button',{name:'✕ Mbyll Quick Preview'}).click();
    await expect(iframe).toHaveCount(0);
  }
  expect(sent).toBe(0);
});
