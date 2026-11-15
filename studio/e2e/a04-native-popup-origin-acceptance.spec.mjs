import {test,expect} from "@playwright/test";

// Required RED acceptance from Draft PR48, now copied unchanged in behavior.
 // Candidate native sandbox removes allow-same-origin; popup should inherit
 // opaque origin while allow-popups stays. No actual Appetize/session contacted.
 // Provider storage/SSO compatibility is NOT validated.
test("SEC-04 REQUIRED: Appetize popup must not regain Studio origin despite CSP anti-framing",async({page})=>{
  await page.goto("/");
  const studioOrigin=new URL(page.url()).origin;
  const target=studioOrigin+"/__sec04_native_popup_origin_probe";
  await page.evaluate(()=>localStorage.setItem("SEC04_NATIVE_POPUP_MARKER","synthetic-only"));
  let providerRequests=0;
  let targetRequests=0;

  // context.route, not page.route: Playwright must intercept the POPUP's
  // very first navigation, which page.route cannot reliably intercept.
  await page.context().route("https://appetize.io/**",route=>{
    providerRequests++;
    return route.fulfill({status:200,contentType:"text/html",
      body:"<!doctype html><button id='open-native-popup' onclick='window.open("+
        JSON.stringify(target)+",\"_blank\")'>Open synthetic popup</button>"});
  });
  await page.context().route(target,route=>{
    targetRequests++;
    return route.fulfill({status:200,contentType:"text/html",headers:{
      "Content-Security-Policy":"frame-ancestors 'none'",
      "X-Frame-Options":"DENY",
      "X-Content-Type-Options":"nosniff"
    },body:[
      '<!doctype html><div id="sec04-popup-state"></div><script>',
      'const state={origin:self.origin,openerPresent:!!opener,parentDenied:false,storageDenied:false,storageValue:null};',
      'try{void opener.parent.document.body}catch(e){state.parentDenied=e.name==="SecurityError"}',
      'try{state.storageValue=localStorage.getItem("SEC04_NATIVE_POPUP_MARKER")}',
      'catch(e){state.storageDenied=e.name==="SecurityError"}',
      'document.getElementById("sec04-popup-state").textContent=JSON.stringify(state);',
      '</script>'
    ].join("")});
  });

  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Native Popup Probe");
  await page.getByPlaceholder("https://github.com/owner/app")
    .fill("https://github.com/example/synthetic-native-popup-probe");
  await page.getByPlaceholder("https://appetize.io/embed/BUILD_ID")
    .fill("https://appetize.io/embed/abc12345");
  await page.getByRole("button",{name:"Shto projektin"}).click();

  const iframe=page.locator('iframe[title="Native Popup Probe · Android cloud"]');
  await expect(iframe).toHaveAttribute("sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups");
  await expect(iframe).toHaveAttribute("src","https://appetize.io/embed/abc12345");
  const popupEvent=page.waitForEvent("popup",{timeout:12000});
  await page.frameLocator('iframe[title="Native Popup Probe · Android cloud"]')
    .locator("#open-native-popup").click();
  const popup=await popupEvent;
  await expect(popup).toHaveURL(target);
  // frame-ancestors is a framing restriction; this is a TOP-LEVEL popup.
  expect(await popup.evaluate(()=>self===top)).toBe(true);
  const result=popup.locator("#sec04-popup-state");
  await expect(result).not.toBeEmpty();
  const state=JSON.parse(await result.innerText());
  console.log("SEC04 synthetic native popup origin outcome:",JSON.stringify(state));

  await expect.poll(()=>providerRequests).toBeGreaterThanOrEqual(1);
  await expect.poll(()=>targetRequests).toBeGreaterThanOrEqual(1);
  await expect(page).toHaveURL(studioOrigin+"/");
  expect(await page.evaluate(()=>localStorage.getItem("SEC04_NATIVE_POPUP_MARKER")))
    .toBe("synthetic-only");

  // Preserve PR48 required security invariant; RED blocks this candidate.
  expect(state.origin).toBe("null");
  expect(state.parentDenied).toBe(true);
  expect(state.storageDenied).toBe(true);
  expect(state.storageValue).toBeNull();
});
