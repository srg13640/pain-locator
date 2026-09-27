import { describe, expect, it } from "vitest";
import {
  acknowledgeEmergency,
  anyWarningChecked,
  canPlacePin,
  initialSafety,
  submitChecklist,
  toggleWarning,
} from "../src/lib/safety";

describe("safety screen gate", () => {
  it("blocks pins until the checklist is passed with no warning signs", () => {
    const start = initialSafety();
    expect(canPlacePin(start)).toBe(false);
    const cleared = submitChecklist(start);
    expect(cleared.phase).toBe("clear");
    expect(canPlacePin(cleared)).toBe(true);
  });

  it("opens the 911 screen when any warning is checked and blocks pins until it is acknowledged", () => {
    const warned = toggleWarning(initialSafety(), "crushing", true);
    expect(anyWarningChecked(warned)).toBe(true);
    const emergency = submitChecklist(warned);
    expect(emergency.phase).toBe("emergency");
    expect(canPlacePin(emergency)).toBe(false);
    const acknowledged = acknowledgeEmergency(emergency);
    expect(acknowledged.phase).toBe("acknowledged");
    expect(canPlacePin(acknowledged)).toBe(true);
  });

  it("does not treat acknowledgment as valid before the 911 screen", () => {
    expect(acknowledgeEmergency(initialSafety()).phase).toBe("needed");
  });
});
