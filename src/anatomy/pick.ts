import { Mesh, Object3D, Raycaster, Vector3 } from "three";

export type RayHit = {
  id: string;
  distance: number;
  point: [number, number, number];
};

/** Names loaded meshes with the catalog id baked into the file. */
export function assignStructureNames(root: Object3D, ids: Set<string>): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const named = [obj.name, obj.parent?.name ?? ""].find((name) => ids.has(name));
    if (!named) return;
    obj.name = named;
    meshes.push(obj);
  });
  return meshes;
}

/**
 * Structures a straight line passes through, nearest first.
 * The line is the same idea as a fingertip tap on the model.
 */
export function hitsAlongRay(meshes: Mesh[], origin: Vector3, direction: Vector3): RayHit[] {
  const raycaster = new Raycaster(origin.clone(), direction.clone().normalize());
  const seen = new Set<string>();
  const ordered: RayHit[] = [];
  for (const hit of raycaster.intersectObjects(meshes, false)) {
    const id = hit.object.name;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push({
      id,
      distance: hit.distance,
      point: [hit.point.x, hit.point.y, hit.point.z],
    });
  }
  return ordered;
}

/**
 * Keep the surface that was tapped, then the parts behind it, and stop at the
 * skin on the far side of the body. A straight tap would otherwise continue
 * out through the back and list that outside skin as if it were deep.
 */
export function stackFromSurface(hits: RayHit[], layerOf: (id: string) => string): RayHit[] {
  if (hits.length === 0) return [];
  const surface = hits[0].distance;
  const kept: RayHit[] = [hits[0]];
  for (const hit of hits.slice(1)) {
    const depth = hit.distance - surface;
    if (layerOf(hit.id) === "skin") {
      if (depth > 3) break;
      continue;
    }
    kept.push(hit);
    if (kept.length >= 8) break;
  }
  return kept;
}
