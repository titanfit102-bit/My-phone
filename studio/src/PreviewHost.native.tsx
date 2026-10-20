import React from "react";
import {View, Text, StyleSheet} from "react-native";

type Props = {url: string; variant: "web" | "native"; revision: number; title: string};
export default function PreviewHost(_props: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Pamje e disponueshme në versionin Web</Text>
      <Text style={styles.description}>
        Hap My Phone Studio nga Vercel për të testuar Expo Web dhe emulatorin Android të integruar.
        Në telefonin fizik testo aplikacionin përmes Expo / development build.
      </Text>
    </View>
  );
}
const styles=StyleSheet.create({
  box:{flex:1,justifyContent:"center",padding:22,backgroundColor:"#121C31"},
  title:{fontSize:16,color:"#FFFFFF",fontWeight:"700",textAlign:"center"},
  description:{fontSize:12,color:"#A6B1C8",marginTop:10,lineHeight:20,textAlign:"center"}
});
