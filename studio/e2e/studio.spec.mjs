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
  await expect(page.getByText("alpha", {exact: true})).toBeVisible();
  const loadsBefore = observed.loads;
  revision = "beta";
  await expect(page.getByText("beta", {exact: true})).toBeVisible({timeout: 34_000});
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
