import type { PainEntry } from "./types";

export const LOCAL_NOTES_KEY = "pain-locator-entries-v1";

export const PHONE_NOTES_LABEL = "In this browser’s saved data for Pain Locator, on this device only";

type NoteStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type NoteDraft = {
  id: string | null;
  position: PainEntry["position"];
  structure: PainEntry["structure"];
  beneath: PainEntry["beneath"];
  quality: PainEntry["quality"];
  severity: number;
  radiation: PainEntry["radiation"];
  triggers: PainEntry["triggers"];
  onset: string;
  duration: string;
  notes: string;
};

function isEntry(value: unknown): value is PainEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as PainEntry;
  return (
    typeof entry.id === "string" &&
    Array.isArray(entry.position) &&
    entry.position.length === 3 &&
    Boolean(entry.structure) &&
    typeof entry.structure.medicalName === "string"
  );
}

export function readLocalEntries(store: NoteStore): PainEntry[] {
  try {
    const raw = store.getItem(LOCAL_NOTES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

export function saveLocalEntry(store: NoteStore, draft: NoteDraft, existing: PainEntry | undefined, now = new Date()): PainEntry {
  const severity = Number(draft.severity);
  const saved: PainEntry = {
    id: existing?.id || draft.id || crypto.randomUUID(),
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    position: draft.position,
    structure: draft.structure,
    beneath: Array.isArray(draft.beneath) ? draft.beneath : [],
    quality: draft.quality ?? null,
    severity: Number.isFinite(severity) ? Math.min(10, Math.max(0, severity)) : 0,
    radiation: draft.radiation ?? null,
    triggers: Array.isArray(draft.triggers) ? draft.triggers : [],
    onset: typeof draft.onset === "string" ? draft.onset : "",
    duration: typeof draft.duration === "string" ? draft.duration : "",
    notes: typeof draft.notes === "string" ? draft.notes : "",
  };
  const entries = readLocalEntries(store).filter((entry) => entry.id !== saved.id);
  store.setItem(LOCAL_NOTES_KEY, JSON.stringify([...entries, saved]));
  return saved;
}

export function deleteLocalEntry(store: NoteStore, id: string): void {
  const entries = readLocalEntries(store).filter((entry) => entry.id !== id);
  store.setItem(LOCAL_NOTES_KEY, JSON.stringify(entries));
}
