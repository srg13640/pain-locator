import { severityChange } from "../lib/history";
import { centralDay, formatCentralTime } from "../lib/time";
import type { PainEntry } from "../lib/types";

type Props = {
  entries: PainEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function HistoryPanel({ entries, selectedId, onSelect }: Props) {
  if (entries.length === 0) {
    return (
      <div>
        <h2 className="font-serif text-lg text-stone-900">History</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          No pain notes yet. Turn the body, then tap the spot that hurts. Each saved note stays in the history so you can see whether the same place is changing.
        </p>
      </div>
    );
  }

  const ordered = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const days = [...new Set(ordered.map((entry) => centralDay(new Date(entry.createdAt))))];

  return (
    <div>
      <h2 className="font-serif text-lg text-stone-900">History</h2>
      <p className="mt-1 text-sm text-stone-600">Times are US Central (CT). Tap a note to open it again.</p>
      <div className="mt-3 space-y-4">
        {days.map((day) => (
          <section key={day}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{day}</h3>
            <ul className="mt-1 space-y-2">
              {ordered
                .filter((entry) => centralDay(new Date(entry.createdAt)) === day)
                .map((entry) => {
                  const change = severityChange(entries, entry);
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(entry.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left ${
                          selectedId === entry.id ? "border-teal-800 bg-teal-50" : "border-stone-300 bg-white"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-stone-900">
                          {entry.structure.medicalName} · {entry.severity}/10
                        </span>
                        <span className="block text-xs text-stone-600">
                          {formatCentralTime(new Date(entry.createdAt))}
                          {entry.quality ? ` · ${entry.quality}` : ""}
                        </span>
                        {change && <span className="mt-1 block text-xs leading-relaxed text-stone-700">{change}</span>}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
