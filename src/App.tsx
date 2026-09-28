import { useEffect, useMemo, useRef, useState } from "react";
import { AboutDialog } from "./components/AboutDialog";
import { HistoryPanel } from "./components/HistoryPanel";
import { LayerPanel } from "./components/LayerPanel";
import { PinForm, type PinDraft } from "./components/PinForm";
import { SafetyGate } from "./components/SafetyGate";
import { Viewport, type PinMarker, type TapResult, type ViewportHandle } from "./components/Viewport";
import { Button } from "./components/ui/button";
import { ScrollArea } from "./components/ui/scroll-area";
import { deleteLocalEntry, PHONE_NOTES_LABEL, readLocalEntries, saveLocalEntry } from "./lib/localNotes";
import { publicUrl } from "./lib/publicUrl";
import { canPlacePin, initialSafety, type SafetyState } from "./lib/safety";
import { buildPainPdf } from "./lib/pdf";
import { formatCentralTime } from "./lib/time";
import { DEFAULT_LAYERS, toStored, type Catalog, type LayerSetting, type PainEntry } from "./lib/types";

const SAFETY_KEY = "pain-locator-safety-v1";

function loadSafety(): SafetyState {
  try {
    const raw = sessionStorage.getItem(SAFETY_KEY);
    if (!raw) return initialSafety();
    const parsed = JSON.parse(raw) as SafetyState;
    if (!parsed?.phase || !parsed.checks) return initialSafety();
    return parsed;
  } catch {
    return initialSafety();
  }
}

function draftFromTap(result: TapResult): PinDraft {
  return {
    id: null,
    position: result.position,
    structure: toStored(result.structure),
    beneath: result.beneath.map(toStored),
    quality: null,
    severity: 0,
    radiation: null,
    triggers: [],
    onset: "",
    duration: "",
    notes: "",
  };
}

function draftFromEntry(entry: PainEntry): PinDraft {
  return {
    id: entry.id,
    position: entry.position,
    structure: entry.structure,
    beneath: entry.beneath,
    quality: entry.quality,
    severity: entry.severity,
    radiation: entry.radiation,
    triggers: entry.triggers,
    onset: entry.onset,
    duration: entry.duration,
    notes: entry.notes,
  };
}

