import React from "react";
import {View, Text, StyleSheet} from "react-native";
import {cleanAppetizeEmbed, cleanWebUrl} from "./project-model";

type Props = {url: string; variant: "web" | "native"; revision: number; title: string};
export default function PreviewHost({url, variant, revision, title}: Props) {
  if (!url) return <View style={styles.empty}><Text style={styles.emptyTitle}>Nuk ka preview për këtë modalitet.</Text></View>;
  // Revalidate both URL types at the iframe sink, even if future callers bypass
  // project form/registry checks. Never grant native permissions for an unknown mode.
  if (variant !== "native" && variant !== "web") {
    return <View style={styles.empty}><Text style={styles.emptyTitle}>Modaliteti i preview nuk është i vlefshëm.</Text></View>;
  }
  let safeUrl: string;
  try {
    safeUrl = variant === "native" ? cleanAppetizeEmbed(url) : cleanWebUrl(url);
    if (!safeUrl) throw Error("Empty preview URL");
  } catch {
    // No untrusted URL or credentials are reflected into the UI.
    return <View style={styles.empty}><Text style={styles.emptyTitle}>{variant === "native" ? "Lidhja Appetize nuk është e vlefshme." : "Lidhja Web nuk është e vlefshme."}</Text></View>;
  }
  const key = variant + "-" + safeUrl + "-" + revision;
  // The iframe only embeds the deployed web app OR an Appetize-owned device.
  // Untrusted third-party Web URLs must use an opaque origin, because combining
  // allow-scripts + allow-same-origin can permit sandbox escape after navigation
  // to the Studio origin. Apps requiring third-party storage may need external open.
  // SEC-04 candidate: allow scripts/forms/popups, but never same-origin.
  // Native popups inherit opaque-origin sandbox without escape permissions.
  // WARNING: provider cookies/storage/SSO compatibility remains UNVERIFIED.
  // Keep this isolated Draft until real Appetize integration acceptance.
  // Do not append query params to Appetize: a build link identifies a particular APK version.
  return (
    <iframe
      key={key}
      title={title + " · " + (variant === "native" ? "Android cloud" : "Expo Web")}
      src={safeUrl}
      loading="eager"
      referrerPolicy="no-referrer"
      allow="fullscreen; clipboard-write"
      sandbox={variant === "web" ? "allow-scripts allow-forms" : "allow-scripts allow-forms allow-popups"}
      style={{border: 0, width: "100%", height: "100%", backgroundColor: variant === "native" ? "#101626" : "#FFFFFF"}}
    />
  );
}
const styles = StyleSheet.create({
  empty: {flex:1,alignItems:"center",justifyContent:"center"},
  emptyTitle:{color:"#A6B1C8",fontSize:12}
});
