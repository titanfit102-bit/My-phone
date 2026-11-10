import React from "react";
import {View, Text, StyleSheet} from "react-native";
import {cleanAppetizeEmbed} from "./project-model";

type Props = {url: string; variant: "web" | "native"; revision: number; title: string};
export default function PreviewHost({url, variant, revision, title}: Props) {
  if (!url) return <View style={styles.empty}><Text style={styles.emptyTitle}>Nuk ka preview për këtë modalitet.</Text></View>;
  // Defense in depth at the privileged embed sink: project creation/backup already
  // checks provider URLs, but iframe rendering must not trust arbitrary callers.
  // Keep Appetize's existing session sandbox until a real compatibility test.
  let safeUrl = url;
  if (variant === "native") {
    try { safeUrl = cleanAppetizeEmbed(url); }
    catch { return <View style={styles.empty}><Text style={styles.emptyTitle}>Lidhja Appetize nuk është e vlefshme.</Text></View>; }
  }
  const key = variant + "-" + safeUrl + "-" + revision;
  // The iframe only embeds the deployed web app OR an Appetize-owned device.
  // Untrusted third-party Web URLs must use an opaque origin, because combining
  // allow-scripts + allow-same-origin can permit sandbox escape after navigation
  // to the Studio origin. Apps requiring third-party storage may need external open.
  // Appetize is a separately constrained provider embed; preserve its legacy
  // sandbox settings until that integration has a dedicated compatibility review.
  // Do not append query params to Appetize: a build link identifies a particular APK version.
  return (
    <iframe
      key={key}
      title={title + " · " + (variant === "native" ? "Android cloud" : "Expo Web")}
      src={safeUrl}
      loading="eager"
      referrerPolicy="no-referrer"
      allow="fullscreen; clipboard-write"
      sandbox={variant === "web" ? "allow-scripts allow-forms" : "allow-scripts allow-same-origin allow-forms allow-popups"}
      style={{border: 0, width: "100%", height: "100%", backgroundColor: variant === "native" ? "#101626" : "#FFFFFF"}}
    />
  );
}
const styles = StyleSheet.create({
  empty: {flex:1,alignItems:"center",justifyContent:"center"},
  emptyTitle:{color:"#A6B1C8",fontSize:12}
});
