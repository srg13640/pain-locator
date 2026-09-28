import { readFileSync } from "node:fs";
import path from "node:path";
import { DoubleSide, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { assignStructureNames, hitsAlongRay } from "../src/anatomy/pick";
import type { Catalog, StructureRecord } from "../src/lib/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const anatomy = path.join(ROOT, "public", "anatomy");

async function loadLayer(file: string, ids: Set<string>): Promise<Mesh[]> {
  const loader = new GLTFLoader();
  const bytes = readFileSync(path.join(anatomy, file));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const meshes = assignStructureNames(gltf.scene, ids);
  for (const mesh of meshes) {
    mesh.material = new MeshStandardMaterial({ side: DoubleSide });
  }
  gltf.scene.updateMatrixWorld(true);
  return meshes;
}

describe("pin labeling from the real meshes", () => {
  it("names a tap on the sternum, the left fourth rib, and the right scapula from those meshes", async () => {
    const catalog = JSON.parse(readFileSync(path.join(anatomy, "catalog.json"), "utf8")) as Catalog;
    const ids = new Set(catalog.structures.map((item) => item.id));
    const byId = new Map(catalog.structures.map((item) => [item.id, item]));
    const skeleton = await loadLayer("skeleton.glb", ids);
    expect(skeleton.length).toBeGreaterThan(10);

    for (const probe of catalog.probes) {
      const hits = hitsAlongRay(
        skeleton,
        new Vector3(...probe.origin),
        new Vector3(...probe.direction),
      );
      const record = byId.get(hits[0]?.id ?? "") as StructureRecord | undefined;
      expect(hits[0]?.id, probe.expectMedical).toBe(probe.id);
      expect(record?.medicalName).toBe(probe.expectMedical);
      expect(probe.expectFma).toBeTruthy();
      expect(record?.fma).toBe(probe.expectFma);
      expect(record?.plain.toLowerCase()).toContain(probe.expectPlainIncludes);
      expect(record?.sourceName.length).toBeGreaterThan(0);
    }
  });

  it("lists the bone under the skin, from the surface inward", async () => {
    const catalog = JSON.parse(readFileSync(path.join(anatomy, "catalog.json"), "utf8")) as Catalog;
    const ids = new Set(catalog.structures.map((item) => item.id));
    const byId = new Map(catalog.structures.map((item) => [item.id, item]));
    const meshes = (
      await Promise.all(["skin.glb", "skeleton.glb", "muscle.glb", "organ.glb"].map((file) => loadLayer(file, ids)))
    ).flat();

    for (const probe of catalog.depthProbes) {
      const hits = hitsAlongRay(meshes, new Vector3(...probe.origin), new Vector3(...probe.direction));
      expect(hits.length).toBeGreaterThan(1);
      expect(byId.get(hits[0].id)?.layer).toBe(probe.expectFirstLayer);
      const landmark = hits.find((hit) => hit.id === probe.expectIncludesId);
      expect(landmark, probe.expectIncludesId).toBeTruthy();
      const distances = hits.map((hit) => hit.distance);
      const sorted = [...distances].sort((a, b) => a - b);
      expect(distances).toEqual(sorted);
      expect(hits[0].distance).toBeLessThan(landmark?.distance ?? 0);
    }
  });
});
