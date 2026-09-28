import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id: string;
  className?: string;
};

export function Checkbox({ checked, onCheckedChange, id, className }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded border border-stone-500 bg-white data-[state=checked]:border-teal-900 data-[state=checked]:bg-teal-900",
        className,
      )}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
