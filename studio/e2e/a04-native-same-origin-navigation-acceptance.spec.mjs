import {test,expect} from "@playwright/test";

// Deliberately RED security acceptance probe. This is a separate Draft and must
// not be merged as a passing security test. It exposes a same-origin navigation
// risk in the current native Appetize iframe policy without any vendor contact.
test("SEC-04 REQUIRED: redirected Appetize iframe cannot read Studio origin",async({page})=>{
  await page.goto("/");
  const studioOrigin=new URL(page.url()).origin;
  const redirectTarget=studioOrigin+"/__sec04_native_navigation_target";
  await page.evaluate(()=>localStorage.setItem("SEC04_SYNTHETIC_NATIVE_MARKER","test-only"));

  // Emulate the external Appetize page and an attacker-controlled SAME-FRAME
  // navigation. All target/provider network traffic is fulfilled locally.
  let providerRequests=0;
  await page.route("https://appetize.io/**",route=>{
    providerRequests++;
    return route.fulfill({status:200,contentType:"text/html",
      body:"<!doctype html><script>location.replace("+JSON.stringify(redirectTarget)+")</script>"});
  });
  await page.route(redirectTarget,route=>route.fulfill({
    status:200,contentType:"text/html",body:[
      '<!doctype html><div id="native-navigation-probe"></div><script>',
      'const state={origin:self.origin,parentDenied:false,storageDenied:false};',
      'try{void parent.document.body}catch(e){state.parentDenied=e.name==="SecurityError"}',
      'try{localStorage.getItem("SEC04_SYNTHETIC_NATIVE_MARKER")}',
      'catch(e){state.storageDenied=e.name==="SecurityError"}',
      'document.getElementById("native-navigation-probe").textContent=JSON.stringify(state);',
      '</script>'
    ].join("")
  }));

  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Native Redirect Probe");
  await page.getByPlaceholder("https://github.com/owner/app")
    .fill("https://github.com/example/synthetic-native-probe");
  await page.getByPlaceholder("https://appetize.io/embed/BUILD_ID")
    .fill("https://appetize.io/embed/abc12345");
  await page.getByRole("button",{name:"Shto projektin"}).click();

  const iframe=page.locator('iframe[title="Native Redirect Probe · Android cloud"]');
  await expect(iframe).toHaveAttribute("src","https://appetize.io/embed/abc12345");
  await expect(iframe).toHaveAttribute("sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups");
  const probe=page.frameLocator('iframe[title="Native Redirect Probe · Android cloud"]')
    .locator("#native-navigation-probe");

  // Required future security invariant: a provider-initiated same-frame
  // navigation must never recover Studio origin or read the parent/storage.
  // If it FAILS, do NOT weaken this assertion: report the P0/P1 design risk.
  await expect(probe).toHaveText(JSON.stringify({
    origin:"null",parentDenied:true,storageDenied:true
  }));
  expect(providerRequests).toBeGreaterThanOrEqual(1);
  await expect(page).toHaveURL(studioOrigin+"/");
  expect(await page.evaluate(()=>localStorage.getItem("SEC04_SYNTHETIC_NATIVE_MARKER")))
    .toBe("test-only");
});