export default function App() {
  const viewportRef = useRef<ViewportHandle>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [layers, setLayers] = useState<LayerSetting[]>(DEFAULT_LAYERS);
  const [entries, setEntries] = useState<PainEntry[]>([]);
  const [draft, setDraft] = useState<PinDraft | null>(null);
  const [panel, setPanel] = useState<"pin" | "history">("history");
  const [safety, setSafety] = useState<SafetyState>(loadSafety);
  const [safetyOpen, setSafetyOpen] = useState(true);
  const [pendingTap, setPendingTap] = useState<TapResult | null>(null);
  const [radiationArmed, setRadiationArmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [storage, setStorage] = useState<"pending" | "computer" | "phone">("pending");
  const [layersOpen, setLayersOpen] = useState(false);
  const [viewTitle, setViewTitle] = useState("Looking at the front");
  const [viewDetail, setViewDetail] = useState("Patient's left is on the right side of this picture. Left always means the patient's left.");

  useEffect(() => {
    sessionStorage.setItem(SAFETY_KEY, JSON.stringify(safety));
  }, [safety]);

  useEffect(() => {
    void (async () => {
      try {
        const catalogResponse = await fetch(publicUrl("anatomy/catalog.json"));
        if (!catalogResponse.ok) throw new Error("The anatomy catalog was not found.");
        setCatalog((await catalogResponse.json()) as Catalog);
        const [entryResponse, infoResponse] = await Promise.all([fetch(publicUrl("api/entries")), fetch(publicUrl("api/info"))]);
        const isJson = (response: Response) => (response.headers.get("content-type") ?? "").includes("json");
        if (entryResponse.ok && infoResponse.ok && isJson(entryResponse) && isJson(infoResponse)) {
          setEntries((await entryResponse.json()) as PainEntry[]);
          const info = (await infoResponse.json()) as { dataDir: string };
          setDataDir(info.dataDir);
          setStorage("computer");
        } else {
          setEntries(readLocalEntries(localStorage));
          setDataDir(PHONE_NOTES_LABEL);
          setStorage("phone");
          setStatus("Notes you save stay on this device.");
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "The app could not read its files.");
      }
    })();
  }, []);

  const pins: PinMarker[] = useMemo(() => {
    const ordered = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const markers: PinMarker[] = ordered.map((entry, index) => ({
      id: entry.id,
      position: entry.position,
      radiation: entry.radiation?.position ?? null,
      selected: draft?.id === entry.id,
      number: index + 1,
    }));
    if (draft && !draft.id) {
      markers.push({
        id: "draft",
        position: draft.position,
        radiation: draft.radiation?.position ?? null,
        selected: true,
        number: markers.length + 1,
      });
    } else if (draft?.id && draft.radiation) {
      const marker = markers.find((item) => item.id === draft.id);
      if (marker) marker.radiation = draft.radiation.position;
    }
    return markers;
  }, [entries, draft]);

  const openDraft = (result: TapResult) => {
    setDraft(draftFromTap(result));
    setPanel("pin");
    setRadiationArmed(false);
    setStatus(null);
  };

  const onTap = (result: TapResult) => {
    if (!canPlacePin(safety)) {
      setPendingTap(result);
      setSafetyOpen(true);
      return;
    }
    openDraft(result);
  };

  const onSafetyChange = (next: SafetyState) => {
    const wasBlocked = !canPlacePin(safety);
    setSafety(next);
    if (wasBlocked && next.phase === "clear" && pendingTap) {
      openDraft(pendingTap);
      setPendingTap(null);
      setSafetyOpen(false);
    }
    if (next.phase === "acknowledged") {
      setPendingTap(null);
      setSafetyOpen(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (storage === "pending") {
      setStatus("Still opening your notes. Try save again in a moment.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const existing = draft.id ? entries.find((entry) => entry.id === draft.id) : undefined;
      if (storage === "phone") {
        const saved = saveLocalEntry(localStorage, draft, existing);
        setEntries((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
        setDraft(draftFromEntry(saved));
        setStatus(`Saved on this device at ${formatCentralTime(new Date(saved.createdAt))}.`);
        return;
      }
      const response = await fetch(draft.id ? publicUrl(`api/entries/${draft.id}`) : publicUrl("api/entries"), {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          id: draft.id ?? crypto.randomUUID(),
          createdAt: existing?.createdAt,
        }),
      });
      if (!response.ok) throw new Error("The note could not be saved.");
      const saved = (await response.json()) as PainEntry;
      setEntries((current) => {
        const rest = current.filter((entry) => entry.id !== saved.id);
        return [...rest, saved];
      });
      setDraft(draftFromEntry(saved));
      setStatus(`Saved at ${formatCentralTime(new Date(saved.createdAt))}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async () => {
    if (!draft?.id) {
      setDraft(null);
      return;
    }
    if (storage === "phone") {
      try {
        deleteLocalEntry(localStorage, draft.id);
      } catch {
        setStatus("That note could not be deleted.");
        return;
      }
      setEntries((current) => current.filter((entry) => entry.id !== draft.id));
      setDraft(null);
      setPanel("history");
      return;
    }
    const response = await fetch(publicUrl(`api/entries/${draft.id}`), { method: "DELETE" });
    if (!response.ok) {
      setStatus("That note could not be deleted.");
      return;
    }
    setEntries((current) => current.filter((entry) => entry.id !== draft.id));
    setDraft(null);
    setPanel("history");
  };

  const exportPdf = async () => {
    setStatus("Building the PDF…");
    try {
      const bytes = buildPainPdf(
        [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        {
          front: viewportRef.current?.capture("front"),
          back: viewportRef.current?.capture("back"),
          side: viewportRef.current?.capture("side"),
        },
        new Date(),
      );
      const filename = `pain-record-${formatCentralTime(new Date()).replace(/[: ]/g, "-")}.pdf`;
      const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      if (storage !== "computer") {
        setStatus(storage === "phone" ? "The PDF was downloaded to this device." : "The PDF was downloaded.");
        return;
      }
      const saved = await fetch(publicUrl("api/exports"), {
        method: "POST",
        headers: { "Content-Type": "application/pdf", "X-Filename": filename },
        body: blob,
      });
      if (!saved.ok) throw new Error("The PDF downloaded, but a copy could not be written into your notes folder.");
      const info = (await saved.json()) as { path: string };
      setStatus(`PDF saved in your notes folder: ${info.path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The PDF could not be made.");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#efe6d6] text-stone-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 bg-[#143f3c] px-4 py-3 text-stone-50">
        <div>
          <p className="font-serif text-xl leading-none">Pain Locator</p>
          <p className="mt-1 text-xs text-stone-200">Mark where it hurts. Hand the summary to your doctor.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAboutOpen(true)}>
            About
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportPdf()} disabled={!modelReady}>
            Export PDF
          </Button>
        </div>
      </header>

      {safety.phase === "acknowledged" && (
        <div className="bg-red-800 px-4 py-2 text-sm text-white">
          You checked an emergency warning sign. If that is happening now, call 911. This page will still let you write a note after you acknowledged that message.
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="order-2 border-stone-300 bg-[#f6f1e6] p-4 lg:order-1 lg:border-r lg:overflow-y-auto">
          <div className="mb-3 lg:hidden">
            <Button size="sm" variant="outline" onClick={() => setLayersOpen((open) => !open)}>
              {layersOpen ? "Hide layers" : "Show layers"}
            </Button>
          </div>
          <div className={layersOpen ? "block" : "hidden lg:block"}>
            <LayerPanel layers={layers} onChange={setLayers} />
          </div>
        </aside>

        <main className="relative order-1 min-h-[58vh] lg:order-2 lg:min-h-0">
          <Viewport
            ref={viewportRef}
            catalog={catalog}
            layers={layers}
            pins={pins}
            radiationArmed={radiationArmed}
            onTap={onTap}
            onPinSelect={(id) => {
              if (id === "draft") return;
              const entry = entries.find((item) => item.id === id);
              if (!entry) return;
              setDraft(draftFromEntry(entry));
              setPanel("pin");
            }}
            onRadiation={(result) => {
              if (!draft) return;
              setDraft({
                ...draft,
                radiation: { position: result.position, structure: toStored(result.structure) },
              });
              setRadiationArmed(false);
            }}
            onViewChange={(title, detail) => {
              setViewTitle(title);
              setViewDetail(detail);
            }}
            onReady={() => setModelReady(true)}
            onError={(message) => setLoadError(message)}
          />
          <div className="pointer-events-none absolute left-3 top-3 max-w-[240px] rounded-md bg-stone-950/80 px-3 py-2 text-stone-50">
            <p className="text-sm font-semibold">{viewTitle}</p>
            <p className="mt-1 text-xs leading-relaxed">{viewDetail}</p>
          </div>
          {!modelReady && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#efe6d6]/80 text-sm">
              Loading the body model…
            </div>
          )}
          {loadError && (
            <div className="absolute inset-x-4 bottom-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">{loadError}</div>
          )}
        </main>

        <aside className="order-3 border-stone-300 bg-[#f6f1e6] lg:border-l">
          <div className="flex gap-2 border-b border-stone-300 p-3">
            <Button size="sm" variant={panel === "pin" ? "default" : "outline"} onClick={() => setPanel("pin")}>
              This pin
            </Button>
            <Button size="sm" variant={panel === "history" ? "default" : "outline"} onClick={() => setPanel("history")}>
              History
            </Button>
          </div>
          <ScrollArea className="h-[48vh] lg:h-[calc(100dvh-150px)]">
            <div className="space-y-3 p-4">
              {status && <p className="rounded-md bg-white px-3 py-2 text-sm text-stone-800">{status}</p>}
              {panel === "pin" && draft ? (
                <PinForm
                  draft={draft}
                  radiationArmed={radiationArmed}
                  saving={saving}
                  onChange={(update) => setDraft((current) => (current ? update(current) : current))}
                  onArmRadiation={() => setRadiationArmed(true)}
                  onClearRadiation={() => setDraft({ ...draft, radiation: null })}
                  onSave={() => void saveDraft()}
                  onDelete={() => void deleteDraft()}
                  onClose={() => {
                    setDraft(null);
                    setRadiationArmed(false);
                    setPanel("history");
                  }}
                />
              ) : panel === "pin" ? (
                <p className="text-sm leading-relaxed text-stone-600">
                  Drag to turn the body. Scroll or pinch to zoom. Tap the spot that hurts. The name comes from the exact part your tap hits, not from a guess about the coordinates.
                </p>
              ) : (
                <HistoryPanel
                  entries={entries}
                  selectedId={draft?.id ?? null}
                  onSelect={(id) => {
                    const entry = entries.find((item) => item.id === id);
                    if (!entry) return;
                    setDraft(draftFromEntry(entry));
                    setPanel("pin");
                  }}
                />
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>

      <footer className="border-t border-stone-300 bg-stone-100 px-4 py-2 text-center text-xs font-semibold text-stone-700">
        Documentation tool only. Not a medical device. Does not diagnose.
      </footer>

      <SafetyGate
        state={safety}
        open={safetyOpen}
        onChange={onSafetyChange}
        onLookFirst={() => setSafetyOpen(false)}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} catalog={catalog} dataDir={dataDir} onPhone={storage === "phone"} />
    </div>
  );
}
