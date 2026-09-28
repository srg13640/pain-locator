#!/usr/bin/env python3
"""Reduce meshes that the first pass left too heavy, without re-reading the FBX files.

The first export used a cautious setting that stopped before it reached the
triangle cap. This pass finishes that reduction and rebuilds the tap probes
against the lighter meshes.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from prepare_anatomy import FACE_CAP, depth_probe, landmark_probe, simplify  # noqa: E402

OUT = ROOT / "public" / "anatomy"


def main() -> None:
    catalog = json.loads((OUT / "catalog.json").read_text())
    by_id = {item["id"]: item for item in catalog["structures"]}
    loaded: dict[str, trimesh.Trimesh] = {}

    for layer in ("skeleton", "muscle", "organ", "skin"):
        scene = trimesh.load(OUT / f"{layer}.glb", force="scene")
        rebuilt = trimesh.Scene()
        for name, geom in scene.geometry.items():
            if name not in by_id:
                raise SystemExit(f"GLB mesh {name} is not in the catalog")
            mesh = geom.copy()
            mesh, reduced = simplify(mesh, FACE_CAP[layer])
            record = by_id[name]
            record["faces"] = int(len(mesh.faces))
            record["simplified"] = bool(reduced or record["faces"] < record["originalFaces"])
            rebuilt.add_geometry(mesh, geom_name=name)
            loaded[name] = mesh
        target = OUT / f"{layer}.glb"
        rebuilt.export(target)
        print(f"Wrote {target.name} ({target.stat().st_size / 1e6:.1f} MB)", flush=True)

    missing = [item["id"] for item in catalog["structures"] if item["id"] not in loaded]
    if missing:
        raise SystemExit(f"Missing meshes: {missing[:8]}")

    structures = []
    for item in catalog["structures"]:
        packed = dict(item)
        packed["mesh"] = loaded[item["id"]]
        structures.append(packed)

    sternum = next(item for item in structures if item["id"] == "skeleton-body-of-sternum")
    left_rib = next(item for item in structures if item["id"] == "skeleton-fourth-rib-l")
    right_scapula = next(item for item in structures if item["id"] == "skeleton-scapula-r")
    probes = [
        landmark_probe(structures, sternum["id"], np.array([0.0, 0.0, 1.0])),
        landmark_probe(structures, left_rib["id"], np.array([1.0, 0.0, 0.35])),
        landmark_probe(structures, right_scapula["id"], np.array([-0.25, 0.05, -1.0])),
    ]
    depth = [depth_probe(structures, probe) for probe in probes]

    simplified = [item for item in structures if item["simplified"]]
    original_faces = sum(item["originalFaces"] for item in structures)
    final_faces = sum(item["faces"] for item in structures)
    over = [
        item["medicalName"]
        for item in structures
        if item["faces"] > int(FACE_CAP[item["layer"]] * 1.05)
    ]
    if over:
        raise SystemExit(f"Still over the cap: {over[:8]}")

    catalog["simplification"] = {
        "structuresSimplified": len(simplified),
        "structureCount": len(structures),
        "originalFaces": original_faces,
        "finalFaces": final_faces,
        "note": (
            "Z-Anatomy already uses reduced BodyParts3D meshes. "
            f"{len(simplified)} structures that were still heavier than the smooth-rotation cap "
            "were simplified again with quadric decimation, which keeps the overall shape and the original name. "
            f"Triangle count went from {original_faces:,} to {final_faces:,}."
        ),
    }
    catalog["structures"] = [{key: value for key, value in item.items() if key != "mesh"} for item in structures]
    catalog["probes"] = probes
    catalog["depthProbes"] = depth
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=2))
    print(f"Triangles {original_faces:,} -> {final_faces:,}  simplified {len(simplified)}")
    for probe in probes:
        print("probe", probe["expectMedical"], probe["expectFma"])


if __name__ == "__main__":
    main()
