import { describe, expect, it } from "vitest";
import { deleteLocalEntry, readLocalEntries, saveLocalEntry } from "../src/lib/localNotes";
import type { PainEntry, StoredStructure } from "../src/lib/types";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const structure: StoredStructure = {
  structureId: "skeleton-body-of-sternum",
  medicalName: "Body of sternum",
  plain: "The middle of the breastbone.",
  fma: "7487",
  layer: "skeleton",
  side: "midline",
  sourceName: "Body of sternum",
};

function draft() {
  return {
    id: null,
    position: [0, 1, 2] as [number, number, number],
    structure,
    beneath: [],
    quality: "sharp" as const,
    severity: 6,
    radiation: null,
    triggers: ["breathing in" as const, "rest" as const],
    onset: "This morning",
    duration: "About 20 minutes",
    notes: "Worse when I take a deep breath.",
  };
}

describe("phone notes", () => {
  it("keeps a note in the store and keeps the original time when it is edited", () => {
    const store = memoryStore();
    const created = new Date("2026-09-26T13:18:34.278Z");
    const saved = saveLocalEntry(store, draft(), undefined, created);
    const edited = saveLocalEntry(
      store,
      { ...draft(), id: saved.id, severity: 14, notes: "Still there." },
      saved,
      new Date("2026-09-26T15:00:00.000Z"),
    );
    const entries = readLocalEntries(store);
    expect(entries).toHaveLength(1);
    expect(edited.createdAt).toBe(created.toISOString());
    expect(edited.updatedAt).toBe("2026-09-26T15:00:00.000Z");
    expect(edited.severity).toBe(10);
    expect(edited.notes).toBe("Still there.");
  });

  it("drops a broken saved list and deletes one note", () => {
    const store = memoryStore();
    store.setItem("pain-locator-entries-v1", "{not json");
    expect(readLocalEntries(store)).toEqual([]);
    const saved = saveLocalEntry(store, draft(), undefined, new Date("2026-09-26T13:18:34.278Z"));
    deleteLocalEntry(store, saved.id);
    expect(readLocalEntries(store)).toEqual([]);
  });

  it("ignores a list entry that has no body part name", () => {
    const store = memoryStore();
    const broken = { id: "x", position: [0, 0, 0] };
    store.setItem("pain-locator-entries-v1", JSON.stringify([broken, { ...broken, structure } satisfies Partial<PainEntry>]));
    expect(readLocalEntries(store)).toHaveLength(1);
  });
});
