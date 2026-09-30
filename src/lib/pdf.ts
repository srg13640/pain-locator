import { jsPDF } from "jspdf";
import { aggravatingFactors, relievingFactors, severityChange } from "./history";
import { formatCentralTime } from "./time";
import type { PainEntry } from "./types";

export type PdfImages = {
  front?: string;
  back?: string;
  side?: string;
};

const DISCLAIMER = "Documentation tool only. Not a medical device. Does not diagnose.";

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function sideLabel(side: string): string {
  if (side === "left") return "patient's left";
  if (side === "right") return "patient's right";
  return "midline";
}

export function buildPainPdf(entries: PainEntry[], images: PdfImages, generatedAt: Date, bodyLine?: string): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const width = pageWidth - margin * 2;
  let y = 42;

  const freshPage = () => {
    doc.addPage();
    y = 42;
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(DISCLAIMER, margin, 24);
    doc.setTextColor(20);
    y = 40;
  };

  const ensure = (needed: number) => {
    if (y + needed > 760) freshPage();
  };

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text("Pain location record", margin, y);
  y += 16;
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.text(DISCLAIMER, margin, y);
  y += 12;
  doc.setFont("times", "normal");
  doc.text(`Written ${formatCentralTime(generatedAt)}. Times below are US Central Time (CT).`, margin, y);
  y += 8;
  doc.text("This sheet records what the person marked. It does not offer a diagnosis or a treatment.", margin, y);
  y += 14;
  if (bodyLine) {
    doc.text(bodyLine, margin, y);
    y += 16;
  } else {
    y += 2;
  }

  const shots: { label: string; data?: string }[] = [
    { label: "Front", data: images.front },
    { label: "Back", data: images.back },
    { label: "Patient's left side", data: images.side },
  ];
  if (shots.some((shot) => shot.data)) {
    const boxW = (width - 16) / 3;
    const boxH = 150;
    ensure(boxH + 16);
    shots.forEach((shot, index) => {
      const x = margin + index * (boxW + 8);
      doc.setDrawColor(180);
      doc.rect(x, y, boxW, boxH);
      if (shot.data) {
        doc.addImage(shot.data, "JPEG", x + 2, y + 2, boxW - 4, boxH - 18);
      }
      doc.setFontSize(8);
      doc.setFont("times", "bold");
      doc.text(shot.label, x + 6, y + boxH - 6);
    });
    y += boxH + 16;
  }

  if (entries.length === 0) {
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text("No pain pins have been saved.", margin, y);
  }

  entries.forEach((entry, index) => {
    ensure(120);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(`Pin ${index + 1} — ${formatCentralTime(new Date(entry.createdAt))}`, margin, y);
    y += 14;
    doc.setFont("times", "normal");
    doc.setFontSize(10);

    const location = [
      `Location: ${entry.structure.medicalName}`,
      entry.structure.fma ? `(${entry.structure.fma})` : "",
      `— ${entry.structure.layer}, ${sideLabel(entry.structure.side)}.`,
      entry.structure.plain,
    ]
      .filter(Boolean)
      .join(" ");
    y = writeWrapped(doc, location, margin, y, width, 13);

    if (entry.beneath.length > 0) {
      const under = entry.beneath
        .map((item) => item.medicalName + (item.fma ? ` (${item.fma})` : ""))
        .join("; ");
      y = writeWrapped(doc, `Structures under that point, from the surface inward: ${under}.`, margin, y, width, 13);
    }

    y = writeWrapped(doc, `Quality: ${entry.quality ?? "not recorded"}.`, margin, y, width, 13);
    y = writeWrapped(doc, `Severity: ${entry.severity}/10.`, margin, y, width, 13);

    const radiation = entry.radiation
      ? entry.radiation.structure
        ? `Radiation: spreads toward ${entry.radiation.structure.medicalName}.`
        : "Radiation: an arrow was drawn to another point on the body."
      : "Radiation: no spread was marked.";
    y = writeWrapped(doc, radiation, margin, y, width, 13);

    y = writeWrapped(
      doc,
      `Timing: onset ${entry.onset.trim() || "not recorded"}; duration ${entry.duration.trim() || "not recorded"}.`,
      margin,
      y,
      width,
      13,
    );

    const aggravating = aggravatingFactors(entry);
    const relieving = relievingFactors(entry);
    y = writeWrapped(
      doc,
      `Aggravating factors: ${aggravating.length ? aggravating.join(", ") : "none recorded"}.`,
      margin,
      y,
      width,
      13,
    );
    y = writeWrapped(
      doc,
      `Relieving factors: ${relieving.length ? relieving.join(", ") : "none recorded"}.`,
      margin,
      y,
      width,
      13,
    );

    if (entry.notes.trim()) {
      y = writeWrapped(doc, `Notes: ${entry.notes.trim()}`, margin, y, width, 13);
    }

    const change = severityChange(entries, entry);
    if (change) y = writeWrapped(doc, change, margin, y, width, 13);
    y += 8;
  });

  ensure(36);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("History log", margin, y);
  y += 14;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  if (entries.length === 0) {
    doc.text("No entries yet.", margin, y);
  } else {
    const ordered = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const entry of ordered) {
      ensure(28);
      const line = `${formatCentralTime(new Date(entry.createdAt))} — ${entry.structure.medicalName}, ${entry.quality ?? "quality not recorded"}, ${entry.severity}/10.`;
      y = writeWrapped(doc, line, margin, y, width, 13);
    }
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(`${DISCLAIMER}  Page ${page} of ${pages}`, margin, 780);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
