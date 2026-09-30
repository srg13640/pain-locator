import { describe, expect, it } from "vitest";
import { buildPainPdf } from "../src/lib/pdf";
import type { PainEntry } from "../src/lib/types";

const entry: PainEntry = {
  id: "pin-1",
  createdAt: "2026-07-15T18:30:00.000Z",
  updatedAt: "2026-07-15T18:30:00.000Z",
  position: [1, 2, 3],
  structure: {
    structureId: "skeleton-fourth-rib-l",
    medicalName: "Left fourth rib",
    plain: "The fourth rib on the patient's left, counting down from the top of the rib cage.",
    fma: "FMA8148",
    layer: "skeleton",
    side: "left",
    sourceName: "Fourth rib.l",
  },
  beneath: [],
  quality: "sharp",
  severity: 6,
  radiation: {
    position: [4, 5, 6],
    structure: {
      structureId: "skeleton-left-clavicle",
      medicalName: "Left clavicle",
      plain: "The collarbone on the patient's left.",
      fma: "FMA13323",
      layer: "skeleton",
      side: "left",
      sourceName: "Clavicle.l",
    },
  },
  triggers: ["breathing in", "rest"],
  onset: "this morning",
  duration: "about an hour",
  notes: "Worse when I lean forward.",
};

describe("PDF export", () => {
  it("writes a PDF a clinician can read, with location, quality, severity, radiation, timing, and factors", () => {
    const bytes = buildPainPdf([entry], {}, new Date("2026-07-15T18:40:00Z"));
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toContain("Pain location record");
    expect(text).toContain("Documentation tool only. Not a medical device. Does not diagnose.");
    expect(text).toContain("Left fourth rib");
    expect(text).toContain("FMA8148");
    expect(text).toContain("Quality: sharp");
    expect(text).toContain("Severity: 6/10");
    expect(text).toContain("Radiation: spreads toward Left clavicle");
    expect(text).toContain("this morning");
    expect(text).toContain("Aggravating factors: breathing in");
    expect(text).toContain("Relieving factors: rest");
    expect(text).toContain("13:30 CT");
    expect(text).toContain("History log");
  });

  it("names which body the pictures use", () => {
    const bytes = buildPainPdf([entry], {}, new Date("2026-07-15T18:40:00Z"), "Pictures use a woman's body.");
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("Pictures use a woman's body.");
  });
});
