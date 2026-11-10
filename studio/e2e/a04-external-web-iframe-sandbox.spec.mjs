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
