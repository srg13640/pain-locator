import type { PainEntry } from "./types";
import { formatCentralTime } from "./time";

export function previousSamePlace(entries: PainEntry[], entry: PainEntry): PainEntry | null {
  const earlier = entries
    .filter(
      (item) =>
        item.id !== entry.id &&
        item.structure.structureId === entry.structure.structureId &&
        item.createdAt < entry.createdAt,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return earlier[0] ?? null;
}

export function severityChange(entries: PainEntry[], entry: PainEntry): string | null {
  const earlier = previousSamePlace(entries, entry);
  if (!earlier) return null;
  const delta = entry.severity - earlier.severity;
  const word = delta === 0 ? "the same" : delta > 0 ? "higher" : "lower";
  return `This same place was ${earlier.severity}/10 at ${formatCentralTime(new Date(earlier.createdAt))}, and it is ${word} now at ${entry.severity}/10.`;
}

export function aggravatingFactors(entry: PainEntry): string[] {
  return entry.triggers.filter((trigger) => trigger !== "rest");
}

export function relievingFactors(entry: PainEntry): string[] {
  return entry.triggers.filter((trigger) => trigger === "rest");
}
