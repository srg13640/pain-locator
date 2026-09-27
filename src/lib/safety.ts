export const WARNING_SIGNS = [
  { id: "crushing", text: "Crushing or squeezing pressure in the chest" },
  { id: "spreading", text: "Pain spreading to the arm, jaw, neck, or back" },
  { id: "breath", text: "Shortness of breath" },
  { id: "sweating", text: "Sweating" },
  { id: "nausea", text: "Nausea" },
  { id: "faint", text: "Feeling lightheaded, or like you might faint" },
  { id: "tearing", text: "Sudden tearing pain" },
] as const;

export type WarningId = (typeof WARNING_SIGNS)[number]["id"];

export type SafetyPhase = "needed" | "emergency" | "clear" | "acknowledged";

export type SafetyState = {
  phase: SafetyPhase;
  checks: Record<WarningId, boolean>;
};

export function initialSafety(): SafetyState {
  const checks = {} as Record<WarningId, boolean>;
  for (const sign of WARNING_SIGNS) checks[sign.id] = false;
  return { phase: "needed", checks };
}

export function anyWarningChecked(state: SafetyState): boolean {
  return WARNING_SIGNS.some((sign) => state.checks[sign.id]);
}

/** A pin can be placed only after the checklist is finished. */
export function canPlacePin(state: SafetyState): boolean {
  return state.phase === "clear" || state.phase === "acknowledged";
}

export function toggleWarning(state: SafetyState, id: WarningId, checked: boolean): SafetyState {
  return { ...state, checks: { ...state.checks, [id]: checked } };
}

export function submitChecklist(state: SafetyState): SafetyState {
  if (anyWarningChecked(state)) return { ...state, phase: "emergency" };
  return { ...state, phase: "clear" };
}

export function acknowledgeEmergency(state: SafetyState): SafetyState {
  if (state.phase !== "emergency") return state;
  return { ...state, phase: "acknowledged" };
}
