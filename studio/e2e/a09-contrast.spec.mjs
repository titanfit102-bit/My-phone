import {test,expect} from "@playwright/test";

// WCAG 2.2, SC 1.4.3: real computed foreground/background, not a hardcoded
// brand-palette assertion. Normal text, including this 11px button label,
// must achieve a contrast ratio of at least 4.5:1.
const channel = v => {
  const s=v/255;
  return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;
};
function luminance(rgb) {
  const v=rgb.match(/[\d.]+/g)?.slice(0,3).map(Number);
  if(!v||v.length!==3||v.some(n=>!Number.isFinite(n)))
    throw Error("Invalid computed CSS color: "+rgb);
  return 0.2126*channel(v[0])+0.7152*channel(v[1])+0.0722*channel(v[2]);
}
function contrast(a,b) {
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}

test("A09 contrast: real primary buttons satisfy 4.5:1 in Studio",async ({page})=>{
  await page.goto("/");
  const check=async label=>{
    const button=page.getByRole("button",{name:label,exact:true});
    await expect(button).toBeVisible();
    const colors=await button.evaluate((element,name)=>{
      // RN Web Pressable renders as a role=button element, with the Text
      // component in a nested leaf. Measure the actual painted leaf text.
      const leaf=Array.from(element.querySelectorAll("*"))
        .find(e=>e.children.length===0 && e.textContent?.trim()===name);
      if(!leaf)throw Error("Cannot locate button leaf text for "+name);
      return {foreground:getComputedStyle(leaf).color,
        background:getComputedStyle(element).backgroundColor};
    },label);
    expect(contrast(colors.foreground,colors.background),
      label+" rendered contrast "+JSON.stringify(colors)).toBeGreaterThanOrEqual(4.5);
    // Regression protection: 11px normal label must not be treated as large text.
    await expect(button).toBeEnabled();
  };
  await check("+ Shto");
  await page.getByRole("button",{name:"+ Shto",exact:true}).click();
  await check("Shto projektin");
});
