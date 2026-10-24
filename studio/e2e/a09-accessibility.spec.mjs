import {test,expect} from "@playwright/test";
import {makeZip} from "../tests/zip-fixtures.mjs";

const GITHUB="https://github.com/example/demo-app";
const WEB="https://preview.example.test";

test("A09: project fields expose programmatic names and the form works via keyboard",async({page})=>{
  await page.goto("/");
  const add=page.getByRole("button",{name:"+ Shto",exact:true});
  await add.focus();
  await page.keyboard.press("Enter");
  const name=page.getByRole("textbox",{name:"EMRI",exact:true});
  const repo=page.getByRole("textbox",{name:"GITHUB REPOSITORY",exact:true});
  const web=page.getByRole("textbox",{name:"WEB PREVIEW URL (opsionale)",exact:true});
  const native=page.getByRole("textbox",{name:"APPETIZE EMBED URL (opsionale)",exact:true});
  for(const control of [name,repo,web,native])await expect(control).toBeVisible();
  await expect(page.getByRole("button",{name:"Mbyll formularin"})).toBeVisible();

  await name.focus();
  await name.fill("A09 Keyboard Project");
  await page.keyboard.press("Tab");
  await expect(repo).toBeFocused();
  await repo.fill(GITHUB);
  await page.keyboard.press("Tab");
  await expect(web).toBeFocused();
  await web.fill(WEB);
  await page.keyboard.press("Tab");
  await expect(native).toBeFocused();

  const save=page.getByRole("button",{name:"Shto projektin"});
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button",{name:"Hap A09 Keyboard Project"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Mbyll formularin"})).toHaveCount(0);
  // Live Sync changes announce politely rather than silently updating a text node.
  await expect(page.locator('[aria-live="polite"]').filter({hasText:/kontroll|version|manifest|lidh|metadata|përgjigj|verifik/i}).first()).toBeVisible();
});

test("A09: backup and ZIP status changes have polite live announcements",async({page})=>{
  await page.goto("/");
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button",{name:"↓ Eksporto backup JSON"}).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/backup.*\.json|\.json$/i);
  const backup=page.getByText("Kopja JSON u përgatit. Ruaje në një vend të sigurt.");
  await expect(backup).toHaveAttribute("aria-live","polite");

  const source=makeZip([
    {name:"source-main/package.json",content:'{"name":"synthetic"}'},
    {name:"source-main/App.tsx",content:"export default ()=>null"}
  ]);
  const [chooser]=await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button",{name:"↑ Ngarko ZIP"}).click()
  ]);
  await chooser.setFiles({
    name:"source-only.zip",mimeType:"application/zip",buffer:Buffer.from(source)
  });
  await expect(page.getByText(/Nuk gjendet dist\/index.html/)).toHaveAttribute("aria-live","polite");
  await expect(page.getByRole("button",{name:"↑ Ngarko ZIP"})).toBeEnabled();
});
