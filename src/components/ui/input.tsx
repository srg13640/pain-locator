import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-sm text-stone-900 outline-none focus:border-teal-800",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-md border border-stone-400 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-teal-800",
        className,
      )}
      {...props}
    />
  );
}
