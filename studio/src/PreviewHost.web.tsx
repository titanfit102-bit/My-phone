import React from "react";
import {View, Text, StyleSheet} from "react-native";

type Props = {url: string; variant: "web" | "native"; revision: number; title: string};
export default function PreviewHost({url, variant, revision, title}: Props) {
  if (!url) return <View style={styles.empty}><Text style={styles.emptyTitle}>Nuk ka preview për këtë modalitet.</Text></View>;
  const key = variant + "-" + url + "-" + revision;
  // The iframe only embeds the deployed web app OR an Appetize-owned device.
  // Do not append query params to Appetize: a build link identifies a particular APK version.
  return (
    <iframe
      key={key}
      title={title + " · " + (variant === "native" ? "Android cloud" : "Expo Web")}
      src={url}
      loading="eager"
      referrerPolicy="no-referrer"
      allow="fullscreen; clipboard-write"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{border: 0, width: "100%", height: "100%", backgroundColor: variant === "native" ? "#101626" : "#FFFFFF"}}
    />
  );
}
const styles = StyleSheet.create({
  empty: {flex:1,alignItems:"center",justifyContent:"center"},
  emptyTitle:{color:"#A6B1C8",fontSize:12}
});
