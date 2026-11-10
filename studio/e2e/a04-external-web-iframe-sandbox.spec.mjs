import {test,expect} from "@playwright/test";

// All network responses are synthetic and intercepted. No real project,
// credentials or external preview is opened by this test.
test("SEC-04 external Web iframe runs permitted JS but has an opaque, storage-denied origin",async({page})=>{
  await page.route(/^https:\/\/preview\.example\.test\//,async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==="/build-info.json")return route.fulfill({
      status:404,headers:{"Access-Control-Allow-Origin":"*"},body:"Not Found"
    });
    return route.fulfill({status:200,contentType:"text/html",body:`<!doctype html>
      <html><body><input aria-label="Preview field">
        <div id="security-probe"></div>
        <script>
          let storageDenied=false;
          try{localStorage.setItem("SEC04_untrusted_frame_probe","1")}
          catch(e){storageDenied=e.name==="SecurityError"}
          document.getElementById("security-probe").textContent=
            JSON.stringify({storageDenied,origin:self.origin});
        </script></body></html>`});
  });
  await page.goto("/");
  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Security Sandbox");
  await page.getByPlaceholder("https://github.com/owner/app")
    .fill("https://github.com/example/security-sandbox");
  await page.getByPlaceholder("https://app.vercel.app").fill("https://preview.example.test");
  await page.getByRole("button",{name:"Shto projektin"}).click();

  const frameElement=page.locator('iframe[title="Security Sandbox · Expo Web"]');
  await expect(frameElement).toHaveAttribute("sandbox","allow-scripts allow-forms");
  await expect(frameElement).toHaveAttribute("referrerpolicy","no-referrer");
  const frame=page.frameLocator('iframe[title="Security Sandbox · Expo Web"]');
  await expect(frame.getByRole("textbox",{name:"Preview field"})).toBeVisible();
  await expect(frame.locator("#security-probe")).toHaveText(
    JSON.stringify({storageDenied:true,origin:"null"})
  );
  // User can still interact with a basic form while its JS is isolated.
  await frame.getByRole("textbox",{name:"Preview field"}).fill("Offline input");
  await expect(frame.getByRole("textbox",{name:"Preview field"})).toHaveValue("Offline input");
});


test("SEC-04 redirected Web iframe stays opaque even after navigating to Studio origin",async({page})=>{
  await page.goto("/");
  const studioOrigin=new URL(page.url()).origin;
  await page.evaluate(()=>localStorage.setItem("SEC04_SYNTHETIC_PARENT_MARKER","parent-only"));
  // Synthetic redirect target hosted at the Studio origin, but inside the
  // still-sandboxed child browsing context. No third-party network requests.
  await page.route(studioOrigin+"/__sec04_redirect_target",route=>route.fulfill({
    status:200,contentType:"text/html",body:`<!doctype html><div id="redirect-probe"></div><script>
      const result={origin:self.origin,parentDenied:false,storageDenied:false};
      try{void parent.document.body}catch(e){result.parentDenied=e.name==="SecurityError"}
      try{localStorage.getItem("SEC04_SYNTHETIC_PARENT_MARKER")}
      catch(e){result.storageDenied=e.name==="SecurityError"}
      document.getElementById("redirect-probe").textContent=JSON.stringify(result);
    </script>`
  }));
  await page.route(/^https:\/\/preview\.example\.test\//,route=>{
    if(new URL(route.request().url()).pathname==="/build-info.json")
      return route.fulfill({status:404,headers:{"Access-Control-Allow-Origin":"*"},body:"Not Found"});
    return route.fulfill({status:200,contentType:"text/html",
      body:`<!doctype html><script>location.replace(${JSON.stringify(studioOrigin+"/__sec04_redirect_target")})</script>`});
  });
  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Redirect Isolation");
  await page.getByPlaceholder("https://github.com/owner/app").fill("https://github.com/example/redirect-isolation");
  await page.getByPlaceholder("https://app.vercel.app").fill("https://preview.example.test");
  await page.getByRole("button",{name:"Shto projektin"}).click();
  const iframe=page.locator('iframe[title="Redirect Isolation · Expo Web"]');
  await expect(iframe).toHaveAttribute("sandbox","allow-scripts allow-forms");
  await expect(page.frameLocator('iframe[title="Redirect Isolation · Expo Web"]')
    .locator("#redirect-probe")).toHaveText(JSON.stringify({
      origin:"null",parentDenied:true,storageDenied:true
    }));
  await expect(page).toHaveURL(studioOrigin+"/");
  expect(await page.evaluate(()=>localStorage.getItem("SEC04_SYNTHETIC_PARENT_MARKER")))
    .toBe("parent-only");
});

test("SEC-04 external fallback opens a storage-dependent Web app outside the sandbox",async({page,context})=>{
  // Same synthetic host returns identical HTML in the sandboxed iframe and
  // in the top-level external fallback. No real project or network traffic.
  await context.route(/^https:\/\/preview\.example\.test\//,route=>{
    if(new URL(route.request().url()).pathname==="/build-info.json")
      return route.fulfill({status:404,headers:{"Access-Control-Allow-Origin":"*"},body:"Not Found"});
    return route.fulfill({status:200,contentType:"text/html",body:`<!doctype html>
      <div id="compat-probe"></div><script>
        let result="storage-ok";
        try{localStorage.setItem("SEC04_SYNTHETIC_COMPAT","1")}
        catch(e){result=e.name==="SecurityError"?"storage-denied":"unexpected-error"}
        document.getElementById("compat-probe").textContent=result;
      </script>`});
  });
  await page.goto("/");
  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Storage Compatibility");
  await page.getByPlaceholder("https://github.com/owner/app").fill("https://github.com/example/storage-compatibility");
  await page.getByPlaceholder("https://app.vercel.app").fill("https://preview.example.test");
  await page.getByRole("button",{name:"Shto projektin"}).click();
  await expect(page.frameLocator('iframe[title="Storage Compatibility · Expo Web"]')
    .locator("#compat-probe")).toHaveText("storage-denied");
  await expect(page.getByRole("button",{name:"↗ Hap jashtë studios"})).toBeVisible();
  const [popup]=await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button",{name:"↗ Hap jashtë studios"}).click()
  ]);
  await expect(popup).toHaveURL("https://preview.example.test/");
  await expect(popup.locator("#compat-probe")).toHaveText("storage-ok");
  await expect(page.getByText("URL e lidhur · shfaqja në iframe e paverifikuar")).toBeVisible();
  await popup.close();
});
