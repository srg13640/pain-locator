#!/usr/bin/env python3
"""Build the woman's outer body from the Human Reference Atlas female skin.

The source mesh is VH_F_Skin.glb from the HuBMAP CCF 3D reference library
(v1.2), derived from the Visible Human Female and released CC BY 4.0.
This script lines that surface up with the Z-Anatomy skin already in the app
(centimeters, head and feet, front of the breastbone, patient's left on +X)
and splits it into the same named skin regions, so a tap still reports the
atlas name for that place.

The bones, muscles, and organs are not rebuilt here. They stay the atlas
models, which this alignment puts behind the woman's skin.
"""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
MALE_SKIN = ROOT / "public" / "anatomy" / "skin.glb"
OUT = ROOT / "public" / "anatomy" / "skin-female.glb"
TARGET_FACES = 80_000


def load_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise SystemExit(f"{path} is not a glb file")
    offset = 12
    length, chunk_type = struct.unpack_from("<I4s", data, offset)
    if chunk_type != b"JSON":
        raise SystemExit(f"{path} has no JSON chunk")
    gltf = json.loads(data[offset + 8 : offset + 8 + length])
    bin_at = offset + 8 + length
    if bin_at % 4:
        bin_at += 4 - (bin_at % 4)
    bin_length, bin_type = struct.unpack_from("<I4s", data, bin_at)
    if bin_type != b"BIN\x00":
        raise SystemExit(f"{path} has no binary chunk")
    return gltf, data[bin_at + 8 : bin_at + 8 + bin_length]


