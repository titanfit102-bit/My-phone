import React,{useRef,useState} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {inspectZip,MAX_ZIP_BYTES} from "./zip-inspector";
import {buildQuickPreview} from "./quick-preview";

export type QuickPreview={filename:string;srcDoc:string;warning:string;serial:number};
export default function ZipImportPanel({onPreview}:{onPreview:(value:QuickPreview|null)=>void}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [active,setActive]=useState(false);
  const epoch=useRef(0);
  const pick=()=>{
    const picker=document.createElement("input");
    picker.type="file";
    picker.accept=".zip,application/zip,application/x-zip-compressed";
    picker.onchange=async()=>{
      const file=picker.files?.[0];if(!file)return;
      const ticket=++epoch.current;
      onPreview(null);setActive(false);setBusy(true);setMessage("");
      try{
        if(file.size>MAX_ZIP_BYTES)throw Error("ZIP tejkalon 32 MB.");
        const bytes=await file.arrayBuffer();
        const info=inspectZip(bytes,file.name);
        const built=await buildQuickPreview(bytes,file.name);
        if(ticket!==epoch.current)return;
        onPreview({filename:built.filename,srcDoc:built.srcDoc,warning:built.warning,serial:1});
        setActive(true);
        setMessage(info.count+" skedarë · Web build u gjet. Quick Preview u hap në telefon.");
      }catch(e){
        if(ticket!==epoch.current)return;
        setMessage(e instanceof Error?e.message:"ZIP nuk mund të shfaqet.");
      }finally{if(ticket===epoch.current)setBusy(false);}
    };
    picker.click();
  };
  const close=()=>{
    ++epoch.current;onPreview(null);setActive(false);setBusy(false);
    setMessage("Sesioni përfundoi. Ky ZIP nuk ruhet në My Projects.");
  };
  return <View style={styles.panel}>
    <Text style={styles.title}>QUICK PREVIEW NGA ZIP</Text>
    <Text style={styles.description}>Ngarko ZIP-in e shkarkuar nga GitHub. Nëse përmban dist/index.html dhe një bundle Vite të gatshëm, hapet përkohësisht në ekranin e telefonit.</Text>
    <Pressable accessibilityRole="button" onPress={pick} disabled={busy} style={styles.button}>
      <Text style={styles.buttonText}>{busy?"Po lexohet ZIP...":"↑ Ngarko ZIP"}</Text>
    </Pressable>
    {active&&<Pressable accessibilityRole="button" onPress={close} style={styles.close}>
      <Text style={styles.closeText}>✕ Mbyll Quick Preview</Text>
    </Pressable>}
    {!!message&&<Text style={styles.status}>{message}</Text>}
    <Text style={styles.note}>Vetëm në këtë seancë. Pa server, pa instalim, pa ruajtje të ZIP-it. Nuk ekzekuton backend apo kod burimor.</Text>
  </View>;
}
const styles=StyleSheet.create({
  panel:{borderWidth:1,borderColor:"#553645",backgroundColor:"#24151E",borderRadius:14,padding:14,marginBottom:15},
  title:{color:"#FFB4C8",fontWeight:"800",fontSize:11,letterSpacing:1.2},
  description:{color:"#C5A9B8",fontSize:11,lineHeight:17,marginTop:8,marginBottom:12},
  button:{backgroundColor:"#F44678",borderRadius:10,padding:11,alignItems:"center"},
  buttonText:{fontSize:12,fontWeight:"800",color:"#FFFFFF"},
  close:{marginTop:9,borderWidth:1,borderColor:"#805060",borderRadius:10,padding:10,alignItems:"center"},
  closeText:{color:"#FFD2DD",fontSize:11,fontWeight:"700"},
  status:{color:"#F5D9E5",fontSize:11,lineHeight:17,marginTop:9},
  note:{fontSize:10,color:"#C2A4B3",lineHeight:16,marginTop:9}
});
