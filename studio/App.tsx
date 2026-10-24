import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, useWindowDimensions, View
} from "react-native";
import PreviewHost from "./src/PreviewHost";
import ZipImportPanel from "./src/ZipImportPanel";
import type {QuickPreview} from "./src/ZipImportPanel.web";
import {newProject, chooseMode, freshWebUrl} from "./src/project-model";
import {readProjectRegistry, writeProjectRegistry, serializeProjectBackup,
  parseProjectBackup, validateProjectList, MAX_BACKUP_BYTES,
  readUnreadableRegistryRaw, readPreservedOriginalRaw, recoverUnreadableRegistry} from "./src/project-storage";
import {
  SYNC_POLL_MS, FALLBACK_REFRESH_MS, FETCH_TIMEOUT_MS, MAX_MANIFEST_BYTES,
  manifestUrl, parseManifest, readBoundedManifestText, initialSyncState, transitionSync, applyPendingSync, summarizeSync
} from "./src/live-sync";

type Project = {id:string;name:string;github:string;web:string;native:string};
type Mode = "web" | "native";
type Draft = {name:string;github:string;web:string;native:string};
type DeploymentSync = {
  phase:string; strategy:string; revision:string|null; fingerprint:string|null;
  displayedFingerprint:string|null; displayedRevision:string|null;
  pendingFingerprint:string|null; pendingRevision:string|null;
  builtAt:string|null; checkedAt:number|null; changedAt:number|null; failures:number;
};
const EMPTY:Draft = {name:"",github:"",web:"",native:""};
const C = {
  base:"#0B080E", panel:"#1C1220", elevated:"#261625", outline:"#4B3142",
  text:"#F9F2F6", muted:"#BAA7B7", accent:"#F44678", green:"#65DEAA",
  orange:"#F5B978", red:"#FF7D92", surface:"#120D16", soft:"#E0BDCE"
};
const isWeb = Platform.OS === "web";
const link = (value:string) => { if(value) void Linking.openURL(value).catch(() => {}); };
const newId = () => "project-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
function browserStorage():Storage|null {
  if(!isWeb || typeof window === "undefined") return null;
  try {return window.localStorage;}catch{return null;}
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
  const {width,height} = useWindowDimensions();
  const isCompact = width < 1100;
  const [projects,setProjects] = useState<Project[]>([]);
  // Session only: never persisted to localStorage, My Projects or server.
  const [quickPreview,setQuickPreview]=useState<QuickPreview|null>(null);
  // Synchronously revoke pending ZIP callbacks on a parent context change.
  const zipContextRef=useRef(0);
  const [zipContext,setZipContext]=useState(0);
  const invalidateZipContext=()=>{
    zipContextRef.current+=1;
    setZipContext(zipContextRef.current);
    setQuickPreview(null);
  };
  const [selected,setSelected] = useState<string|null>(null);
  const [mode,setMode] = useState<Mode>("web");
  const [formOpen,setFormOpen] = useState(false);
  const [editing,setEditing] = useState<string|null>(null);
  const [pendingRemoval,setPendingRemoval] = useState<string|null>(null);
  const [draft,setDraft] = useState<Draft>(EMPTY);
  const [error,setError] = useState("");
  const [loaded,setLoaded] = useState(false);
  const writableRegistry = useRef(false);
  const [registryWarning,setRegistryWarning] = useState("");
  const [backupMessage,setBackupMessage] = useState("");
  const [unreadableRegistry,setUnreadableRegistry] = useState(false);
  const [preservedOriginal,setPreservedOriginal] = useState(false);
  const [pendingRecovery,setPendingRecovery] = useState<{raw:string;projects:Project[]}|null>(null);
  const [revision,setRevision] = useState(1);
  const [syncEnabled,setSyncEnabled] = useState(true);
  const [freezeEnabled,setFreezeEnabled] = useState(false);
  const freezeRef = useRef(false);
  const syncRef = useRef<DeploymentSync>(initialSyncState());
  const [lastUpdate,setLastUpdate] = useState<string|null>(null);
  const [syncState,setSyncState] = useState<DeploymentSync>(initialSyncState());

  useEffect(()=> {
    if(!isWeb) {setLoaded(true);return;}
    const result = readProjectRegistry(browserStorage());
    writableRegistry.current = result.ok;
    setUnreadableRegistry(result.reason==="unreadable");
    setPreservedOriginal(readPreservedOriginalRaw(browserStorage())!==null);
    setProjects(result.projects);
    setSelected(result.projects[0]?.id || null);
    if(!result.ok) setRegistryWarning(
      result.reason==="unreadable"
        ?"Të dhënat lokale nuk lexohen ose janë të dëmtuara. Studio nuk do t'i mbishkruajë automatikisht. Importo një backup të vlefshëm."
        :"Shfletuesi nuk lejon ruajtjen lokale. Ndryshimet e kësaj seance mund të humbasin.");
    setLoaded(true);
  },[]);
  useEffect(()=> {
    if(!loaded || !isWeb || !writableRegistry.current) return;
    const saved=writeProjectRegistry(browserStorage(),projects);
    setRegistryWarning(saved.ok ? "" :
      "Ruajtja lokale dështoi. Projektet shfaqen vetëm në këtë seancë; shkarko një kopje JSON.");
  },[loaded,projects]);

  const downloadOriginalRegistry=()=>{
    if(!isWeb || typeof document==="undefined") return;
    const storage=browserStorage();
    const raw=readUnreadableRegistryRaw(storage)??readPreservedOriginalRaw(storage);
    if(raw===null) {setBackupMessage("Regjistri origjinal nuk është i disponueshëm.");return;}
    try {
      const url=URL.createObjectURL(new Blob([raw],{type:"text/plain;charset=utf-8"}));
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download="my-phone-studio-regjistri-origjinal.txt";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setBackupMessage("Regjistri origjinal u përgatit për shkarkim pa ndryshuar ruajtjen lokale.");
    } catch {setBackupMessage("Shkarkimi i regjistrit origjinal dështoi.");}
  };

  const confirmRecovery=()=>{
    if(!pendingRecovery) return;
    const outcome=recoverUnreadableRegistry(browserStorage(),pendingRecovery.raw,pendingRecovery.projects);
    if(!outcome.ok) {
      setPendingRecovery(null);
      setBackupMessage("Rikuperimi u ndal ("+outcome.reason+"). Regjistri origjinal nuk u fshi. Shkarko kopjen dhe kontrollo hapësirën lokale.");
      return;
    }
    writableRegistry.current=true;
    setUnreadableRegistry(false);
    setPreservedOriginal(true);
    setRegistryWarning("");
    invalidateZipContext();
    setProjects(pendingRecovery.projects);
    setSelected(pendingRecovery.projects[0]?.id??null);
    setPendingRecovery(null);
    setBackupMessage("Rikuperimi përfundoi. Origjinali është ruajtur veçmas dhe mund të shkarkohet.");
  };
  const exportBackup=()=>{
    if(!isWeb || typeof document==="undefined") return;
    try {
      if(unreadableRegistry)throw new Error("Regjistri origjinal nuk është i lexueshëm.");
      const contents=serializeProjectBackup(projects);
      const url=URL.createObjectURL(new Blob([contents],{type:"application/json"}));
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download="my-phone-studio-projects-backup.json";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setBackupMessage("Kopja JSON u përgatit. Ruaje në një vend të sigurt.");
    }catch{setBackupMessage("Nuk u krijua kopja. Kontrollo të dhënat e projekteve.");}
  };
  const importBackup=()=>{
    if(!isWeb || typeof document==="undefined") return;
    const input=document.createElement("input");
    input.type="file";input.accept=".json,application/json";
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      setPendingRecovery(null);
      try {
        if(file.size>MAX_BACKUP_BYTES)throw new Error("Skedari tejkalon kufirin e sigurisë.");
        const imported=parseProjectBackup(await file.text()) as Project[];
        const existing=new Set(projects.map(p=>p.id));
        const merged=[...projects,...imported.filter(p=>!existing.has(p.id))];
        // Merge must also satisfy the same 100-item and backup-byte invariants.
        validateProjectList(merged);
        if(unreadableRegistry) {
          const raw=readUnreadableRegistryRaw(browserStorage());
          if(raw===null)throw new Error("Regjistri origjinal ndryshoi ose nuk lexohet.");
          setPendingRecovery({raw,projects:merged});
          setBackupMessage("Backup është validuar. Asgjë nuk është mbishkruar. Shkarko origjinalin dhe konfirmo rikuperimin.");
          return;
        }
        const saved=writeProjectRegistry(browserStorage(),merged);
        if(!saved.ok)throw new Error("Importi nuk u ruajt; ndryshimet ekzistuese nuk u prekën.");
        writableRegistry.current=true;
        setRegistryWarning("");
        invalidateZipContext();
        setProjects(merged);
        setSelected(previous=>previous||merged[0]?.id||null);
        setBackupMessage("Backup u importua: "+(merged.length-projects.length)+" projekte të reja.");
      }catch(err){setBackupMessage(err instanceof Error?err.message:"Backup nuk është i vlefshëm.");}
    };
    input.click();
  };
  const current = projects.find(p=>p.id===selected) || null;
  const currentMode = current ? chooseMode(current,mode) as Mode : mode;
  const reload = useCallback(()=>{setRevision(r=>r+1);setLastUpdate(new Date().toLocaleTimeString("sq-AL"));},[]);
  const applyPending = useCallback(()=>{
    const next=applyPendingSync(syncRef.current);
    if(!next.reload) return false;
    syncRef.current=next.state;
    setSyncState(next.state);
    reload();
    return true;
  },[reload]);
  const manualRefresh = useCallback(()=>{
    if(!applyPending()) reload();
  },[applyPending,reload]);
  const toggleFreeze = () => {
    const next=!freezeRef.current;
    freezeRef.current=next;
    setFreezeEnabled(next);
    if(!next) applyPending(); // returning to auto mode explicitly accepts pending
  };
  const resetFreeze = () => {freezeRef.current=false;setFreezeEnabled(false);};
  // Read-only deploy observation. Browser CORS rules can block private deployments.
  // A successful manifest confirms only the published revision, NOT GitHub CI status.
  useEffect(()=>{
    if(!isWeb || !current?.web || currentMode!=="web" || !syncEnabled) {
      const state={...initialSyncState(),phase:!syncEnabled?"paused":"checking"};
      syncRef.current=state;
      setSyncState(state);
      return;
    }
    let stopped = false;
    let inFlight = false;
    let request:AbortController|null = null;
    let lastFallback = Date.now();
    syncRef.current=initialSyncState();
    setSyncState(syncRef.current);
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
          // Strict byte bound even for chunked responses without Content-Length.
          const body = await readBoundedManifestText(response, MAX_MANIFEST_BYTES, abort);
          if(body===null) outcome={kind:"unsupported"};
          else {
            let parsed = null;
            try {parsed=parseManifest(JSON.parse(body));} catch {}
            outcome=parsed?{kind:"published",manifest:parsed}:{kind:"unsupported"};
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
      const next = transitionSync(syncRef.current,outcome,Date.now(),{frozen:freezeRef.current});
      syncRef.current=next.state;
      setSyncState(next.state);
      if(next.reload) {
        reload();
        lastFallback=Date.now();
      } else if(!freezeRef.current && next.state.strategy==="fallback" &&
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
      // Reject overflow/oversized backups before mutating session state.
      validateProjectList(next);
      resetFreeze();
      invalidateZipContext();
      setProjects(next);setSelected(value.id);setMode(chooseMode(value,mode) as Mode);
      setFormOpen(false);setEditing(null);setError("");setRevision(r=>r+1);
    } catch(e) {setError(e instanceof Error?e.message:"Të dhënat nuk u pranuan.");}
  };
  const remove = (project:Project) => {
    // Require a second explicit click. This removes a local bookmark, never source code.
    if(pendingRemoval!==project.id){setPendingRemoval(project.id);return;}
    setPendingRemoval(null);
    const next=projects.filter(p=>p.id!==project.id);
    resetFreeze();
    invalidateZipContext();
    setProjects(next);setSelected(next[0]?.id || null);setFormOpen(false);
  };
  const pick = (project:Project) => {
    if(project.id!==selected) resetFreeze();
    invalidateZipContext();
    setSelected(project.id);setFormOpen(false);setPendingRemoval(null);setMode(chooseMode(project,mode) as Mode);
    setRevision(r=>r+1);
  };
  // Fit the full 430:932 phone into the viewport, independent of sidebar scrolling.
  // Preserve the phone's 430:932 proportions while respecting both viewport axes.
  // At the desktop breakpoint the middle column must account for two sidebars and gaps.
  const horizontalRoom = isCompact ? width - 32 : width - 355 - 310 - 64;
  const previewWidth = Math.max(100,Math.min(400,Math.floor((height-48)*430/932),horizontalRoom));
  const previewHeight = Math.round(previewWidth*932/430);
  const syncSummary = summarizeSync(syncState);
  const readableTime = (time:number|null) => time ? new Date(time).toLocaleTimeString("sq-AL") : "—";
  return (
    <View style={[styles.app,!isCompact&&{height},isWeb&&({backgroundImage:"radial-gradient(ellipse at 70% 45%, #3b1027 0%, #190b18 43%, #09080d 84%)"} as any)]}>
      <View style={[styles.main,isCompact&&styles.mainMobile]}>
        <ScrollView testID="studio-projects-panel" contentContainerStyle={styles.sidebarContent}
          style={[styles.sidebar,isCompact&&styles.sidebarMobile]} showsVerticalScrollIndicator={false}>
          <View style={styles.brandInSidebar}>
            <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoLetter}>M</Text></View>
              <View><Text style={styles.brandTitle}>MY PHONE <Text style={{color:C.accent}}>EXPO STUDIO</Text></Text>
                <Text style={styles.brandSubtitle}>APPLICATION PREVIEW WORKSPACE</Text></View>
            </View>
            <Badge good>STUDIO v0.4</Badge>
          </View>
          <View style={styles.sidebarHeading}><View><Text style={styles.overline}>01 / PROJEKTI AKTIV</Text>
            <Text style={styles.sidebarTitle}>Aplikacionet <Text style={{color:C.muted}}>({projects.length})</Text></Text></View>
            <RoundButton label="+ Shto" primary onPress={addNew}/></View>
          <Text style={styles.sidebarIntro}>Lidh repository-t e aplikacioneve pa përzier kodin e tyre me këtë studio.</Text>
          <View style={styles.leftModeControls}>
            <Text style={styles.overline}>02 / ZGJIDH PREVIEW</Text>
          <View style={styles.modeSwitcher}>
            <Pressable accessibilityRole="button" onPress={()=>{invalidateZipContext();setMode("web");setRevision(r=>r+1);}}
              style={[styles.modeButton,currentMode==="web"&&styles.modeButtonActive]}>
              <Text style={[styles.modeLabel,currentMode==="web"&&styles.modeLabelActive]}>◈ Expo Web Preview</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={()=>{invalidateZipContext();setMode("native");setRevision(r=>r+1);}}
              style={[styles.modeButton,currentMode==="native"&&styles.modeButtonActive]}>
              <Text style={[styles.modeLabel,currentMode==="native"&&styles.modeLabelActive]}>▣ Android Cloud APK</Text></Pressable>
          </View>
          </View>
          <ZipImportPanel key={"zip-context-"+zipContext} onPreview={value=>{
             // Callback captured before project/mode switch cannot restore a stale iframe.
             if(zipContext!==zipContextRef.current)return;
             setQuickPreview(value);if(value)setMode("web");
           }}/>
          {!!registryWarning&&<Text accessibilityRole="alert" style={styles.registryWarning}>{registryWarning}</Text>}
          {(unreadableRegistry||preservedOriginal)&&<View style={styles.backupActions}>
            <RoundButton label="↓ Shkarko regjistrin origjinal" onPress={downloadOriginalRegistry}/>
          </View>}
          {pendingRecovery&&<View style={styles.formPanel}>
            <Text style={styles.formTitle}>Rikuperim me konfirmim</Text>
            <Text style={styles.fieldHint}>Do të rikthehen {pendingRecovery.projects.length} projekte nga backup-i i vlefshëm. Regjistri i vjetër ruhet në një çelës tjetër të pajisjes përpara zëvendësimit. Nëse ruajtja e kopjes dështon, nuk zëvendësohet asgjë. Shkarko edhe kopjen origjinale për siguri.</Text>
            <View style={styles.backupActions}>
              <RoundButton label="Anulo rikuperimin" onPress={()=>{setPendingRecovery(null);setBackupMessage("Rikuperimi u anulua pa ndryshuar të dhënat.");}}/>
              <RoundButton label="Konfirmo rikuperimin" danger onPress={confirmRecovery}/>
            </View>
          </View>}
          <View style={styles.backupActions}>
            <RoundButton label="↓ Eksporto backup JSON" onPress={exportBackup}/>
            <RoundButton label="↑ Importo backup JSON" onPress={importBackup}/>
          </View>
          {!!backupMessage&&<Text style={styles.backupMessage}>{backupMessage}</Text>}
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
        <View style={[styles.stage,isCompact&&styles.stageMobile]}>
          <View style={[styles.phoneColumn,isCompact&&{minHeight:previewHeight+22,flexGrow:0,flexShrink:0}]}>
            <View style={styles.deviceArea}>
            <View testID="studio-phone-frame" style={[styles.device, {width:previewWidth,height:previewHeight},
              currentMode==="native"&&styles.nativeDevice]}>
              <View style={styles.deviceTop}><Text style={styles.deviceClock}>9:41</Text>
                <View style={styles.deviceNotch}/><Text style={styles.deviceSignal}>◉ ▮▮</Text></View>
              <View style={styles.deviceScreen}>
                {quickPreview ? <iframe key={"zip-"+quickPreview.serial} title="Quick Preview · ZIP"
                  srcDoc={quickPreview.srcDoc} sandbox="allow-scripts" referrerPolicy="no-referrer"
                  style={{width:"100%",height:"100%",border:0,backgroundColor:"#FFF"}}/>
                  :current&&previewUrl?<PreviewHost url={previewUrl} title={current.name} variant={currentMode} revision={revision}/>
                  :<View style={styles.blankScreen}>
                    <View style={styles.blankIcon}><Text style={{color:C.accent,fontSize:44}}>◇</Text></View>
                    <Text style={styles.blankTitle}>{current?"S'ka lidhje për këtë modalitet":"Hap një aplikacion"}</Text>
                    <Text style={styles.blankDesc}>{current?"Ndrysho projektin dhe shto URL për këtë modalitet.":"Shto një repository dhe adresën e Web Preview ose Appetize."}</Text>
                    {!current&&<RoundButton primary label="+ Shto aplikacionin" onPress={addNew}/>}
                  </View>}
              </View>
              <View style={styles.deviceBottom}><View style={styles.deviceHome}/></View>
            </View>
            </View>
          </View>
          <ScrollView testID="studio-diagnostics-panel" style={[styles.workspaceTools,isCompact&&styles.workspaceToolsMobile]}
            contentContainerStyle={styles.workspaceToolsContent} showsVerticalScrollIndicator>
          <View style={[styles.stageHeading,isCompact&&styles.stageHeadingMobile]}>
            <View><Text style={styles.overline}>DEVICE LAB / LIVE PREVIEW</Text>
              <Text style={styles.stageTitle}>{quickPreview?"Quick Preview · "+quickPreview.filename:current?current.name:"Telefoni yt virtual"}</Text>
              <Text style={styles.stageSubtitle}>Një pamje për Web dhe një emulator real Android në cloud.</Text></View>
            <View style={styles.stageActions}><Badge good={!!quickPreview||!!current}>{quickPreview?"ZIP TEMPORARY":current?"PROJEKT AKTIV":"NË PRITJE"}</Badge>
              <RoundButton label="↻ Rifresko" onPress={()=>quickPreview?setQuickPreview(value=>value?{...value,serial:value.serial+1}:null):manualRefresh()}/></View>
          </View>
          <View style={styles.stageNote}><Text style={styles.stageNoteText}>
            {quickPreview ? "Quick Preview i përkohshëm në iframe me origjinë opake. Vetëm ZIP të besuar: navigimi mund të nisë kërkesa rrjeti dhe CPU nuk është e izoluar. Asnjë ZIP nuk ruhet."
              :currentMode==="native"
              ?"APK-ja ekzekutohet në Appetize pasi të jetë ngarkuar aty. Nisja e sesionit mund të konsumojë minuta me pagesë."
              :freezeEnabled
                ?"Session Freeze: kontrollojmë versionin çdo 15 sekonda, pa rifreskuar automatikisht pamjen."
                :"Kontrollojmë versionin çdo 15 sekonda. Kur mungojnë metadata-t, rifreskojmë çdo 60 sekonda dhe e shënojmë si të paverifikuar."}
          </Text></View>
          {!quickPreview && current && currentMode==="web" && <View style={styles.monitorPanel}>
            <View style={styles.monitorHeader}>
              <View>
                <Text style={styles.overline}>DEPLOYMENT OBSERVER · WEB</Text>
                <Text style={styles.monitorTitle}>Live Sync &amp; Build Monitor</Text>
              </View>
              <Badge good={syncSummary.ok}>{syncSummary.title}</Badge>
            </View>
            <Text style={styles.monitorDescription}>{syncSummary.detail}</Text>
            {freezeEnabled&&<View style={styles.freezeNotice}>
              <Text style={styles.freezeNoticeText}>Session Freeze aktiv — rifreskimi automatik i telefonit është ndalur, por kontrolli i versioneve vazhdon.</Text>
            </View>}
            {!!syncState.pendingRevision&&<View style={styles.pendingNotice}>
              <Text style={styles.pendingTitle}>Version i ri në pritje: {syncState.pendingRevision.slice(0,12)}</Text>
              <Text style={styles.pendingText}>Mund të vazhdosh testimin. Ndryshimi do të aplikohet vetëm kur ta zgjedhësh.</Text>
              <View style={styles.pendingAction}><RoundButton label="Apliko versionin e ri" primary onPress={()=>{applyPending();}}/></View>
            </View>}
            <View style={styles.monitorMetrics}>
              <View style={styles.monitorMetric}>
                <Text style={styles.metricLabel}>VERSION I NJOHUR</Text>
                <Text selectable style={styles.metricValue}>{syncState.revision ? syncState.revision.slice(0,12) : "—"}</Text>
              </View>
              <View style={styles.monitorMetric}>
                <Text style={styles.metricLabel}>REFERENCA E PAMJES</Text>
                <Text selectable style={styles.metricValue}>{syncState.displayedRevision ? syncState.displayedRevision.slice(0,12) : "—"}</Text>
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
            <View style={styles.previewTools}><View style={styles.statusRow}>
              <View style={styles.greenDot}/><Text style={styles.statusText}>{quickPreview?"Quick Preview · sesion privat, pa ruajtje":current&&previewUrl?"URL e lidhur · shfaqja në iframe e paverifikuar":"Në pritje të lidhjes"}</Text></View>
              {!quickPreview&&current&&previewUrl&&<RoundButton label="↗ Hap jashtë studios" onPress={()=>link(currentMode==="native"?current.native:current.web)}/>}
              {!quickPreview&&currentMode==="web"&&current&&previewUrl&&<Text style={styles.infoSmall}>Nëse iframe është bosh ose i bllokuar nga CSP/X-Frame-Options, hape jashtë Studios. URL e lidhur nuk provon ngarkim të suksesshëm.</Text>}
              <Text style={styles.infoSmall}>{quickPreview?"ZIP vetëm në RAM · sandbox i kufizuar":currentMode==="web"?"CHECK 15s · FALLBACK 60s": "NATIVE BUILD: LINK I FIKSUAR"}</Text>
              {!quickPreview&&currentMode==="web"&&syncEnabled&&<RoundButton label={freezeEnabled?"Çaktivizo Session Freeze":"Aktivizo Session Freeze"} onPress={toggleFreeze}/>}
              {!quickPreview&&currentMode==="web"&&<RoundButton label={syncEnabled?"⏸ Ndalo auto":"▶ Aktivizo auto"} onPress={()=>setSyncEnabled(x=>!x)}/>}
              {lastUpdate&&<Text style={styles.infoSmall}>Rifreskimi i fundit: {lastUpdate}</Text>}
            </View>
          <View style={styles.disclaimer}><Text style={styles.disclaimerText}>
            {quickPreview?quickPreview.warning:currentMode==="native"?
            "Native Preview është emulator real vetëm kur ke lidhur një Appetize build të vlefshëm. Versionet e reja APK kërkojnë build/upload të ri dhe përditësim të lidhjes.":
            "Pamja Expo Web nuk është emulator Android. Aplikacioni duhet të jetë i publikuar dhe të lejojë iframe; nëse bllokohet, hape jashtë studios."}
          </Text></View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
const styles=StyleSheet.create({
  app:{flex:1,minHeight:"100%",backgroundColor:C.base},
  topbar:{height:76,borderBottomWidth:1,borderBottomColor:C.outline,paddingHorizontal:24,
    backgroundColor:C.surface,alignItems:"center",justifyContent:"space-between",flexDirection:"row"},
  brand:{flexDirection:"row",alignItems:"center",gap:13},
  logo:{width:43,height:43,borderRadius:13,backgroundColor:"#D63370",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#FF8AAC"},
  logoLetter:{color:"#FFFFFF",fontWeight:"900",fontSize:23,letterSpacing:-2},
  brandTitle:{fontWeight:"900",fontSize:15,color:C.text,letterSpacing:1.4},
  brandSubtitle:{fontSize:9,letterSpacing:1.4,color:C.muted,fontWeight:"700",marginTop:5},
  topright:{flexDirection:"row",gap:16,alignItems:"center"},
  topHint:{color:C.muted,fontSize:11},
  badge:{borderRadius:7,paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderColor:"#674258",backgroundColor:"#321E2E"},
  badgeGreen:{borderColor:"#295C53",backgroundColor:"#153C37"},
  badgeText:{fontSize:9,color:"#BEC9E3",fontWeight:"800",letterSpacing:.5},
  badgeTextGreen:{color:"#85E9CB"},
  main:{flex:1,flexDirection:"row",gap:16,padding:16,minHeight:0},
  mainMobile:{flexDirection:"column",padding:12,flexGrow:0,flexShrink:0,minHeight:0,overflow:"visible"},
  sidebar:{flexGrow:0,flexShrink:0,width:355,borderWidth:1,borderColor:C.outline,borderRadius:18,backgroundColor:"#130E17"},
  sidebarMobile:{width:"100%",flexGrow:0,flexShrink:0,maxHeight:560,position:"relative",zIndex:2},
  sidebarContent:{padding:19,paddingBottom:32},
  sidebarHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  overline:{fontSize:10,fontWeight:"800",letterSpacing:1.5,color:"#E8AEC3"},
  sidebarTitle:{fontWeight:"800",fontSize:20,color:C.text,marginTop:8},
  sidebarIntro:{fontSize:12,color:C.muted,lineHeight:19,marginTop:13,marginBottom:19},
  roundButton:{backgroundColor:"#281927",paddingVertical:9,paddingHorizontal:11,borderRadius:9,borderWidth:1,borderColor:C.outline,alignItems:"center",justifyContent:"center"},
  primaryButton:{backgroundColor:C.accent,borderColor:"#FF8EB0"},
  dangerButton:{backgroundColor:"#3D222F",borderColor:"#754251"},
  pressed:{opacity:.73},
  buttonText:{color:"#D2DCF5",fontWeight:"800",fontSize:11},
  primaryText:{color:"#FFFFFF"},
  dangerText:{color:"#FF9BA9"},
  projectCard:{padding:13,borderRadius:14,borderWidth:1,borderColor:C.outline,marginBottom:10,backgroundColor:C.panel},
  projectCardActive:{borderColor:C.accent,backgroundColor:"#381A2D"},
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
  label:{fontSize:10,fontWeight:"800",color:"#E7BFCE",letterSpacing:.9,marginBottom:7},
  input:{borderWidth:1,borderColor:C.outline,backgroundColor:"#0F0B12",borderRadius:10,
    paddingHorizontal:11,paddingVertical:12,fontSize:12,color:"#FFFFFF"},
  fieldHint:{color:C.muted,fontSize:11,lineHeight:18,marginTop:8,marginBottom:8},
  errorText:{color:C.red,fontSize:11,marginVertical:9},
  selectedInfo:{borderTopWidth:1,borderTopColor:C.outline,paddingTop:22,marginTop:24},
  selectedName:{fontSize:19,fontWeight:"900",color:C.text,marginTop:7,marginBottom:14},
  linkRow:{flexDirection:"row",gap:8,marginBottom:8,flexWrap:"wrap"},
  sideFooter:{marginTop:30,paddingTop:16,borderTopWidth:1,borderTopColor:C.outline},
  sideFooterText:{color:"#7587A6",fontSize:11,lineHeight:19},
  stage:{flex:1,flexDirection:"row",gap:16,minWidth:0,minHeight:0,backgroundColor:"transparent"},
  stageMobile:{flexDirection:"column",flexGrow:0,flexShrink:0,minHeight:0,position:"relative",zIndex:0,overflow:"visible"},
  stageScrollContent:{padding:30,paddingBottom:45,alignItems:"stretch"},
  stageHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:14},
  stageHeadingMobile:{flexDirection:"column",alignItems:"flex-start"},
  stageTitle:{fontWeight:"900",fontSize:20,letterSpacing:-.5,color:C.text,marginTop:6},
  stageSubtitle:{fontSize:12,color:C.muted,marginTop:8},
  stageActions:{flexDirection:"row",gap:9,alignItems:"center"},
  modeSwitcher:{marginTop:10,flexDirection:"row",padding:5,borderWidth:1,borderColor:C.outline,
    backgroundColor:"#120C17",borderRadius:12,alignSelf:"stretch",flexWrap:"wrap"},
  modeButton:{paddingHorizontal:16,paddingVertical:11,borderRadius:9},
  modeButtonActive:{backgroundColor:"#802B51"},
  modeLabel:{color:C.muted,fontSize:12,fontWeight:"800"},
  modeLabelActive:{color:"#FFFFFF"},
  stageNote:{marginTop:16,padding:12,backgroundColor:"#151F36",borderRadius:11,borderLeftWidth:2,borderLeftColor:C.accent},
  stageNoteText:{color:"#A9B9DA",fontSize:11,lineHeight:18},
  deviceArea:{flex:1,alignItems:"center",justifyContent:"center",paddingTop:0,minWidth:0},
  device:{borderRadius:45,borderWidth:6,borderColor:"#513444",
    backgroundColor:"#0C0810",overflow:"hidden",shadowColor:"#000",shadowRadius:38,shadowOpacity:.4,shadowOffset:{width:0,height:19},elevation:12},
  nativeDevice:{borderColor:"#6A3E5A"},
  deviceTop:{height:34,flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,alignItems:"center",position:"relative"},
  deviceClock:{color:"#FFFFFF",fontWeight:"800",fontSize:11},
  deviceNotch:{width:102,height:21,borderRadius:16,backgroundColor:"#02040B",position:"absolute",top:0,left:"50%",marginLeft:-51},
  deviceSignal:{color:"#FFFFFF",fontSize:11},
  deviceScreen:{flex:1,backgroundColor:"#FFFFFF",overflow:"hidden"},
  deviceBottom:{height:24,alignItems:"center",justifyContent:"center"},
  deviceHome:{width:100,height:4,borderRadius:3,backgroundColor:"#E9EBF3"},
  blankScreen:{flex:1,padding:24,backgroundColor:"#1B1221",alignItems:"center",justifyContent:"center",gap:14},
  blankIcon:{width:90,height:90,borderRadius:27,alignItems:"center",justifyContent:"center",backgroundColor:"#243960"},
  blankTitle:{color:"#FFFFFF",fontSize:20,fontWeight:"900",textAlign:"center"},
  blankDesc:{color:"#AAB8D4",fontSize:12,lineHeight:19,textAlign:"center"},
  previewTools:{flexDirection:"row",justifyContent:"center",alignItems:"center",flexWrap:"wrap",gap:12},
  greenDot:{width:7,height:7,borderRadius:4,backgroundColor:C.green},
  statusRow:{flexDirection:"row",gap:7,alignItems:"center"},
  statusText:{color:"#C3D0EC",fontSize:11,fontWeight:"800"},
  infoSmall:{fontSize:10,color:C.muted,fontWeight:"700"},
  backupActions:{flexDirection:"row",flexWrap:"wrap",gap:6,marginBottom:11},
  backupMessage:{color:C.soft,fontSize:11,marginBottom:10,lineHeight:18},
  registryWarning:{backgroundColor:"#402B2D",borderColor:C.red,borderWidth:1,borderRadius:9,padding:10,color:"#FFD6D9",fontSize:11,lineHeight:18,marginBottom:12},
  monitorPanel:{marginTop:18,padding:14,borderRadius:14,borderWidth:1,borderColor:C.outline,backgroundColor:"#241624"},
  monitorHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  monitorTitle:{fontSize:17,fontWeight:"900",color:C.text,marginTop:7},
  monitorDescription:{fontSize:11,color:C.soft,marginTop:12,lineHeight:18},
  freezeNotice:{marginTop:12,padding:11,borderRadius:9,backgroundColor:"#173A36",borderWidth:1,borderColor:"#397869"},
  freezeNoticeText:{color:"#A5E9D4",fontSize:11,lineHeight:18},
  pendingNotice:{marginTop:12,padding:13,borderRadius:10,backgroundColor:"#2B2537",borderWidth:1,borderColor:"#6F5872"},
  pendingTitle:{color:"#FFFFFF",fontSize:13,fontWeight:"800"},
  pendingText:{color:"#DBCEDE",fontSize:11,lineHeight:18,marginTop:7},
  pendingAction:{marginTop:11,alignSelf:"flex-start"},
  monitorMetrics:{marginTop:15,flexDirection:"row",flexWrap:"wrap",gap:9},
  monitorMetric:{flexGrow:1,flexBasis:130,backgroundColor:"#140E18",borderWidth:1,borderColor:C.outline,padding:12,borderRadius:10},
  metricLabel:{fontSize:9,color:C.muted,fontWeight:"800",letterSpacing:.5},
  metricValue:{fontSize:13,color:C.text,fontWeight:"800",marginTop:7},
  monitorWarning:{color:"#E3C7A7",fontSize:10,lineHeight:16,marginTop:13},
  monitorLinks:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:14},
  disclaimer:{maxWidth:720,marginTop:22,alignSelf:"center"},
  disclaimerText:{color:"#8090AF",fontSize:11,lineHeight:19,textAlign:"center"},
  footer:{paddingHorizontal:24,paddingVertical:14,borderTopWidth:1,borderTopColor:C.outline,
    flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:12},
  footerText:{color:"#6C7A98",fontSize:9,fontWeight:"800",letterSpacing:.8},
  brandInSidebar:{gap:12,borderBottomWidth:1,borderBottomColor:C.outline,paddingBottom:15,marginBottom:20},
  leftModeControls:{marginBottom:15},
  phoneColumn:{flex:1,minWidth:0,minHeight:0,alignItems:"center",justifyContent:"center"},
  workspaceTools:{width:310,flexGrow:0,flexShrink:0,backgroundColor:"#150E19",borderWidth:1,borderColor:C.outline,borderRadius:18},
  workspaceToolsMobile:{width:"100%",maxHeight:540,flexGrow:0,flexShrink:0},
  workspaceToolsContent:{padding:17,paddingBottom:28},
});
