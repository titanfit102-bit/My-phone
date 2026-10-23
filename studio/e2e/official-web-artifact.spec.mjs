import {test,expect} from "@playwright/test";
import {makeZip} from "../tests/zip-fixtures.mjs";

const png=Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mPQKXj3H4QZYAwAVWgKJasJe+IAAAAASUVORK5CYII=",
  "base64"));
async function upload(page,zip,name){
  const chooser=page.waitForEvent("filechooser");
  await page.getByRole("button",{name:"↑ Ngarko ZIP"}).click();
  await (await chooser).setFiles({name,mimeType:"application/zip",buffer:Buffer.from(zip)});
}
test("Expo Web artifact offline renders and isolates the session",async({page})=>{
  await page.goto("/");
  const bundle='const image={uri:"/assets/assets/pixel.abc123.png"};'+
    'document.getElementById("root").innerHTML="<h2>Expo ZIP Working</h2><button id=counter>Count: 0</button>";'+
    'document.getElementById("counter").onclick=()=>{document.getElementById("counter").textContent="Count: 1";};'+
    'window.__testImage=image.uri;';
  const zip=makeZip([
    {name:"dist/index.html",content:'<div id="root"></div><script src="/_expo/static/js/web/AppEntry-123abc.js" defer></script>'},
    {name:"dist/metadata.json",content:'{"version":0,"bundler":"metro","fileMetadata":{}}'},
    {name:"dist/_expo/static/js/web/AppEntry-123abc.js",content:bundle},
    {name:"dist/assets/assets/pixel.abc123.png",bytes:png}
  ]);
  await upload(page,zip,"expo-fixture.zip");
  const frame=page.frameLocator('iframe[title="Quick Preview · ZIP"]');
  await expect(frame.getByRole("heading",{name:"Expo ZIP Working"})).toBeVisible();
  await frame.getByRole("button",{name:"Count: 0"}).click();
  await expect(frame.getByRole("button",{name:"Count: 1"})).toBeVisible();
  expect(await frame.locator("body").evaluate(()=>{
    let deniedParent=false,deniedStorage=false;
    try{void parent.document.body.textContent}catch{deniedParent=true}
    try{localStorage.setItem("leak","1")}catch{deniedStorage=true}
    return {opaque:origin==="null",deniedParent,deniedStorage}
  })).toEqual({opaque:true,deniedParent:true,deniedStorage:true});
  await page.getByRole("button",{name:"✕ Mbyll Quick Preview"}).click();
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
});
test("multi-chunk Vite ZIP is blocked with precise HTTP-origin diagnostic",async({page})=>{
  await page.goto("/");
  const zip=makeZip([
    {name:"dist/index.html",content:'<script type="module" src="/assets/main.js"></script>'},
    {name:"dist/assets/main.js",content:'import("./lazy.js");'},
    {name:"dist/assets/lazy.js",content:'export const works=true;'}
  ]);
  await upload(page,zip,"multichunk.zip");
  await expect(page.getByText(/Vite me shumë JS chunks kërkon preview me origin HTTP të izoluar/).first()).toBeVisible();
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
});
