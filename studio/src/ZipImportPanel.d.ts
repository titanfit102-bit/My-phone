import type {ComponentType} from "react";
export type QuickPreview={filename:string;srcDoc:string;warning:string;serial:number};
declare const ZipImportPanel:ComponentType<{onPreview:(value:QuickPreview|null)=>void}>;
export default ZipImportPanel;
