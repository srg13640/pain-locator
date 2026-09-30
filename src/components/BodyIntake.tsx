import { Button } from "./ui/button";
import type { BodyChoice } from "../lib/bodyChoice";

type Props = {
  open: boolean;
  changing: boolean;
  onChoose: (choice: BodyChoice) => void;
};

export function BodyIntake({ open, changing, onChoose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#efe6d6] p-4 sm:items-center" role="dialog" aria-labelledby="body-title">
      <div className="w-full max-w-lg pb-6">
        <h2 id="body-title" className="font-serif text-3xl text-stone-900">
          Which body should this use?
        </h2>
        <p className="mt-3 text-base leading-relaxed text-stone-700">
          The picture should match the person. A woman's body and a man's body are not the same. This choice stays on this phone.
        </p>
        {changing ? (
          <p className="mt-3 text-sm leading-relaxed text-stone-600">Notes already saved stay on the body they were marked on.</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" className="h-14 w-full text-lg" onClick={() => onChoose("woman")}>
            A woman's body
          </Button>
          <Button size="lg" className="h-14 w-full text-lg" onClick={() => onChoose("man")}>
            A man's body
          </Button>
        </div>
      </div>
    </div>
  );
}
