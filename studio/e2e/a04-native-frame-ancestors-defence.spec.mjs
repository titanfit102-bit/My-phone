import {test,expect} from "@playwright/test";

// Synthetic browser test of the HTTP response protection. The local Python
// webServer does not serve Vercel headers, so the target response is intercepted
// with the exact deployment header values asserted in the Node config test.
// The test never contacts the real Appetize provider or runs an Android session.
test("SEC-04 Studio response headers block native provider same-origin iframe navigation",async({page})=>{
  await page.goto("/");
  const studioOrigin=new URL(page.url()).origin;
  const target=studioOrigin+"/__sec04_native_frame_ancestor_block_target";
  await page.evaluate(()=>{
    localStorage.setItem("SEC04_NATIVE_HEADER_MARKER","safe");
    delete document.documentElement.dataset.sec04Escaped;
  });
  let providerRequests=0;
  let targetRequests=0;
  await page.route("https://appetize.io/**",route=>{
    providerRequests++;
    return route.fulfill({status:200,contentType:"text/html",body:
      "<!doctype html><script>location.replace("+JSON.stringify(target)+")</script>"});
  });
  await page.route(target,route=>{
    targetRequests++;
    return route.fulfill({status:200,contentType:"text/html",
      headers:{
        "Content-Security-Policy":"frame-ancestors 'none'",
        "X-Frame-Options":"DENY",
        "X-Content-Type-Options":"nosniff"
      },
      body:[
        '<!doctype html><div id="native-unsafe-execution">unsafe</div><script>',
        'try{localStorage.setItem("SEC04_NATIVE_HEADER_MARKER","breached")}catch{}',
        'try{parent.document.documentElement.dataset.sec04Escaped="yes"}catch{}',
        '</script>'
      ].join("")
    });
  });
  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Header Defense Proof");
  await page.getByPlaceholder("https://github.com/owner/app")
    .fill("https://github.com/example/synthetic-native-header-probe");
  await page.getByPlaceholder("https://appetize.io/embed/BUILD_ID")
    .fill("https://appetize.io/embed/abc12345");
  await page.getByRole("button",{name:"Shto projektin"}).click();

  const iframe=page.locator('iframe[title="Header Defense Proof · Android cloud"]');
  await expect(iframe).toHaveAttribute("src","https://appetize.io/embed/abc12345");
  // Do not change vendor runtime permissions until compatibility has been
  // tested. Here we prove the Studio's own response-level containment.
  await expect(iframe).toHaveAttribute("sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups");
  await expect.poll(()=>providerRequests).toBeGreaterThanOrEqual(1);
  await expect.poll(()=>targetRequests).toBeGreaterThanOrEqual(1);
  const blocked=page.frameLocator('iframe[title="Header Defense Proof · Android cloud"]')
    .locator("#native-unsafe-execution");
  await expect(blocked).toHaveCount(0);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>localStorage.getItem("SEC04_NATIVE_HEADER_MARKER"))).toBe("safe");
  expect(await page.evaluate(()=>document.documentElement.dataset.sec04Escaped)).toBeUndefined();
  await expect(page).toHaveURL(studioOrigin+"/");
});


// Differential NEGATIVE CONTROL: no CSP/XFO response headers means the same
// native iframe sandbox still allows an attacker-controlled same-frame
// navigation into the Studio origin. This must pass by OBSERVING the unsafe
// behavior, not by falsely claiming that the baseline policy is secure.
// PR44 separately retains the intentionally RED required security acceptance.
test("SEC-04 negative control: without anti-framing response headers native redirect reaches Studio origin",async({page})=>{
  await page.goto("/");
  const studioOrigin=new URL(page.url()).origin;
  const target=studioOrigin+"/__sec04_native_frame_unprotected_control";
  await page.evaluate(()=>{
    localStorage.setItem("SEC04_NATIVE_UNPROTECTED_CONTROL","can-read");
    delete document.documentElement.dataset.sec04NegativeControl;
  });

  let providerRequests=0;
  let targetRequests=0;
  // Never contact external Appetize. Redirect happens only in a synthetic
  // Playwright-fulfilled response, and target response stays on localhost.
  await page.route("https://appetize.io/**",route=>{
    providerRequests++;
    return route.fulfill({status:200,contentType:"text/html",
      body:"<!doctype html><script>location.replace("+JSON.stringify(target)+")</script>"});
  });
  await page.route(target,route=>{
    targetRequests++;
    return route.fulfill({status:200,contentType:"text/html",body:[
      '<!doctype html><div id="native-unprotected-control"></div><script>',
      'const state={origin:self.origin,parentReadable:false,storageValue:null};',
      'try{state.parentReadable=!!parent.document.body}catch{}',
      'try{state.storageValue=localStorage.getItem("SEC04_NATIVE_UNPROTECTED_CONTROL")}catch{}',
      'document.getElementById("native-unprotected-control").textContent=JSON.stringify(state);',
      '</script>'
    ].join("")});
  });

  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Unprotected Control");
  await page.getByPlaceholder("https://github.com/owner/app")
    .fill("https://github.com/example/synthetic-unprotected-control");
  await page.getByPlaceholder("https://appetize.io/embed/BUILD_ID")
    .fill("https://appetize.io/embed/abc12345");
  await page.getByRole("button",{name:"Shto projektin"}).click();

  const iframe=page.locator('iframe[title="Unprotected Control · Android cloud"]');
  await expect(iframe).toHaveAttribute("src","https://appetize.io/embed/abc12345");
  await expect(iframe).toHaveAttribute("sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups");
  await expect.poll(()=>providerRequests).toBeGreaterThanOrEqual(1);
  await expect.poll(()=>targetRequests).toBeGreaterThanOrEqual(1);
  const probe=page.frameLocator('iframe[title="Unprotected Control · Android cloud"]')
    .locator("#native-unprotected-control");
  await expect(probe).toHaveText(JSON.stringify({
    origin:studioOrigin,parentReadable:true,storageValue:"can-read"
  }));
  await expect(page).toHaveURL(studioOrigin+"/");
  expect(await page.evaluate(()=>localStorage.getItem("SEC04_NATIVE_UNPROTECTED_CONTROL")))
    .toBe("can-read");
});
