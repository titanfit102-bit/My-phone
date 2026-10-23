import {STORAGE_KEY, newProject, utf8ByteLength} from "./project-model.js";

export const BACKUP_FORMAT = "my-phone-studio-backup-v1";
export const MAX_BACKUP_BYTES = 200_000;
export const MAX_PROJECTS = 100;
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
