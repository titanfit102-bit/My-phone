import {test,expect} from "@playwright/test";
import fs from "node:fs";
import {resolve} from "node:path";

// Run only with a fresh official Expo Web ZIP from the isolated PoF2.10 CI.
test("PoF2.10: official Expo export ZIP renders inside Studio and stays isolated",async({page},testInfo)=>{
  const input=process.env.MY_PHONE_OFFICIAL_EXPO_ZIP;
  test.skip(!input,"requires verified, officially built Expo ZIP fixture");
  const zip=resolve(input);
  expect(fs.statSync(zip).size).toBeGreaterThan(0);
  const errors=[],remote=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("request",request=>{
    if(/^https?:/.test(request.url())&&!request.url().startsWith("http://127.0.0.1:4173/"))
      remote.push(request.url());
  });
  await page.goto("/");
  const chooser=page.waitForEvent("filechooser");
  await page.getByRole("button",{name:"↑ Ngarko ZIP"}).click();
  await (await chooser).setFiles({
    name:"official-expo-web.zip",mimeType:"application/zip",buffer:fs.readFileSync(zip)
  });
  const frame=page.frameLocator('iframe[title="Quick Preview · ZIP"]');
  await expect(frame.getByText("Expo Web official build fixture")).toBeVisible({timeout:30000});
  await frame.getByText("Count: 0").click();
  await expect(frame.getByText("Count: 1")).toBeVisible();
  const imageDecoded=await frame.locator("body").evaluate(async()=>{
    const candidates=[...document.querySelectorAll("img,[data-testid='pof-expo-img']")];
    for(const root of candidates)for(const element of [root,...root.querySelectorAll("*")]){
      if(element instanceof HTMLImageElement){
        try{await element.decode()}catch{continue}
        if(element.naturalWidth===2&&element.naturalHeight===2)return true;
      }
      const bg=getComputedStyle(element).backgroundImage;
      const url=bg.match(/url\(["']?(.*?)["']?\)/)?.[1];
      if(!url)continue;
      const image=new Image();image.src=url;
      try{await image.decode()}catch{continue}
      if(image.naturalWidth===2&&image.naturalHeight===2)return true;
    }
    return false;
  });
  expect(imageDecoded,"Official Expo PNG should decode after Studio ZIP import").toBe(true);
  const isolated=await frame.locator("body").evaluate(()=>{
    let parentDenied=false,storageDenied=false;
    try{void parent.document.body.textContent}catch{parentDenied=true}
    try{void localStorage.getItem("probe")}catch{storageDenied=true}
    return {opaque:origin==="null",parentDenied,storageDenied};
  });
  expect(isolated).toEqual({opaque:true,parentDenied:true,storageDenied:true});
  expect(remote,"Offline imported fixture should make no remote requests").toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath("official-expo-studio.png")});
  await page.getByRole("button",{name:"✕ Mbyll Quick Preview"}).click();
  await expect(page.locator('iframe[title="Quick Preview · ZIP"]')).toHaveCount(0);
});
