// My Phone Engine v1: deterministic, read-only assessment of validated ZIP metadata.
// Never decompress, execute code, upload files, build apps or touch persistent storage here.
export const ENGINE_SCHEMA = "my-phone-engine-assessment-v1";

const MAX_DETAIL = 260;
const trimText = (value, fallback) => typeof value === "string" && value.trim()
  ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, MAX_DETAIL)
  : fallback;

function diagnostic(code, severity, title, detail, nextAction) {
  return {code, severity, title, detail, nextAction};
}

function fail(message) { throw new TypeError(message); }

/**
 * @param {object} inspection - Output of inspectZip after ZIP structural validation.
 * @param {{status?:"not_attempted"|"prepared"|"failed",error?:string}} attempt
 * Assessment never asserts that an iframe actually displayed app content.
 */
export function assessZipInspection(inspection, attempt={}) {
  if (!inspection || typeof inspection !== "object" || Array.isArray(inspection))
    fail("Engine requires a validated ZIP inspection object.");
  const stage=attempt?.status??"not_attempted";
  if (!["not_attempted","prepared","failed"].includes(stage))
    fail("Engine received an unknown preview attempt state.");
  const count=inspection.buildCandidateCount;
  const entries=inspection.buildCandidates;
  if (!Number.isSafeInteger(count) || count<0 || !Array.isArray(entries) ||
      entries.length!==Math.min(count,10) || entries.some(x=>typeof x!=="string"))
    fail("Engine needs normalized, bounded Web build metadata.");
  if (stage==="prepared" && count!==1)
    fail("Cannot mark a ZIP prepared without one selected Web build entrypoint.");

  const source={
    type:"zip",
    filename:trimText(inspection.filename,"archive.zip"),
    detectedKind:trimText(inspection.kind,"unknown"),
    framework:trimText(inspection.framework,"I paidentifikuar"),
    buildCandidateCount:count,
    entrypoint:count===1?trimText(entries[0],""):null
  };

  let status="unsupported", code="UNSUPPORTED_ZIP", previewMode=null;
  let diag=diagnostic(
    "UNSUPPORTED_ZIP","warning","Format i pambështetur",
    "Arkivi nuk ka një Web build të njohur për Quick Preview.",
    "Përgatit një Web build ose lidhe aplikacionin përmes URL-së së publikuar."
  );

  if (count>1) {
    code="MULTIPLE_WEB_BUILDS";
    diag=diagnostic(code,"warning","Më shumë se një Web build",
      "U gjetën disa hyrje dist/build/out. Studio nuk zgjedh automatikisht njërën.",
      "Përgatit një ZIP që përmban vetëm një Web build.");
  } else if (count===1) {
    status="candidate";
    code="WEB_BUILD_CANDIDATE";
    previewMode="zip-offline";
    diag=diagnostic(code,"info","Web build kandidat",
      "U identifikua hyrja Web, por asnjë JS/CSS bundle nuk është verifikuar ende.",
      "Verifiko build-in me Quick Preview.");
  } else if (inspection.kind==="source") {
    status="build_required";
    code="SOURCE_BUILD_REQUIRED";
    diag=diagnostic(code,"info","Kërkohet Web build",
      "Arkivi përmban kod burimor, jo një Web build të gatshëm.",
      "Ndërto aplikacionin në mjedis të izoluar dhe ngarko artefaktin dist/build/out.");
  } else if (inspection.kind==="native") {
    status="native_build_required";
    code="ANDROID_BUILD_REQUIRED";
    diag=diagnostic(code,"info","Kërkohet APK",
      "Kodi Android nuk është një APK që mund të hapet në emulator.",
      "Ndërto një APK veçmas dhe përdor lidhjen Appetize.");
  }

  if (stage==="prepared") {
    status="prepared";
    code="OFFLINE_PAYLOAD_PREPARED";
    previewMode="zip-offline";
    diag=diagnostic(code,"info","Preview i përgatitur",
      "HTML për iframe të izoluar u gjenerua. Kjo nuk verifikon renderimin, backend-in apo të gjitha funksionet.",
      "Kontrollo pamjen dhe ndërveprimet në telefon.");
  } else if (stage==="failed") {
    status="failed";
    code="ZIP_RENDER_FAILED";
    previewMode=null;
    diag=diagnostic(code,"warning","Quick Preview nuk u përgatit",
      trimText(attempt.error,"Renderer-i nuk e pranoi këtë build."),
      "Kontrollo që ZIP të përmbajë një build Web të mbështetur dhe të gjitha asset-et e nevojshme.");
  }

  return {
    schema:ENGINE_SCHEMA,
    source,
    decision:{
      code,
      status,
      previewMode,
      previewPrepared:status==="prepared",
      requiresBuild:status==="build_required" || status==="native_build_required",
      verifiedExecution:false
    },
    diagnostics:[diag],
    security:{
      uploadedToCloud:false,
      persistedByEngine:false,
      executedByEngine:false,
      renderBoundary:"opaque-origin-sandbox-only"
    }
  };
}
