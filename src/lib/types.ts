export const QUALITIES = [
  "sharp",
  "stabbing",
  "dull",
  "aching",
  "burning",
  "pressure",
  "squeezing",
  "tearing",
] as const;

export type PainQuality = (typeof QUALITIES)[number];

export const TRIGGERS = [
  "breathing in",
  "pressing on it",
  "twisting",
  "lying down",
  "eating",
  "exertion",
  "rest",
] as const;

export type PainTrigger = (typeof TRIGGERS)[number];

export type StructureRecord = {
  id: string;
  sourceName: string;
  medicalName: string;
  plain: string;
  fma: string | null;
  layer: "skin" | "skeleton" | "muscle" | "organ";
  side: "left" | "right" | "midline";
  swatch: string;
  file: string;
  originalFaces: number;
  faces: number;
  simplified: boolean;
};

export type Catalog = {
  coordinateSpace: {
    units: string;
    up: string;
    patientLeft: string;
    anterior: string;
    centeredOn: string;
  };
  simplification: {
    structuresSimplified: number;
    structureCount: number;
    originalFaces: number;
    finalFaces: number;
    note: string;
  };
  omitted: string[];
  structures: StructureRecord[];
  probes: LandmarkProbe[];
  depthProbes: DepthProbe[];
};

export type LandmarkProbe = {
  id: string;
  origin: [number, number, number];
  direction: [number, number, number];
  expectMedical: string;
  expectFma: string | null;
  expectPlainIncludes: string;
};

export type DepthProbe = {
  id: string;
  origin: [number, number, number];
  direction: [number, number, number];
  expectFirstLayer: string;
  expectIncludesId: string;
  surfaceToDeep: string[];
};

export type StoredStructure = {
  structureId: string;
  medicalName: string;
  plain: string;
  fma: string | null;
  layer: StructureRecord["layer"];
  side: StructureRecord["side"];
  sourceName: string;
};

export type PainEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  position: [number, number, number];
  structure: StoredStructure;
  beneath: StoredStructure[];
  quality: PainQuality | null;
  severity: number;
  radiation: {
    position: [number, number, number];
    structure: StoredStructure | null;
  } | null;
  triggers: PainTrigger[];
  onset: string;
  duration: string;
  notes: string;
};

export type LayerId = StructureRecord["layer"];

export type LayerSetting = {
  id: LayerId;
  label: string;
  detail: string;
  visible: boolean;
  opacity: number;
};

export const DEFAULT_LAYERS: LayerSetting[] = [
  {
    id: "skin",
    label: "Skin",
    detail: "The outside surface, divided into named regions.",
    visible: true,
    opacity: 0.42,
  },
  {
    id: "skeleton",
    label: "Skeleton",
    detail: "Bones, including the rib cartilages in a cooler color.",
    visible: true,
    opacity: 1,
  },
  {
    id: "muscle",
    label: "Muscles",
    detail: "Chest, shoulder, back, and belly muscles.",
    visible: true,
    opacity: 0.72,
  },
  {
    id: "organ",
    label: "Organs",
    detail: "Heart, lungs, esophagus, stomach, liver, gallbladder, pancreas, and the large vessels.",
    visible: true,
    opacity: 0.9,
  },
];

export function toStored(structure: StructureRecord): StoredStructure {
  return {
    structureId: structure.id,
    medicalName: structure.medicalName,
    plain: structure.plain,
    fma: structure.fma,
    layer: structure.layer,
    side: structure.side,
    sourceName: structure.sourceName,
  };
}