def read_accessor(gltf: dict, blob: bytes, index: int) -> np.ndarray:
    accessor = gltf["accessors"][index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    dtype = {5123: np.uint16, 5125: np.uint32, 5126: np.float32}[accessor["componentType"]]
    count = accessor["count"]
    values = np.frombuffer(blob, dtype=dtype, count=count * components, offset=start)
    return values.reshape(count, components).copy()


def male_cloud() -> tuple[np.ndarray, np.ndarray, dict[str, float]]:
    gltf, blob = load_glb(MALE_SKIN)
    points: list[np.ndarray] = []
    labels: list[np.ndarray] = []
    names: list[str] = []
    for mesh in gltf["meshes"]:
        name = mesh.get("name")
        if not name or not name.startswith("skin-"):
            continue
        if name not in names:
            names.append(name)
        label = names.index(name)
        primitive = mesh["primitives"][0]
        position = read_accessor(gltf, blob, primitive["attributes"]["POSITION"]).astype(np.float64)
        points.append(position)
        labels.append(np.full(len(position), label, dtype=np.int32))
    cloud = np.vstack(points)
    label_ids = np.concatenate(labels)
    presternal = []
    for mesh in gltf["meshes"]:
        if mesh.get("name") not in ("skin-presternal-region-l", "skin-presternal-region-r"):
            continue
        position = read_accessor(gltf, blob, mesh["primitives"][0]["attributes"]["POSITION"]).astype(np.float64)
        presternal.append(position)
    front = np.vstack(presternal)
    marks = {
        "min_y": float(cloud[:, 1].min()),
        "max_y": float(cloud[:, 1].max()),
        "mid_x": float((cloud[:, 0].min() + cloud[:, 0].max()) / 2),
        "sternum_y": float(front[:, 1].mean()),
        "sternum_z": float(np.percentile(front[:, 2], 98)),
    }
    return cloud, np.array(names, dtype=object)[label_ids], marks


def female_surface(path: Path) -> tuple[np.ndarray, np.ndarray]:
    gltf, blob = load_glb(path)
    mesh = gltf["meshes"][0]
    primitive = mesh["primitives"][0]
    vertices = read_accessor(gltf, blob, primitive["attributes"]["POSITION"]).astype(np.float64)
    faces = read_accessor(gltf, blob, primitive["indices"]).reshape(-1, 3).astype(np.int32)
    reduced = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    for aggressiveness in (7.0, 9.0, 11.0):
        points, triangles = fast_simplification.simplify(
            np.asarray(reduced.vertices, dtype=np.float64),
            np.asarray(reduced.faces, dtype=np.int32),
            target_count=TARGET_FACES,
            agg=aggressiveness,
        )
        reduced = trimesh.Trimesh(vertices=points, faces=triangles, process=False)
        reduced.update_faces(reduced.nondegenerate_faces())
        reduced.remove_unreferenced_vertices()
        if len(reduced.faces) <= TARGET_FACES * 1.05:
            break
    return np.asarray(reduced.vertices, dtype=np.float64), np.asarray(reduced.faces, dtype=np.int32)


def align(vertices: np.ndarray, marks: dict[str, float]) -> np.ndarray:
    placed = vertices.copy()
    height = float(placed[:, 1].max() - placed[:, 1].min())
    scale = (marks["max_y"] - marks["min_y"]) / height
    placed *= scale
    placed[:, 1] += marks["min_y"] - float(placed[:, 1].min())
    placed[:, 0] += marks["mid_x"] - float((placed[:, 0].min() + placed[:, 0].max()) / 2)
    band = placed[
        (np.abs(placed[:, 0]) < 2.5)
        & (np.abs(placed[:, 1] - marks["sternum_y"]) < 8.0)
    ]
    if len(band) < 20:
        raise SystemExit("Could not find the front of the breastbone on the woman's skin.")
    placed[:, 2] += marks["sternum_z"] - float(np.percentile(band[:, 2], 98))
    return placed


def region_names(vertices: np.ndarray, faces: np.ndarray, male_points: np.ndarray, male_names: np.ndarray) -> np.ndarray:
    tree = cKDTree(male_points)
    _distance, index = tree.query(vertices, k=1)
    vertex_names = male_names[index]
    # One pass of neighbor voting keeps a breast tap from landing on a speck of another region.
    neighbors: list[list[int]] = [[] for _ in range(len(vertices))]
    for a, b, c in faces:
        neighbors[int(a)].extend((int(b), int(c)))
        neighbors[int(b)].extend((int(a), int(c)))
        neighbors[int(c)].extend((int(a), int(b)))
    adjacent = [np.unique(np.asarray(item, dtype=np.int32)) if item else np.empty(0, dtype=np.int32) for item in neighbors]
    for _ in range(2):
        updated = vertex_names.copy()
        for vertex, nearby in enumerate(adjacent):
            if len(nearby) == 0:
                continue
            sample = vertex_names[np.concatenate(([vertex], nearby))]
            values, counts = np.unique(sample, return_counts=True)
            updated[vertex] = values[counts.argmax()]
        vertex_names = updated
    return vertex_names


def write_regions(vertices: np.ndarray, faces: np.ndarray, vertex_names: np.ndarray, path: Path) -> None:
    scene = trimesh.Scene()
    corner_a = vertex_names[faces[:, 0]]
    corner_b = vertex_names[faces[:, 1]]
    corner_c = vertex_names[faces[:, 2]]
    # Two corners that agree name the triangle. If all three differ, keep the first.
    face_names = corner_a.copy()
    pair = (corner_b == corner_c) & (corner_a != corner_b)
    face_names[pair] = corner_b[pair]
    for name in sorted(set(face_names.tolist())):
        chosen = faces[face_names == name]
        if len(chosen) == 0:
            continue
        used = np.unique(chosen)
        remap = np.full(len(vertices), -1, dtype=np.int32)
        remap[used] = np.arange(len(used))
        mesh = trimesh.Trimesh(vertices=vertices[used], faces=remap[chosen], process=False)
        mesh.remove_unreferenced_vertices()
        scene.add_geometry(mesh, geom_name=name, node_name=name)
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.export(path)


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/VH_F_Skin.glb")
    if not source.exists():
        raise SystemExit(f"Missing {source}. Download VH_F_Skin.glb from the HuBMAP CCF v1.2 models.")
    male_points, male_names, marks = male_cloud()
    vertices, faces = female_surface(source)
    placed = align(vertices, marks)
    names = region_names(placed, faces, male_points, male_names)
    write_regions(placed, faces, names, OUT)

    left_chest = (placed[:, 0] > 6) & (placed[:, 0] < 16) & (placed[:, 1] > -6) & (placed[:, 1] < 8)
    chest_points = placed[left_chest]
    chest_names = names[left_chest]
    if len(chest_points):
        front = chest_points[:, 2] > np.percentile(chest_points[:, 2], 90)
        values, counts = np.unique(chest_names[front], return_counts=True)
        order = counts.argsort()[::-1][:4]
        print("left chest front labels:")
        for item in order:
            print(f"  {values[item]} {counts[item]}")
        print(f"left chest front z {chest_points[front, 2].max():.1f}  sternum target z {marks['sternum_z']:.1f}")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes), faces {len(faces)}, regions {len(set(names.tolist()))}")


if __name__ == "__main__":
    main()
