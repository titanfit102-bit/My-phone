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

test("GitHub main ZIP can be picked locally and Expo source is identified, not executed",async ({page})=>{
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
  await expect(page.getByText("Framework: Expo / React Native (indikacion)")).toBeVisible();
  await expect(page.getByText("Preview: NUK është gjeneruar. Build-i është fazë tjetër, me autorizim.")).toBeVisible();
  await expect(page.getByText(/Asnjë skedar nuk u ekzekutua ose dërgua në server/)).toBeVisible();
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

test("plain built HTML ZIP is labeled a candidate rather than falsely previewed",async ({page})=>{
  await page.goto("/");
  const file=makeZip([{name:"dist/index.html",content:"<html><body>ZIP preview not running</body></html>"}]);
  const [chooser]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()
  ]);
  await chooser.setFiles({name:"static.zip",mimeType:"application/zip",buffer:Buffer.from(file)});
  await expect(page.getByText(/Framework: HTML statik/)).toBeVisible();
  await expect(page.getByText(/ZIP-i nuk është ekzekutuar/)).toBeVisible();
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
  await expect(page.getByText("Aplikacionet (0)")).toBeVisible();
  const saved=await page.evaluate(()=>localStorage.getItem("my-phone-studio-projects-v1"));
  expect(!saved||!saved.includes("demo.zip")).toBe(true);
  await page.getByRole("button",{name:"✕ Mbyll Quick Preview"}).click();
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
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
});
