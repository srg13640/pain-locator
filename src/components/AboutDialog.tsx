import type { Catalog } from "../lib/types";
import { Dialog } from "./ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Catalog | null;
  dataDir: string | null;
  onPhone?: boolean;
  body?: "woman" | "man" | null;
};

export function AboutDialog({ open, onOpenChange, catalog, dataDir, onPhone = false, body = null }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="About this tool">
      <div className="space-y-3 text-sm leading-relaxed text-stone-700">
        <p>
          Pain Locator writes down where something hurts on a 3D body, in words a doctor can read. It does not diagnose, and it does not suggest treatment.
        </p>
        {onPhone ? (
          <p>
            <span className="font-semibold text-stone-900">Your notes stay on this device</span>, in the browser’s saved data for Pain Locator. Clearing this site’s data in the browser erases them. To keep the icon on an iPhone home screen, open this page in Safari, tap Share, then tap Add to Home Screen.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-stone-900">Your notes stay on this computer</span> in{" "}
            <span className="font-mono text-xs">{dataDir ?? "the PainLocator folder in your home directory"}</span>. Copy that folder to back them up. Delete that folder to erase them. Nothing is sent to the internet.
          </p>
        )}
        {body === "woman" ? (
          <p>
            The outside of this picture is a woman's body, from the Visible Human female reference in the Human Reference Atlas. The bones, muscles, and organs inside are the same atlas used for a man's picture, lined up at the breastbone. The names on the skin are the atlas regions that sit in that same place.
          </p>
        ) : body === "man" ? (
          <p>The outside of this picture is a man's body.</p>
        ) : null}
        <p>
          The body is the Z-Anatomy atlas, made by Gauthier Kervyn, packaged for the desktop viewer by Lluís Vinent Juanico, and licensed Creative Commons Attribution-ShareAlike 4.0. Z-Anatomy is derived from BodyParts3D, © The Database Center for Life Science. The BodyParts3D mesh files in release 4.0 carry a Creative Commons Attribution-ShareAlike 2.1 Japan notice. The current BodyParts3D database readme states Creative Commons Attribution 4.0 International. Please credit both projects if you share the models. Foundational Model of Anatomy (FMA) numbers come from the University of Washington name table shipped with BodyParts3D, matched to the mesh name when the names agree.
        </p>
        <p>
          Left means the patient’s left, the way a clinician uses the word. The letters L and R on the model are the patient’s left and right. They are labels, not body parts.
        </p>
        {catalog && (
          <>
            <p>{catalog.simplification.note}</p>
            <ul className="list-disc space-y-1 pl-5">
              {catalog.omitted.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
        <p className="font-semibold text-stone-900">Documentation tool only. Not a medical device. Does not diagnose.</p>
      </div>
    </Dialog>
  );
}
