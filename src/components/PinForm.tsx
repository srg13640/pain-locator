import { QUALITIES, TRIGGERS, type PainEntry, type PainQuality, type PainTrigger, type StoredStructure } from "../lib/types";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input, Textarea } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";

export type PinDraft = {
  id: string | null;
  position: [number, number, number];
  structure: StoredStructure;
  beneath: StoredStructure[];
  quality: PainQuality | null;
  severity: number;
  radiation: PainEntry["radiation"];
  triggers: PainTrigger[];
  onset: string;
  duration: string;
  notes: string;
};

type Props = {
  draft: PinDraft;
  radiationArmed: boolean;
  saving: boolean;
  onChange: (update: (current: PinDraft) => PinDraft) => void;
  onArmRadiation: () => void;
  onClearRadiation: () => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
};

function sideWords(side: string): string {
  if (side === "left") return "Patient's left";
  if (side === "right") return "Patient's right";
  return "Midline";
}

export function PinForm({
  draft,
  radiationArmed,
  saving,
  onChange,
  onArmRadiation,
  onClearRadiation,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const toggleTrigger = (trigger: PainTrigger, checked: boolean) => {
    onChange((current) => {
      const triggers = checked ? [...current.triggers, trigger] : current.triggers.filter((item) => item !== trigger);
      return { ...current, triggers };
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-900">You touched</p>
        <h2 className="font-serif text-xl leading-snug text-stone-900">{draft.structure.medicalName}</h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-700">{draft.structure.plain}</p>
        <p className="mt-2 text-xs text-stone-600">
          {sideWords(draft.structure.side)} · {draft.structure.layer}
          {draft.structure.fma ? ` · ${draft.structure.fma}` : " · FMA id not listed for this mesh"}
        </p>
      </div>

      {draft.beneath.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-stone-900">Directly under that point, from the surface inward</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-stone-700">
            {draft.beneath.map((item) => (
              <li key={item.structureId}>
                <span className="font-medium text-stone-900">{item.medicalName}</span>
                {item.fma ? ` (${item.fma})` : ""} — {item.plain}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-stone-900">What does it feel like?</p>
        <div className="flex flex-wrap gap-2">
          {QUALITIES.map((quality) => (
            <button
              key={quality}
              type="button"
              onClick={() =>
                onChange((current) => ({ ...current, quality: current.quality === quality ? null : quality }))
              }
              className={`rounded-full border px-3 py-1 text-sm capitalize ${
                draft.quality === quality ? "border-teal-900 bg-teal-900 text-white" : "border-stone-400 bg-white text-stone-800"
              }`}
            >
              {quality}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <Label>How strong is it?</Label>
          <span className="font-serif text-2xl text-stone-900">{draft.severity}/10</span>
        </div>
        <Slider
          label="Severity from 0 to 10"
          value={draft.severity}
          onValueChange={(severity) => onChange((current) => ({ ...current, severity }))}
        />
        <p className="mt-1 text-xs text-stone-500">The slider starts at 0 until you move it.</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-stone-900">Where it spreads</p>
        <p className="mt-1 text-xs text-stone-600">
          {draft.radiation
            ? draft.radiation.structure
              ? `Arrow points toward ${draft.radiation.structure.medicalName}.`
              : "An arrow is drawn on the body."
            : "No spread marked yet."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant={radiationArmed ? "danger" : "outline"} size="sm" onClick={onArmRadiation}>
            {radiationArmed ? "Tap the body where it spreads" : "Draw an arrow"}
          </Button>
          {draft.radiation && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearRadiation}>
              Remove arrow
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-stone-900">What brings it on or eases it?</p>
        <ul className="space-y-2">
          {TRIGGERS.map((trigger) => (
            <li key={trigger} className="flex items-center gap-2">
              <Checkbox
                id={`trigger-${trigger}`}
                checked={draft.triggers.includes(trigger)}
                onCheckedChange={(checked) => toggleTrigger(trigger, checked)}
              />
              <Label htmlFor={`trigger-${trigger}`} className="font-normal capitalize">
                {trigger}
                {trigger === "rest" ? " (counted as easing)" : ""}
              </Label>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="onset">When it started</Label>
          <Input
            id="onset"
            value={draft.onset}
            placeholder="This morning"
            onChange={(event) => onChange((current) => ({ ...current, onset: event.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="duration">How long it lasts</Label>
          <Input
            id="duration"
            value={draft.duration}
            placeholder="About 20 minutes"
            onChange={(event) => onChange((current) => ({ ...current, duration: event.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes in your own words</Label>
        <Textarea id="notes" value={draft.notes} onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : draft.id ? "Update this entry" : "Save this pin"}
        </Button>
        {draft.id && (
          <Button type="button" variant="outline" onClick={onDelete}>
            Delete
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
