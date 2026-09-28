import type { LayerSetting } from "../lib/types";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";

type Props = {
  layers: LayerSetting[];
  onChange: (layers: LayerSetting[]) => void;
};

export function LayerPanel({ layers, onChange }: Props) {
  const update = (id: LayerSetting["id"], patch: Partial<LayerSetting>) => {
    onChange(layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-lg text-stone-900">Layers</h2>
        <p className="text-sm text-stone-600">Turn a layer off, or make it see-through, to look underneath.</p>
      </div>
      {layers.map((layer) => (
        <div key={layer.id} className="rounded-md border border-stone-300 bg-white/70 p-3">
          <div className="flex items-start gap-3">
            <Checkbox id={`layer-${layer.id}`} checked={layer.visible} onCheckedChange={(visible) => update(layer.id, { visible })} />
            <div className="min-w-0 flex-1">
              <Label htmlFor={`layer-${layer.id}`}>{layer.label}</Label>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">{layer.detail}</p>
            </div>
          </div>
          <div className="mt-3 pl-8">
            <div className="mb-1 flex justify-between text-xs text-stone-600">
              <span>See-through</span>
              <span>{Math.round(layer.opacity * 100)}%</span>
            </div>
            <Slider
              label={`${layer.label} transparency`}
              min={0}
              max={1}
              step={0.05}
              value={layer.opacity}
              onValueChange={(opacity) => update(layer.id, { opacity })}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
