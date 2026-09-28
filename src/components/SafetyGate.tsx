import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import {
  WARNING_SIGNS,
  acknowledgeEmergency,
  anyWarningChecked,
  submitChecklist,
  toggleWarning,
  type SafetyState,
} from "../lib/safety";

type Props = {
  state: SafetyState;
  open: boolean;
  onChange: (state: SafetyState) => void;
  onLookFirst: () => void;
};

export function SafetyGate({ state, open, onChange, onLookFirst }: Props) {
  if (state.phase === "emergency") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950 px-4 text-white" role="alertdialog" aria-labelledby="emergency-title">
        <div className="max-w-lg">
          <p className="font-serif text-4xl" id="emergency-title">
            Call 911 now.
          </p>
          <p className="mt-4 text-lg leading-relaxed">
            You checked a warning sign. If that is happening now, call 911 or your local emergency number. Do not wait to see if it passes.
          </p>
          <p className="mt-3 text-lg leading-relaxed">This program cannot help with an emergency. It only writes down symptoms later, if you still want a note for a doctor.</p>
          <Button className="mt-6 bg-white text-red-950 hover:bg-red-100" size="lg" onClick={() => onChange(acknowledgeEmergency(state))}>
            I understand. I will call 911.
          </Button>
        </div>
      </div>
    );
  }

  if (!open || state.phase !== "needed") return null;

  const warned = anyWarningChecked(state);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/55 p-3 sm:items-center" role="dialog" aria-labelledby="safety-title">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg bg-stone-50 p-5 shadow-xl">
        <h2 id="safety-title" className="font-serif text-2xl text-stone-900">
          Before you mark pain, read this
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-700">
          This page only writes down what you feel. It cannot tell you what is wrong, and it cannot tell you what to do about it.
        </p>
        <p className="mt-3 text-sm font-semibold text-stone-900">Check any of these that are happening right now:</p>
        <ul className="mt-3 space-y-3">
          {WARNING_SIGNS.map((sign) => (
            <li key={sign.id} className="flex items-start gap-3">
              <Checkbox
                id={`warn-${sign.id}`}
                checked={state.checks[sign.id]}
                onCheckedChange={(checked) => onChange(toggleWarning(state, sign.id, checked))}
              />
              <Label htmlFor={`warn-${sign.id}`} className="font-normal leading-snug">
                {sign.text}
              </Label>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {warned ? (
            <Button variant="danger" size="lg" onClick={() => onChange(submitChecklist(state))}>
              One of these is happening
            </Button>
          ) : (
            <Button size="lg" onClick={() => onChange(submitChecklist(state))}>
              None of these are happening
            </Button>
          )}
          {!warned && (
            <Button variant="outline" size="lg" onClick={onLookFirst}>
              Look at the body first
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
