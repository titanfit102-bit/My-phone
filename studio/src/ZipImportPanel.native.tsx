import React from "react";
import {View,Text} from "react-native";
export type QuickPreview={filename:string;srcDoc:string;warning:string;serial:number};
export default function ZipImportPanel({onPreview}:{onPreview?:(value:QuickPreview|null)=>void}) {
  return <View><Text>Quick Preview ZIP mund të hapet vetëm në Expo Web Studio.</Text></View>;
}
