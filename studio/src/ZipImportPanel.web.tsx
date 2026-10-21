import React,{useRef,useState} from "react";
import {View,Text,Pressable,StyleSheet,Platform} from "react-native";
import {inspectZip,MAX_ZIP_BYTES} from "./zip-inspector";

type Report={
 filename:string;count:number;archivedBytes:number;declaredBytes:number;
 root:string;framework:string;kind:string;previewReady:false;
 sample:string[];advice:string;
};
export default function ZipImportPanel() {
  const [report,setReport]=useState<Report|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const epoch=useRef(0);
  const open=()=>{
    if(Platform.OS!=="web" || typeof document==="undefined")return;
    const picker=document.createElement("input");
    picker.type="file";
    picker.accept=".zip,application/zip,application/x-zip-compressed";
    picker.onchange=async()=>{
      const file=picker.files?.[0];
      if(!file)return;
      const sequence=++epoch.current;
      setBusy(true);setReport(null);setMessage("");
      try{
        if(file.size>MAX_ZIP_BYTES)throw new Error("ZIP tejkalon 32 MB.");
        const content=await file.arrayBuffer();
        const result=inspectZip(content,file.name) as Report;
        if(sequence===epoch.current){setReport(result);setMessage("ZIP u analizua lokalisht. Asnjë skedar nuk u ekzekutua ose dërgua në server.");}
      }catch(e){
        if(sequence===epoch.current)setMessage(e instanceof Error?e.message:"ZIP nuk mund të lexohet.");
      }finally{if(sequence===epoch.current)setBusy(false);}
    };
    picker.click();
  };
  return <View style={styles.panel}>
    <Text style={styles.title}>IMPORTO ZIP NGA GITHUB</Text>
    <Text style={styles.description}>Shkarko main → Code → Download ZIP, pastaj analizoje këtu. Ky është hapi i parë: pa build cloud dhe pa preview të kodit të papërgatitur.</Text>
    <Pressable accessibilityRole="button" onPress={open} disabled={busy}
      style={styles.button}><Text style={styles.buttonLabel}>{busy?"Po analizohet...":"↑ Ngarko ZIP"}</Text></Pressable>
    {!!message&&<Text style={styles.status}>{message}</Text>}
    {report&&<View style={styles.result}>
      <Text style={styles.resultTitle}>{report.filename}</Text>
      <Text style={styles.info}>Framework: {report.framework}</Text>
      <Text style={styles.info}>Skedarë: {report.count} · Madhësia ZIP: {(report.archivedBytes/1048576).toFixed(2)} MB</Text>
      <Text style={styles.info}>Dosja: {report.root}</Text>
      <Text style={styles.advice}>{report.advice}</Text>
      <Text style={styles.note}>Preview: NUK është gjeneruar. Build-i është fazë tjetër, me autorizim.</Text>
    </View>}
  </View>;
}
const styles=StyleSheet.create({
 panel:{borderWidth:1,borderColor:"#33435F",backgroundColor:"#111D32",borderRadius:12,padding:12,marginBottom:15},
 title:{color:"#E9F0FF",fontWeight:"800",fontSize:11,letterSpacing:1},
 description:{color:"#9AAAC8",fontSize:11,lineHeight:17,marginTop:8,marginBottom:10},
 button:{backgroundColor:"#334EBC",borderRadius:8,padding:10,alignItems:"center"},
 buttonLabel:{fontSize:12,fontWeight:"800",color:"#FFFFFF"},
 status:{color:"#D8E5FF",fontSize:11,lineHeight:17,marginTop:9},
 result:{borderTopColor:"#33435F",borderTopWidth:1,marginTop:10,paddingTop:10,gap:5},
 resultTitle:{color:"#FFFFFF",fontSize:12,fontWeight:"800"},
 info:{color:"#B7C5DD",fontSize:11},
 advice:{color:"#F1CD87",lineHeight:17,fontSize:11,marginTop:4},
 note:{color:"#FFB6A9",lineHeight:17,fontSize:11}
});
