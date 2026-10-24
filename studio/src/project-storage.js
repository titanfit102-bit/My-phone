import {STORAGE_KEY, newProject, utf8ByteLength} from "./project-model.js";

export const BACKUP_FORMAT = "my-phone-studio-backup-v1";
export const MAX_BACKUP_BYTES = 200_000;
export const MAX_PROJECTS = 100;
// Separate localStorage key, never reused for ordinary Studio writes.
export const ORIGINAL_REGISTRY_KEY = STORAGE_KEY + "-unreadable-original-v1";
// ISO timestamps always use 24 characters; reserve an identical-length stamp.
const BACKUP_SIZE_STAMP = "2000-01-01T00:00:00.000Z";

export function validateProjectList(candidate) {
  if (!Array.isArray(candidate) || candidate.length > MAX_PROJECTS)
    throw new Error("Lista e projekteve nuk është e vlefshme (maksimumi 100).");
  const ids = new Set();
  const projects = candidate.map(item => {
    if (!item || typeof item !== "object") throw new Error("Regjistër projekti i pavlefshëm.");
    const project = newProject(item, item.id);
    if (ids.has(project.id)) throw new Error("ID projekti e përsëritur.");
    ids.add(project.id);
    return project;
  });
  // A saved registry must ALWAYS be exportable to a backup this Studio accepts.
  // The timestamp has a fixed ISO length, so this budget is deterministic.
  const backup = JSON.stringify({
    format: BACKUP_FORMAT, exportedAt: BACKUP_SIZE_STAMP, projects
  }, null, 2);
  if (utf8ByteLength(backup) > MAX_BACKUP_BYTES)
    throw new Error("Projektet tejkalojnë kufirin 200000 byte të backup-it.");
  return projects;
}

export function readProjectRegistry(storage) {
  if (!storage) return {ok: false, projects: [], reason: "unavailable"};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return {ok: true, projects: [], reason: null};
    const projects = validateProjectList(JSON.parse(raw));
    return {ok: true, projects, reason: null};
  } catch {
    // Crucial: do NOT rewrite unreadable/invalid existing data with [] on mount.
    return {ok: false, projects: [], reason: "unreadable"};
  }
}

export function writeProjectRegistry(storage, projects) {
  try {
    if (!storage) throw new Error("Storage not available");
    storage.setItem(STORAGE_KEY, JSON.stringify(validateProjectList(projects)));
    return {ok: true, reason: null};
  } catch {
    return {ok: false, reason: "write_failed"};
  }
}


/**
 * Returns the *original* localStorage string only when standard validation
 * refuses it. Never coerce, sanitize, truncate or overwrite legacy data here.
 */
export function readUnreadableRegistryRaw(storage) {
  try {
    if (!storage || readProjectRegistry(storage).reason !== "unreadable") return null;
    return storage.getItem(STORAGE_KEY);
  } catch { return null; }
}

export function readPreservedOriginalRaw(storage) {
  try { return storage?.getItem(ORIGINAL_REGISTRY_KEY) ?? null; }
  catch { return null; }
}

/**
 * Explicit recovery transaction for a user-reviewed, valid imported backup.
 *
 * Before touching the active key, store and read back the exact original value
 * under a distinct immutable key. Fail closed on any quota, storage race or
 * conflicting preserved copy. No legacy entry is silently transformed.
 */
export function recoverUnreadableRegistry(storage, expectedRaw, candidate) {
  try {
    const valid = validateProjectList(candidate);
    if (!storage || typeof expectedRaw !== "string" ||
        readProjectRegistry(storage).reason !== "unreadable" ||
        storage.getItem(STORAGE_KEY) !== expectedRaw)
      return {ok:false, reason:"source_changed"};
    const savedOriginal = storage.getItem(ORIGINAL_REGISTRY_KEY);
    if (savedOriginal !== null && savedOriginal !== expectedRaw)
      return {ok:false, reason:"original_conflict"};
    if (savedOriginal === null)
      storage.setItem(ORIGINAL_REGISTRY_KEY, expectedRaw);
    if (storage.getItem(ORIGINAL_REGISTRY_KEY) !== expectedRaw)
      return {ok:false, reason:"preservation_failed"};

    // Both copies are read from localStorage again before replacing the active
    // key, guarding against a changed original during the recovery dialog.
    if (storage.getItem(STORAGE_KEY) !== expectedRaw)
      return {ok:false, reason:"source_changed"};
    const result = writeProjectRegistry(storage, valid);
    if (!result.ok) return {ok:false, reason:"write_failed"};
    if (!readProjectRegistry(storage).ok)
      return {ok:false, reason:"verify_failed"};
    return {ok:true, reason:null};
  } catch {
    return {ok:false, reason:"preservation_failed"};
  }
}

export function serializeProjectBackup(projects) {
  const output = JSON.stringify({
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    projects: validateProjectList(projects)
  }, null, 2);
  if (utf8ByteLength(output) > MAX_BACKUP_BYTES)
    throw new Error("Kopja e sigurisë tejkalon kufirin 200000 byte.");
  return output;
}

export function parseProjectBackup(raw) {
  if (typeof raw !== "string" || utf8ByteLength(raw) > MAX_BACKUP_BYTES)
    throw new Error("Kopja e sigurisë është tepër e madhe ose e pavlefshme.");
  let value;
  try {value = JSON.parse(raw);} catch {throw new Error("Skedari nuk është JSON i vlefshëm.");}
  if (!value || typeof value !== "object" || value.format !== BACKUP_FORMAT)
    throw new Error("Ky skedar nuk është backup i My Phone Studio.");
  return validateProjectList(value.projects);
}
