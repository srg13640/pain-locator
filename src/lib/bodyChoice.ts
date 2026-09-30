export type BodyChoice = "woman" | "man";

export const BODY_CHOICE_KEY = "pain-locator-body-v1";

type ChoiceStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function readBodyChoice(store: ChoiceStore): BodyChoice | null {
  try {
    const value = store.getItem(BODY_CHOICE_KEY);
    if (value === "woman" || value === "man") return value;
    return null;
  } catch {
    return null;
  }
}

export function writeBodyChoice(store: ChoiceStore, choice: BodyChoice): void {
  store.setItem(BODY_CHOICE_KEY, choice);
}

/** The outer surface for this person. Bones and organs stay the shared atlas. */
export function skinFileFor(choice: BodyChoice): string {
  return choice === "woman" ? "skin-female.glb" : "skin.glb";
}

export function bodyPictureLine(choice: BodyChoice): string {
  return choice === "woman" ? "Pictures use a woman's body." : "Pictures use a man's body.";
}
