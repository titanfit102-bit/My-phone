declare module "./PreviewHost" {
  import React from "react";
  type Props={url:string;variant:"web"|"native";revision:number;title:string};
  const PreviewHost: React.ComponentType<Props>;
  export default PreviewHost;
}
