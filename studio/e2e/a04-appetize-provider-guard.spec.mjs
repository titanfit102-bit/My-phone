import {test,expect} from "@playwright/test";

// Appetize URL is locally intercepted: no paid session or vendor API is invoked.
test("SEC-04 Appetize iframe opaque origin permits synthetic scripts but blocks browser storage",async({page})=>{
  let providerRequests=0;
  await page.route("https://appetize.io/**", async route=>{
    providerRequests++;
    await route.fulfill({status:200,contentType:"text/html",body:
      '<!doctype html><h1 data-testid="appetize-fixture">Appetize synthetic embed</h1><script>'+
      'document.body.dataset.embedOrigin=self.origin;'+
      'try{localStorage.setItem("SEC04_PROVIDER_STORAGE","x");document.body.dataset.storageAccessible="yes"}'+
      'catch{document.body.dataset.storageAccessible="no"}'+
      '</script>'});
  });
  await page.goto("/");
  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Provider Sandbox");
  await page.getByPlaceholder("https://github.com/owner/app").fill("https://github.com/example/provider");
  await page.getByPlaceholder("https://appetize.io/embed/BUILD_ID").fill("https://appetize.io/embed/abc12345");
  await page.getByRole("button",{name:"Shto projektin"}).click();
  const locator=page.locator('iframe[title="Provider Sandbox · Android cloud"]');
  await expect(locator).toHaveAttribute("src","https://appetize.io/embed/abc12345");
  await expect(locator).toHaveAttribute("referrerpolicy","no-referrer");
  await expect(locator).toHaveAttribute("sandbox",
    "allow-scripts allow-forms allow-popups");
  await expect(page.frameLocator('iframe[title="Provider Sandbox · Android cloud"]')
    .getByTestId("appetize-fixture")).toBeVisible();
  const providerBody=page.frameLocator('iframe[title="Provider Sandbox · Android cloud"]').locator("body");
  await expect(providerBody).toHaveAttribute("data-embed-origin","null");
  await expect(providerBody).toHaveAttribute("data-storage-accessible","no");
  // UI must disclose the possible compatibility trade-off and offer the
  // already available external-open fallback without starting a paid session.
  await expect(page.getByText(/Pamja Android Cloud përdor iframe të izoluar/)).toBeVisible();
  await expect(page.getByRole("button",{name:/Hap jashtë studios/})).toBeVisible();
  await expect(locator).not.toHaveAttribute("src",/autoplay=true/i);
  expect(providerRequests).toBeGreaterThanOrEqual(1);
});

test("SEC-04 rejects arbitrary non-Appetize URL from native project input",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await page.getByPlaceholder("P.sh. ILLYRIAN").fill("Rejected Provider");
  await page.getByPlaceholder("https://github.com/owner/app").fill("https://github.com/example/provider");
  await page.getByPlaceholder("https://appetize.io/embed/BUILD_ID")
    .fill("https://appetize.io.evil.example/embed/abc12345");
  await page.getByRole("button",{name:"Shto projektin"}).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator('iframe[title="Rejected Provider · Android cloud"]')).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Hap Rejected Provider"})).toHaveCount(0);
});
