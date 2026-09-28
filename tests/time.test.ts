import { describe, expect, it } from "vitest";
import { formatCentralTime } from "../src/lib/time";

describe("Central Time stamps", () => {
  it("uses daylight time in July and standard time in January, and labels both CT", () => {
    expect(formatCentralTime(new Date("2026-07-15T18:30:00Z"))).toBe("2026-07-15 13:30 CT");
    expect(formatCentralTime(new Date("2026-01-15T18:30:00Z"))).toBe("2026-01-15 12:30 CT");
  });
});
