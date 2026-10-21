import React,{useRef,useState} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {inspectZip,MAX_ZIP_BYTES} from "./zip-inspector";
import {buildQuickPreview} from "./quick-preview";
import {assessZipInspection} from "./engine-core";

export type QuickPreview={filename:string;srcDoc:string;warning:string;serial:number};
export default function ZipImportPanel({onPreview}:{onPreview:(value:QuickPreview|null)=>void}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [active,setActive]=useState(false);
  const [assessment,setAssessment]=useState<ReturnType<typeof assessZipInspection>|null>(null);
  const epoch=useRef(0);
  const pick=()=>{
    const picker=document.createElement("input");
    picker.type="file";
    picker.accept=".zip,application/zip,application/x-zip-compressed";
    picker.onchange=async()=>{
      const file=picker.files?.[0];if(!file)return;
      const ticket=++epoch.current;
      onPreview(null);setActive(false);setBusy(true);setMessage("");setAssessment(null);
      let inspection:ReturnType<typeof inspectZip>|null=null;
      try{
        if(file.size>MAX_ZIP_BYTES)throw Error("ZIP tejkalon 32 MB.");
        const bytes=await file.arrayBuffer();
        const info=inspectZip(bytes,file.name);
        inspection=info;
        if(ticket!==epoch.current)return;
        setAssessment(assessZipInspection(info));
        const built=await buildQuickPreview(bytes,file.name);
        if(ticket!==epoch.current)return;
        onPreview({filename:built.filename,srcDoc:built.srcDoc,warning:built.warning,serial:1});
        setAssessment(assessZipInspection(info,{status:"prepared"}));
        setActive(true);
        setMessage(info.count+" skedarë · Web build u gjet. Quick Preview u hap në telefon.");
      }catch(e){
        if(ticket!==epoch.current)return;
        const failure=e instanceof Error?e.message:"ZIP nuk mund të shfaqet.";
        setMessage(failure);
        if(inspection)setAssessment(assessZipInspection(inspection,{status:"failed",error:failure}));
      }finally{if(ticket===epoch.current)setBusy(false);}
    };
    picker.click();
  };
  const close=()=>{
    ++epoch.current;onPreview(null);setActive(false);setBusy(false);setAssessment(null);
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
    {assessment&&<View style={styles.engineBox}>
      <Text style={styles.engineTitle}>ENGINE CORE · {assessment.decision.code}</Text>
      <Text style={styles.engineDetail}>{assessment.source.framework}</Text>
      <Text style={styles.engineDetail}>{assessment.diagnostics[0].detail}</Text>
      <Text style={styles.engineNext}>{assessment.diagnostics[0].nextAction}</Text>
    </View>}
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
  note:{fontSize:10,color:"#C2A4B3",lineHeight:16,marginTop:9},
  engineBox:{borderWidth:1,borderColor:"#614156",backgroundColor:"#180F1B",borderRadius:10,padding:10,marginTop:10},
  engineTitle:{fontSize:10,fontWeight:"800",color:"#FFAFCA",letterSpacing:.7,marginBottom:6},
  engineDetail:{fontSize:10,color:"#EAD4DE",lineHeight:16,marginTop:3},
  engineNext:{fontSize:10,color:"#BCA2B0",lineHeight:16,marginTop:7}
});
