import type {ComponentType} from "react";

export type PreviewHostProps = {
  url:string;
  variant:"web" | "native";
  revision:number;
  title:string;
};
declare const PreviewHost:ComponentType<PreviewHostProps>;
export default PreviewHost;
