import React, {useCallback, useEffect, useMemo, useState} from "react";
import {
  ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, useWindowDimensions, View
} from "react-native";
import PreviewHost from "./src/PreviewHost";
import {STORAGE_KEY, newProject, loadProjects, chooseMode, freshWebUrl} from "./src/project-model";
import {
  SYNC_POLL_MS, FALLBACK_REFRESH_MS, FETCH_TIMEOUT_MS, MAX_MANIFEST_BYTES,
  manifestUrl, parseManifest, initialSyncState, transitionSync, summarizeSync
} from "./src/live-sync";

type Project = {id:string;name:string;github:string;web:string;native:string};
type Mode = "web" | "native";
type Draft = {name:string;github:string;web:string;native:string};
const EMPTY:Draft = {name:"",github:"",web:"",native:""};
const C = {
  base:"#080D1A", panel:"#101A2C", elevated:"#17243A", outline:"#26334C",
  text:"#F3F6FF", muted:"#8B9AB5", accent:"#637DFF", green:"#54DDB4",
  orange:"#F4B56B", red:"#FB7786", surface:"#0D1526", soft:"#BAC7E0"
};
const isWeb = Platform.OS === "web";
const canStore = isWeb && typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const link = (value:string) => { if(value) void Linking.openURL(value).catch(() => {}); };
const newId = () => "project-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
function safeLoad():Project[] {
  if(!canStore) return [];
  try{return loadProjects(window.localStorage.getItem(STORAGE_KEY));}catch{return [];}
}
function persist(projects:Project[]) {
  if(!canStore) return;
  try {window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));}catch{}
}
function RoundButton({label, onPress, primary=false, danger=false}:{
  label:string;onPress:()=>void;primary?:boolean;danger?:boolean
}) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({pressed})=>[styles.roundButton,primary&&styles.primaryButton,danger&&styles.dangerButton,pressed&&styles.pressed]}>
    <Text style={[styles.buttonText,primary&&styles.primaryText,danger&&styles.dangerText]}>{label}</Text>
  </Pressable>;
}
function Badge({children,good=false}:{children:React.ReactNode;good?:boolean}) {
  return <View style={[styles.badge,good&&styles.badgeGreen]}><Text style={[styles.badgeText,good&&styles.badgeTextGreen]}>{children}</Text></View>;
}
function Field({title,value,onChange,placeholder,autoCapitalize="none"}:{
  title:string;value:string;onChange:(value:string)=>void;placeholder:string;autoCapitalize?:"none"|"sentences"
}) {
  return <View style={{marginBottom:12}}>
    <Text style={styles.label}>{title}</Text>
    <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder}
      placeholderTextColor="#687994" autoCapitalize={autoCapitalize} autoCorrect={false}
      selectTextOnFocus={false} />
  </View>;
}
export default function App() {
  const {width} = useWindowDimensions();
  const isCompact = width < 940;
  const [projects,setProjects] = useState<Project[]>([]);
  const [selected,setSelected] = useState<string|null>(null);
  const [mode,setMode] = useState<Mode>("web");
  const [formOpen,setFormOpen] = useState(false);
  const [editing,setEditing] = useState<string|null>(null);
  const [pendingRemoval,setPendingRemoval] = useState<string|null>(null);
  const [draft,setDraft] = useState<Draft>(EMPTY);
  const [error,setError] = useState("");
  const [loaded,setLoaded] = useState(false);
  const [revision,setRevision] = useState(1);
  const [syncEnabled,setSyncEnabled] = useState(true);
  const [lastUpdate,setLastUpdate] = useState<string|null>(null);
  const [syncState,setSyncState] = useState<ReturnType<typeof initialSyncState> & {revision:string|null}>(initialSyncState());

  useEffect(()=> {
    const state = safeLoad();
    setProjects(state);
    setSelected(state[0]?.id || null);
    setLoaded(true);
  },[]);
  useEffect(()=> {if(loaded)persist(projects);},[loaded,projects]);
  const current = projects.find(p=>p.id===selected) || null;
  const currentMode = current ? chooseMode(current,mode) as Mode : mode;
  const reload = useCallback(()=>{setRevision(r=>r+1);setLastUpdate(new Date().toLocaleTimeString("sq-AL"));},[]);
  // Read-only deploy observation. Browser CORS rules can block private deployments.
  // A successful manifest confirms only the published revision, NOT GitHub CI status.
  useEffect(()=>{
    if(!isWeb || !current?.web || currentMode!=="web" || !syncEnabled) {
      setSyncState({...initialSyncState(),phase:!syncEnabled?"paused":"checking"});
      return;
    }
    let stopped = false;
    let inFlight = false;
    let request:AbortController|null = null;
    let snapshot = initialSyncState();
    let lastFallback = Date.now();
    setSyncState(snapshot);
    async function check() {
      if(stopped || inFlight || (typeof document!=="undefined" && document.visibilityState==="hidden")) return;
      inFlight = true;
      const abort = new AbortController();
      request = abort;
      const timeout = setTimeout(()=>abort.abort(), FETCH_TIMEOUT_MS);
      let outcome: {kind:"published"|"unsupported"|"restricted"|"unreachable";manifest?:ReturnType<typeof parseManifest>} = {kind:"unreachable"};
      try {
        const response = await fetch(manifestUrl(current!.web), {
          signal:abort.signal,cache:"no-store",credentials:"omit",headers:{Accept:"application/json"}
        });
        if(response.status===404 || response.status===405) outcome={kind:"unsupported"};
        else if(response.status===401 || response.status===403) outcome={kind:"restricted"};
        else if(response.ok) {
          const length = Number(response.headers.get("content-length")||"0");
          if(length>MAX_MANIFEST_BYTES) outcome={kind:"unsupported"};
          else {
            const body = await response.text();
            if(body.length>MAX_MANIFEST_BYTES) outcome={kind:"unsupported"};
            else {
              let parsed = null;
              try {parsed=parseManifest(JSON.parse(body));} catch {}
              outcome=parsed?{kind:"published",manifest:parsed}:{kind:"unsupported"};
            }
          }
        }
      } catch {
        // A network error or blocked CORS response does not imply build failure.
        outcome={kind:"unreachable"};
      } finally {
        clearTimeout(timeout);
        if(request===abort) request=null;
        inFlight=false;
      }
      if(stopped) return; // Ignore late responses from another selected project.
      const next = transitionSync(snapshot,outcome,Date.now());
      snapshot = next.state;
      setSyncState(next.state);
      if(next.reload) {
        reload();
        lastFallback=Date.now();
      } else if(next.state.strategy==="fallback" &&
                Date.now()-lastFallback>=FALLBACK_REFRESH_MS) {
        reload();
        lastFallback=Date.now();
      }
    }
    void check();
    const timer=setInterval(()=>{void check();},SYNC_POLL_MS);
    return ()=>{stopped=true;clearInterval(timer);request?.abort();};
  },[current?.id,current?.web,currentMode,syncEnabled,reload]);
  const previewUrl = useMemo(()=>{
    if(!current) return "";
    if(currentMode==="native") return current.native;
    if(!current.web) return "";
    try{return freshWebUrl(current.web,revision);}catch{return "";}
  },[current,currentMode,revision]);

  const addNew = () => {setEditing(null);setDraft(EMPTY);setError("");setFormOpen(true);};
  const edit = (project:Project) => {
    setEditing(project.id);setDraft({name:project.name,github:project.github,web:project.web,native:project.native});
    setError("");setFormOpen(true);
  };
  const save = () => {
    try {
      const value = newProject(draft, editing || newId()) as Project;
      if (isWeb && value.web && typeof window !== "undefined" &&
          new URL(value.web).origin === window.location.origin)
        throw new Error("Mos përdor adresën e vetë studios si demo: iframe në të njëjtin origin nuk lejohet.");
      const next=editing ? projects.map(p=>p.id===editing?value:p) : [...projects,value];
      setProjects(next);setSelected(value.id);setMode(chooseMode(value,mode) as Mode);
      setFormOpen(false);setEditing(null);setError("");setRevision(r=>r+1);
    } catch(e) {setError(e instanceof Error?e.message:"Të dhënat nuk u pranuan.");}
  };
  const remove = (project:Project) => {
    // Require a second explicit click. This removes a local bookmark, never source code.
    if(pendingRemoval!==project.id){setPendingRemoval(project.id);return;}
    setPendingRemoval(null);
    const next=projects.filter(p=>p.id!==project.id);
    setProjects(next);setSelected(next[0]?.id || null);setFormOpen(false);
  };
  const pick = (project:Project) => {
    setSelected(project.id);setFormOpen(false);setPendingRemoval(null);setMode(chooseMode(project,mode) as Mode);
    setRevision(r=>r+1);
  };
  const previewWidth = currentMode==="web" ? 382 : 434;
  const syncSummary = summarizeSync(syncState);
  const readableTime = (time:number|null) => time ? new Date(time).toLocaleTimeString("sq-AL") : "—";
  return (
    <View style={styles.app}>
      <View style={styles.topbar}>
        <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoLetter}>M</Text></View>
          <View><Text style={styles.brandTitle}>MY PHONE <Text style={{color:C.accent}}>STUDIO</Text></Text>
            <Text style={styles.brandSubtitle}>EXPO · WEB + ANDROID CLOUD</Text></View>
        </View>
        <View style={styles.topright}><Badge good>STUDIO v0.4</Badge><Text style={styles.topHint}>GitHub → Build → Preview</Text></View>
      </View>
      <View style={[styles.main,isCompact&&styles.mainMobile]}>
        <ScrollView contentContainerStyle={styles.sidebarContent}
          style={[styles.sidebar,isCompact&&styles.sidebarMobile]} showsVerticalScrollIndicator={false}>
          <View style={styles.sidebarHeading}><View><Text style={styles.overline}>WORKSPACE</Text>
            <Text style={styles.sidebarTitle}>Aplikacionet <Text style={{color:C.muted}}>({projects.length})</Text></Text></View>
            <RoundButton label="+ Shto" primary onPress={addNew}/></View>
          <Text style={styles.sidebarIntro}>Lidh repository-t e aplikacioneve pa përzier kodin e tyre me këtë studio.</Text>
          {projects.length===0&&!formOpen&&<View style={styles.emptySide}>
            <Text style={styles.emptyGlyph}>◇</Text><Text style={styles.emptyTitle}>Studio është gati.</Text>
            <Text style={styles.emptyDesc}>Shto aplikacionin tënd të parë me lidhjen GitHub dhe URL Web ose Appetize.</Text>
            <RoundButton label="+ Lidh aplikacionin" primary onPress={addNew}/>
          </View>}
          {projects.map(project=><Pressable key={project.id} onPress={()=>pick(project)}
            accessibilityRole="button" accessibilityLabel={"Hap " + project.name}
            style={[styles.projectCard,selected===project.id&&styles.projectCardActive]}>
            <View style={styles.projectRow}>
              <View style={[styles.projectIcon,selected===project.id&&styles.projectIconActive]}>
                <Text style={styles.projectIconText}>{project.name.slice(0,1).toUpperCase()}</Text>
              </View>
              <View style={{flex:1}}><Text numberOfLines={1} style={styles.projectTitle}>{project.name}</Text>
                <Text style={styles.projectSubtitle}>{project.github.split("/").slice(-2).join("/")}</Text></View>
              <Text style={{color:selected===project.id?C.accent:C.muted,fontSize:18}}>›</Text>
            </View>
            <View style={styles.miniBadges}>
              {!!project.web&&<Badge>EXPO WEB</Badge>}{!!project.native&&<Badge>ANDROID APK</Badge>}
            </View>
          </Pressable>)}
          {formOpen&&<View style={styles.formPanel}>
            <View style={styles.formHeader}><Text style={styles.formTitle}>{editing?"Ndrysho aplikacionin":"Aplikacion i ri"}</Text>
              <RoundButton label="×" onPress={()=>{setFormOpen(false);setError("");}}/></View>
            <Field title="EMRI" value={draft.name} onChange={name=>setDraft(v=>({...v,name}))}
              autoCapitalize="sentences" placeholder="P.sh. ILLYRIAN"/>
            <Field title="GITHUB REPOSITORY" value={draft.github} onChange={github=>setDraft(v=>({...v,github}))}
              placeholder="https://github.com/owner/app"/>
            <Field title="WEB PREVIEW URL (opsionale)" value={draft.web} onChange={web=>setDraft(v=>({...v,web}))}
              placeholder="https://app.vercel.app"/>
            <Field title="APPETIZE EMBED URL (opsionale)" value={draft.native} onChange={native=>setDraft(v=>({...v,native}))}
              placeholder="https://appetize.io/embed/BUILD_ID"/>
            <Text style={styles.fieldHint}>Kërkohet GitHub dhe të paktën një preview. APK nuk ngarkohet nga kjo faqe; regjistrohet lidhja e build-it në Appetize.</Text>
            {!!error&&<Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
            <RoundButton label={editing?"Ruaj ndryshimet":"Shto projektin"} primary onPress={save}/>
          </View>}
          {current&&!formOpen&&<View style={styles.selectedInfo}>
            <Text style={styles.overline}>PROJEKTI AKTIV</Text>
            <Text style={styles.selectedName}>{current.name}</Text>
            <View style={styles.linkRow}>
              <RoundButton label="↗ GitHub" onPress={()=>link(current.github)}/>
              <RoundButton label="↗ Web" onPress={()=>link(current.web)}/>
            </View>
            <View style={styles.linkRow}>
              <RoundButton label="✎ Ndrysho" onPress={()=>edit(current)}/>
              <RoundButton label={pendingRemoval===current.id?"Konfirmo heqjen":"Hiq nga lista"} danger onPress={()=>remove(current)}/>
            </View>
            <Text style={styles.fieldHint}>Heqja prek vetëm listën lokale të studios.</Text>
          </View>}
          <View style={styles.sideFooter}><Text style={styles.sideFooterText}>Çdo aplikacion ka repository-n dhe procesin e publikimit të vet. Studio nuk kopjon ose modifikon kodin e tyre.</Text></View>
        </ScrollView>
        <ScrollView contentContainerStyle={styles.stageScrollContent} style={styles.stage} showsVerticalScrollIndicator>
          <View style={[styles.stageHeading,isCompact&&styles.stageHeadingMobile]}>
            <View><Text style={styles.overline}>DEVICE LAB / LIVE PREVIEW</Text>
              <Text style={styles.stageTitle}>{current?current.name:"Telefoni yt virtual"}</Text>
              <Text style={styles.stageSubtitle}>Një pamje për Web dhe një emulator real Android në cloud.</Text></View>
            <View style={styles.stageActions}><Badge good={!!current}>{current?"PROJEKT AKTIV":"NË PRITJE"}</Badge>
              <RoundButton label="↻ Rifresko" onPress={reload}/></View>
          </View>
          <View style={styles.modeSwitcher}>
            <Pressable accessibilityRole="button" onPress={()=>{setMode("web");setRevision(r=>r+1);}}
              style={[styles.modeButton,currentMode==="web"&&styles.modeButtonActive]}>
              <Text style={[styles.modeLabel,currentMode==="web"&&styles.modeLabelActive]}>◈ Expo Web Preview</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={()=>{setMode("native");setRevision(r=>r+1);}}
              style={[styles.modeButton,currentMode==="native"&&styles.modeButtonActive]}>
              <Text style={[styles.modeLabel,currentMode==="native"&&styles.modeLabelActive]}>▣ Android Cloud APK</Text></Pressable>
          </View>
          <View style={styles.stageNote}><Text style={styles.stageNoteText}>
            {currentMode==="native"
              ?"APK-ja ekzekutohet në Appetize pasi të jetë ngarkuar aty. Nisja e sesionit mund të konsumojë minuta me pagesë."
              :"Kontrollojmë versionin çdo 15 sekonda. Kur mungojnë metadata-t, rifreskojmë çdo 60 sekonda dhe e shënojmë si të paverifikuar."}
          </Text></View>
          {current && currentMode==="web" && <View style={styles.monitorPanel}>
            <View style={styles.monitorHeader}>
              <View>
                <Text style={styles.overline}>DEPLOYMENT OBSERVER · WEB</Text>
                <Text style={styles.monitorTitle}>Live Sync &amp; Build Monitor</Text>
              </View>
              <Badge good={syncSummary.ok}>{syncSummary.title}</Badge>
            </View>
            <Text style={styles.monitorDescription}>{syncSummary.detail}</Text>
            <View style={styles.monitorMetrics}>
              <View style={styles.monitorMetric}>
                <Text style={styles.metricLabel}>VERSION I NJOHUR</Text>
                <Text selectable style={styles.metricValue}>{syncState.revision ? syncState.revision.slice(0,12) : "—"}</Text>
              </View>
              <View style={styles.monitorMetric}>
                <Text style={styles.metricLabel}>KONTROLLI I FUNDIT</Text>
                <Text style={styles.metricValue}>{readableTime(syncState.checkedAt)}</Text>
              </View>
              <View style={styles.monitorMetric}>
                <Text style={styles.metricLabel}>CI / BUILD</Text>
                <Text style={styles.metricValue}>I paverifikuar</Text>
              </View>
            </View>
            <Text style={styles.monitorWarning}>Statusi i GitHub Actions dhe Vercel Build kërkon integrim të autorizuar. Nuk supozojmë sukses nga një URL aktive.</Text>
            <View style={styles.monitorLinks}>
              <RoundButton label="↗ GitHub Actions" onPress={()=>link(current.github+"/actions")}/>
              <RoundButton label="↗ Web deployment" onPress={()=>link(current.web)}/>
            </View>
          </View>}
          <View style={styles.deviceArea}>
            <View style={[styles.device, {width:isCompact?"100%":previewWidth},
              currentMode==="native"&&styles.nativeDevice]}>
              <View style={styles.deviceTop}><Text style={styles.deviceClock}>9:41</Text>
                <View style={styles.deviceNotch}/><Text style={styles.deviceSignal}>◉ ▮▮</Text></View>
              <View style={styles.deviceScreen}>
                {current&&previewUrl?<PreviewHost url={previewUrl} title={current.name} variant={currentMode} revision={revision}/>
                  :<View style={styles.blankScreen}>
                    <View style={styles.blankIcon}><Text style={{color:C.accent,fontSize:44}}>◇</Text></View>
                    <Text style={styles.blankTitle}>{current?"S'ka lidhje për këtë modalitet":"Hap një aplikacion"}</Text>
                    <Text style={styles.blankDesc}>{current?"Ndrysho projektin dhe shto URL për këtë modalitet.":"Shto një repository dhe adresën e Web Preview ose Appetize."}</Text>
                    {!current&&<RoundButton primary label="+ Shto aplikacionin" onPress={addNew}/>}
                  </View>}
              </View>
              <View style={styles.deviceBottom}><View style={styles.deviceHome}/></View>
            </View>
            <View style={styles.previewTools}><View style={styles.statusRow}>
              <View style={styles.greenDot}/><Text style={styles.statusText}>{current&&previewUrl?"URL e demonstrimit e konfiguruar":"Në pritje të lidhjes"}</Text></View>
              {current&&previewUrl&&<RoundButton label="↗ Hap jashtë studios" onPress={()=>link(currentMode==="native"?current.native:current.web)}/>}
              <Text style={styles.infoSmall}>{currentMode==="web"?"CHECK 15s · FALLBACK 60s": "NATIVE BUILD: LINK I FIKSUAR"}</Text>
              {currentMode==="web"&&<RoundButton label={syncEnabled?"⏸ Ndalo auto":"▶ Aktivizo auto"} onPress={()=>setSyncEnabled(x=>!x)}/>}
              {lastUpdate&&<Text style={styles.infoSmall}>Rifreskimi i fundit: {lastUpdate}</Text>}
            </View>
          </View>
          <View style={styles.disclaimer}><Text style={styles.disclaimerText}>
            {currentMode==="native"?
            "Native Preview është emulator real vetëm kur ke lidhur një Appetize build të vlefshëm. Versionet e reja APK kërkojnë build/upload të ri dhe përditësim të lidhjes.":
            "Pamja Expo Web nuk është emulator Android. Aplikacioni duhet të jetë i publikuar dhe të lejojë iframe; nëse bllokohet, hape jashtë studios."}
          </Text></View>
        </ScrollView>
      </View>
      <View style={styles.footer}><Text style={styles.footerText}>MY PHONE DEVELOPER STUDIO · EXPO + REACT NATIVE WEB</Text><Text style={styles.footerText}>Projektet ruhen lokalisht në këtë shfletues</Text></View>
    </View>
  );
}
const styles=StyleSheet.create({
  app:{flex:1,minHeight:"100%",backgroundColor:C.base},
  topbar:{height:76,borderBottomWidth:1,borderBottomColor:C.outline,paddingHorizontal:24,
    backgroundColor:C.surface,alignItems:"center",justifyContent:"space-between",flexDirection:"row"},
  brand:{flexDirection:"row",alignItems:"center",gap:13},
  logo:{width:43,height:43,borderRadius:13,backgroundColor:"#283D80",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#4960AC"},
  logoLetter:{color:"#FFFFFF",fontWeight:"900",fontSize:23,letterSpacing:-2},
  brandTitle:{fontWeight:"900",fontSize:15,color:C.text,letterSpacing:1.4},
  brandSubtitle:{fontSize:9,letterSpacing:1.4,color:C.muted,fontWeight:"700",marginTop:5},
  topright:{flexDirection:"row",gap:16,alignItems:"center"},
  topHint:{color:C.muted,fontSize:11},
  badge:{borderRadius:6,paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderColor:"#3B4864",backgroundColor:"#222D44"},
  badgeGreen:{borderColor:"#295C53",backgroundColor:"#153C37"},
  badgeText:{fontSize:9,color:"#BEC9E3",fontWeight:"800",letterSpacing:.5},
  badgeTextGreen:{color:"#85E9CB"},
  main:{flex:1,flexDirection:"row"},
  mainMobile:{flexDirection:"column"},
  sidebar:{flexGrow:0,flexShrink:0,width:340,borderRightWidth:1,borderRightColor:C.outline,backgroundColor:"#0C1424"},
  sidebarMobile:{width:"100%",flexGrow:0,maxHeight:520,borderBottomWidth:1,borderBottomColor:C.outline,borderRightWidth:0},
  sidebarContent:{padding:20,paddingBottom:32},
  sidebarHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  overline:{fontSize:10,fontWeight:"800",letterSpacing:1.5,color:"#8A9BC2"},
  sidebarTitle:{fontWeight:"800",fontSize:20,color:C.text,marginTop:8},
  sidebarIntro:{fontSize:12,color:C.muted,lineHeight:19,marginTop:13,marginBottom:19},
  roundButton:{backgroundColor:"#1A2A43",paddingVertical:9,paddingHorizontal:11,borderRadius:9,borderWidth:1,borderColor:"#314362",alignItems:"center",justifyContent:"center"},
  primaryButton:{backgroundColor:C.accent,borderColor:"#758AFF"},
  dangerButton:{backgroundColor:"#3D222F",borderColor:"#754251"},
  pressed:{opacity:.73},
  buttonText:{color:"#D2DCF5",fontWeight:"800",fontSize:11},
  primaryText:{color:"#FFFFFF"},
  dangerText:{color:"#FF9BA9"},
  projectCard:{padding:13,borderRadius:14,borderWidth:1,borderColor:C.outline,marginBottom:10,backgroundColor:C.panel},
  projectCardActive:{borderColor:C.accent,backgroundColor:"#19294B"},
  projectRow:{flexDirection:"row",gap:11,alignItems:"center"},
  projectIcon:{width:34,height:34,borderRadius:9,backgroundColor:"#20304D",justifyContent:"center",alignItems:"center"},
  projectIconActive:{backgroundColor:C.accent},
  projectIconText:{color:"#FFFFFF",fontSize:16,fontWeight:"900"},
  projectTitle:{color:C.text,fontWeight:"800",fontSize:13},
  projectSubtitle:{color:C.muted,fontSize:10,marginTop:4},
  miniBadges:{flexDirection:"row",gap:6,marginTop:12},
  emptySide:{alignItems:"center",borderColor:C.outline,borderWidth:1,borderRadius:16,padding:22,backgroundColor:C.panel,gap:14},
  emptyGlyph:{fontSize:55,color:C.accent},
  emptyTitle:{fontSize:16,fontWeight:"900",color:C.text,textAlign:"center"},
  emptyDesc:{color:C.muted,fontSize:12,lineHeight:19,textAlign:"center"},
  formPanel:{borderWidth:1,borderColor:C.outline,borderRadius:15,backgroundColor:C.panel,padding:16,marginTop:5},
  formHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:16},
  formTitle:{color:C.text,fontSize:16,fontWeight:"900"},
  label:{fontSize:10,fontWeight:"800",color:"#A6B6D6",letterSpacing:.9,marginBottom:7},
  input:{borderWidth:1,borderColor:"#3A4D70",backgroundColor:"#0D1526",borderRadius:10,
    paddingHorizontal:11,paddingVertical:12,fontSize:12,color:"#FFFFFF"},
  fieldHint:{color:C.muted,fontSize:11,lineHeight:18,marginTop:8,marginBottom:8},
  errorText:{color:C.red,fontSize:11,marginVertical:9},
  selectedInfo:{borderTopWidth:1,borderTopColor:C.outline,paddingTop:22,marginTop:24},
  selectedName:{fontSize:19,fontWeight:"900",color:C.text,marginTop:7,marginBottom:14},
  linkRow:{flexDirection:"row",gap:8,marginBottom:8,flexWrap:"wrap"},
  sideFooter:{marginTop:30,paddingTop:16,borderTopWidth:1,borderTopColor:C.outline},
  sideFooterText:{color:"#7587A6",fontSize:11,lineHeight:19},
  stage:{flex:1,backgroundColor:C.base},
  stageScrollContent:{padding:30,paddingBottom:45,alignItems:"stretch"},
  stageHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:14},
  stageHeadingMobile:{flexDirection:"column",alignItems:"flex-start"},
  stageTitle:{fontWeight:"900",fontSize:30,letterSpacing:-1,color:C.text,marginTop:6},
  stageSubtitle:{fontSize:12,color:C.muted,marginTop:8},
  stageActions:{flexDirection:"row",gap:9,alignItems:"center"},
  modeSwitcher:{marginTop:23,flexDirection:"row",padding:5,borderWidth:1,borderColor:C.outline,
    backgroundColor:"#121D30",borderRadius:12,alignSelf:"flex-start",flexWrap:"wrap"},
  modeButton:{paddingHorizontal:16,paddingVertical:11,borderRadius:9},
  modeButtonActive:{backgroundColor:"#30467A"},
  modeLabel:{color:C.muted,fontSize:12,fontWeight:"800"},
  modeLabelActive:{color:"#FFFFFF"},
  stageNote:{marginTop:16,padding:12,backgroundColor:"#151F36",borderRadius:11,borderLeftWidth:2,borderLeftColor:C.accent},
  stageNoteText:{color:"#A9B9DA",fontSize:11,lineHeight:18},
  deviceArea:{alignItems:"center",paddingTop:24,gap:16},
  device:{height:720,maxWidth:420,borderRadius:45,borderWidth:7,borderColor:"#303B57",
    backgroundColor:"#060B16",overflow:"hidden",shadowColor:"#000",shadowRadius:38,shadowOpacity:.4,shadowOffset:{width:0,height:19},elevation:12},
  nativeDevice:{maxWidth:455},
  deviceTop:{height:34,flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,alignItems:"center",position:"relative"},
  deviceClock:{color:"#FFFFFF",fontWeight:"800",fontSize:11},
  deviceNotch:{width:102,height:21,borderRadius:16,backgroundColor:"#02040B",position:"absolute",top:0,left:"50%",marginLeft:-51},
  deviceSignal:{color:"#FFFFFF",fontSize:11},
  deviceScreen:{flex:1,backgroundColor:"#FFFFFF",overflow:"hidden"},
  deviceBottom:{height:24,alignItems:"center",justifyContent:"center"},
  deviceHome:{width:100,height:4,borderRadius:3,backgroundColor:"#E9EBF3"},
  blankScreen:{flex:1,padding:24,backgroundColor:"#111C33",alignItems:"center",justifyContent:"center",gap:14},
  blankIcon:{width:90,height:90,borderRadius:27,alignItems:"center",justifyContent:"center",backgroundColor:"#243960"},
  blankTitle:{color:"#FFFFFF",fontSize:20,fontWeight:"900",textAlign:"center"},
  blankDesc:{color:"#AAB8D4",fontSize:12,lineHeight:19,textAlign:"center"},
  previewTools:{flexDirection:"row",justifyContent:"center",alignItems:"center",flexWrap:"wrap",gap:12},
  greenDot:{width:7,height:7,borderRadius:4,backgroundColor:C.green},
  statusRow:{flexDirection:"row",gap:7,alignItems:"center"},
  statusText:{color:"#C3D0EC",fontSize:11,fontWeight:"800"},
  infoSmall:{fontSize:10,color:C.muted,fontWeight:"700"},
  monitorPanel:{marginTop:18,padding:18,borderRadius:14,borderWidth:1,borderColor:C.outline,backgroundColor:C.panel},
  monitorHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  monitorTitle:{fontSize:17,fontWeight:"900",color:C.text,marginTop:7},
  monitorDescription:{fontSize:11,color:C.soft,marginTop:12,lineHeight:18},
  monitorMetrics:{marginTop:15,flexDirection:"row",flexWrap:"wrap",gap:9},
  monitorMetric:{flexGrow:1,flexBasis:150,backgroundColor:"#0B1527",borderWidth:1,borderColor:C.outline,padding:12,borderRadius:10},
  metricLabel:{fontSize:9,color:C.muted,fontWeight:"800",letterSpacing:.5},
  metricValue:{fontSize:13,color:C.text,fontWeight:"800",marginTop:7},
  monitorWarning:{color:"#E3C7A7",fontSize:10,lineHeight:16,marginTop:13},
  monitorLinks:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:14},
  disclaimer:{maxWidth:720,marginTop:22,alignSelf:"center"},
  disclaimerText:{color:"#8090AF",fontSize:11,lineHeight:19,textAlign:"center"},
  footer:{paddingHorizontal:24,paddingVertical:14,borderTopWidth:1,borderTopColor:C.outline,
    flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:12},
  footerText:{color:"#6C7A98",fontSize:9,fontWeight:"800",letterSpacing:.8}
});
