import {test,expect} from "@playwright/test";
import {makeZip} from "../tests/zip-fixtures.mjs";

async function upload(page,script,name="boundary.zip"){
  const archive=makeZip([
    {name:"dist/index.html",content:'<!doctype html><script src="/assets/app.js"></script>'},
    {name:"dist/assets/app.js",content:script}
  ]);
  const [chooser]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()
  ]);
  await chooser.setFiles({
    name,mimeType:"application/zip",buffer:Buffer.from(archive)
  });
}

// A03: Demonstrates a real LIMIT, not a containment success. An opaque iframe
// blocks top-navigation but may still attempt its OWN network navigation.
// The test intercepts that request locally, so no external server is contacted.
test("A03 adversarial: sandbox blocks top navigation but cannot promise zero iframe self-navigation egress",async({page})=>{
  const attempted=[];
  await page.route("https://a03-boundary.example.test/**",async route=>{
    attempted.push({
      url:route.request().url(),
      navigation:route.request().isNavigationRequest()
    });
    await route.fulfill({status:200,contentType:"text/html",
      body:"<!doctype html><h1>Intercepted self-navigation</h1>"});
  });
  await page.goto("/");
  await upload(page,`(()=>{
    let topBlocked=false;
    try{top.location.href="https://a03-boundary.example.test/top";}
    catch{topBlocked=true;}
    document.getElementById("root").textContent=JSON.stringify({
      origin:location.origin,topBlocked
    });
    setTimeout(()=>{location.href="https://a03-boundary.example.test/self";},600);
  })();`,"a03-self-nav.zip");
  const frame=page.frameLocator('iframe[title="Quick Preview · ZIP"]');
  const first=JSON.parse(await frame.locator("#root").innerText());
  expect(first).toEqual({origin:"null",topBlocked:true});
  await expect.poll(()=>attempted.filter(r=>r.url.endsWith("/self")).length).toBe(1);
  expect(attempted.filter(r=>r.url.endsWith("/top"))).toEqual([]);
  expect(attempted[0].navigation).toBe(true);
  await expect(frame.getByRole("heading",{name:"Intercepted self-navigation"})).toBeVisible();
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:4173");
  await expect(page.getByText(/ZIP që i beson dhe zotëron/)).toBeVisible();
});

test("A03 negative control: nested iframe and workers are blocked by preview CSP",async({page})=>{
  const attempted=[];
  await page.route("https://a03-boundary.example.test/**",async route=>{
    attempted.push(route.request().url());await route.abort();
  });
  await page.goto("/");
  await upload(page,`(()=>{
    const child=document.createElement("iframe");
    child.src="https://a03-boundary.example.test/nested";
    document.body.appendChild(child);
    let workerBlocked=false;
    try{new Worker("https://a03-boundary.example.test/worker.js");}
    catch{workerBlocked=true;}
    document.getElementById("root").textContent=JSON.stringify({workerBlocked});
  })();`,"a03-blocked-features.zip");
  const frame=page.frameLocator('iframe[title="Quick Preview · ZIP"]');
  await expect(frame.locator("#root")).toContainText("workerBlocked");
  expect(JSON.parse(await frame.locator("#root").innerText()).workerBlocked).toBe(true);
  // Let any unwanted resource requests surface before asserting none reached the network.
  await page.waitForTimeout(500);
  expect(attempted).toEqual([]);
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveAttribute("sandbox","allow-scripts");
});
