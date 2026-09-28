import * as SliderPrimitive from "@radix-ui/react-slider";

type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  label: string;
};

export function Slider({ value, min = 0, max = 10, step = 1, onValueChange, label }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className="relative flex h-8 w-full touch-none items-center"
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(next) => onValueChange(next[0] ?? 0)}
      aria-label={label}
    >
      <SliderPrimitive.Track className="relative h-2 grow rounded-full bg-stone-300">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-teal-800" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-6 w-6 rounded-full border-2 border-teal-900 bg-white shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800" />
    </SliderPrimitive.Root>
  );
}
