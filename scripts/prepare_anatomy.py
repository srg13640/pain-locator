#!/usr/bin/env python3
"""Turn Z-Anatomy meshes into the files the pain locator shows.

Z-Anatomy is a 3D atlas derived from BodyParts3D (CT-based anatomy).
This script keeps only the chest, shoulder, and upper-belly structures,
reduces polygon count where a mesh is too heavy to turn smoothly, and
writes one GLB file per layer plus a catalog of real names and FMA ids.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import fast_simplification
import numpy as np
import pyassimp
import trimesh
from pyassimp.postprocess import aiProcess_Triangulate

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "anatomy"
FMA_DIR = Path("/tmp/bp3d")
SOURCES = {
    "skeleton": Path("/tmp/zanat/SkeletalSystem100.fbx"),
    "muscle": Path("/tmp/zanat/MuscularSystem100.fbx"),
    "visceral": Path("/tmp/zanat/VisceralSystem100.fbx"),
    "cardio": Path("/tmp/zanat/CardioVascular41.fbx"),
    "skin": Path("/tmp/zanat/Regions.fbx"),
}

ORDINALS = [
    "",
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "eleventh",
    "twelfth",
]
RIB_WORD = "|".join(ORDINALS[1:])
LIVER_SIDE = {
    "i": "midline",
    "ii": "left",
    "iii": "left",
    "iv": "left",
    "v": "right",
    "vi": "right",
    "vii": "right",
    "viii": "right",
}
MUSCLE_BASES = {
    "external intercostal muscles",
    "internal intercostal muscles",
    "innermost intercostal muscles",
    "transversus abdominis muscle",
    "diaphragm",
    "serratus anterior muscle",
    "latissimus dorsi muscle",
    "rectus abdominis muscle",
    "descending part of trapezius muscle",
    "rhomboid major muscle",
    "ascending part of trapezius muscle",
    "scapular spinal part of deltoid muscle",
    "pectoralis minor muscle",
    "sternocostal head of pectoralis major muscle",
    "transverse part of trapezius muscle",
    "acromial part of deltoid muscle",
    "clavicular part of deltoid muscle",
    "abdominal part of pectoralis major muscle",
    "rhomboid minor muscle",
    "clavicular head of pectoralis major muscle",
    "external abdominal oblique muscle",
    "internal abdominal oblique muscle",
    "subclavius muscle",
}
FACE_CAP = {"skin": 1200, "skeleton": 1800, "muscle": 1800, "organ": 2000}
SMALL_WORDS = {"of", "the", "and", "in", "on", "a"}


def load_fma_table() -> dict[str, str]:
    table: dict[str, str] = {}
    for name in ("isa_parts_list_e.txt", "partof_parts_list_e.txt"):
        path = FMA_DIR / name
        with path.open(encoding="utf-8") as handle:
            handle.readline()
            for line in handle:
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 3:
                    continue
                table[parts[2].strip().lower()] = parts[0].strip()
    return table


def split_side(node_name: str) -> tuple[str, str]:
    raw = node_name.strip()
    side = "midline"
    if raw.endswith(".l"):
        side = "left"
        raw = raw[:-2]
    elif raw.endswith(".r"):
        side = "right"
        raw = raw[:-2]
    raw = raw.strip()
    if raw.startswith("(") and raw.endswith(")"):
        raw = raw[1:-1].strip()
    low = raw.lower()
    if low.startswith("left "):
        side = "left"
    elif low.startswith("right "):
        side = "right"
    elif re.search(r"\bleft\b", low):
        side = "left"
    elif re.search(r"\bright\b", low):
        side = "right"
    liver = re.search(r"\(([ivx]+)\)\s*$", low)
    if liver and side == "midline":
        side = LIVER_SIDE.get(liver.group(1), "midline")
    return side, raw


def smart_title(text: str) -> str:
    words = text.split(" ")
    titled: list[str] = []
    for index, word in enumerate(words):
        lower = word.lower()
        if re.fullmatch(r"[ctl]\d+", lower):
            titled.append(word.upper())
        elif index > 0 and lower in SMALL_WORDS:
            titled.append(lower)
        elif word.startswith("("):
            titled.append(word.upper() if re.fullmatch(r"\([ivx]+\)", lower) else word[:1].upper() + word[1:])
        else:
            titled.append(word[:1].upper() + word[1:] if word else word)
    return " ".join(titled)


def medical_name(side: str, raw: str) -> str:
    low = raw.lower()
    titled = smart_title(raw)
    if "left" in low or "right" in low:
        return titled
    if side in ("left", "right"):
        return f"{side.capitalize()} {titled}"
    return titled


def fma_for(table: dict[str, str], side: str, raw: str, medical: str) -> str | None:
    low = raw.lower()
    keys = [medical.lower(), low]
    rib = re.fullmatch(rf"({RIB_WORD}) rib", low)
    if rib:
        keys.append(f"{side} {rib.group(1)} rib")
    cartilage = re.fullmatch(rf"costal cartilage of ({RIB_WORD}) rib", low)
    if cartilage:
        keys.append(f"{side} {cartilage.group(1)} costal cartilage")
    if low in {"scapula", "clavicle", "humerus"}:
        keys.append(f"{side} {low}")
    if low == "manubrium of sternum":
        keys.append("manubrium")
    vertebra = re.fullmatch(r"vertebra ([ctl])(\d+)", low)
    if vertebra:
        number = int(vertebra.group(2))
        if number < len(ORDINALS):
            kind = {"c": "cervical", "t": "thoracic", "l": "lumbar"}[vertebra.group(1)]
            keys.append(f"{ORDINALS[number]} {kind} vertebra")
    for suffix in (" muscles", " muscle"):
        if low.endswith(suffix):
            stem = low[: -len(suffix)]
            keys.append(stem)
            if side in ("left", "right"):
                keys.append(f"{side} {stem}")
                if " part of " in stem:
                    head, tail = stem.rsplit(" part of ", 1)
                    keys.append(f"{head} part of {side} {tail}")
    replacements = {
        "sternocostal head of pectoralis major muscle": "sternocostal part of pectoralis major",
        "clavicular head of pectoralis major muscle": "clavicular part of pectoralis major",
        "abdominal part of pectoralis major muscle": "abdominal part of pectoralis major",
        "scapular spinal part of deltoid muscle": "spinal part of deltoid",
        "external abdominal oblique muscle": "external oblique",
        "internal abdominal oblique muscle": "internal abdominal oblique",
        "superior lobe of left lung": "upper lobe of left lung",
        "superior lobe of right lung": "upper lobe of right lung",
        "inferior lobe of left lung": "lower lobe of left lung",
        "inferior lobe of right lung": "lower lobe of right lung",
        "middle lobe of right lung": "middle lobe of lung",
        "oesophagus": "esophagus",
        "ascending aorta": "ascending aorta",
        "thoracic aorta": "descending thoracic aorta",
        "abdominal aorta": "abdominal aorta",
        "superior vena cava": "superior vena cava",
        "inferior vena cava (thoracic part)": "inferior vena cava",
        "inferior vena cava (abdominal part)": "inferior vena cava",
        "right atrium": "wall of right atrium",
        "left atrium": "wall of left atrium",
    }
    if low in replacements:
        keys.append(replacements[low])
        if side in ("left", "right"):
            keys.append(f"{side} {replacements[low]}")
    if "pectoralis major" in low and side in ("left", "right"):
        if "sternocostal" in low:
            keys.append(f"sternocostal part of {side} pectoralis major")
        if "clavicular" in low:
            keys.append(f"clavicular part of {side} pectoralis major")
        if "abdominal part" in low:
            keys.append(f"abdominal part of {side} pectoralis major")
    if low == "pectoralis minor muscle" and side in ("left", "right"):
        keys.append(f"{side} pectoralis minor")
    if "trapezius" in low and side in ("left", "right"):
        part = low.replace(" muscle", "")
        keys.append(f"{part.replace('part of trapezius', 'part of ' + side + ' trapezius')}")
        keys.append(part.replace(" of trapezius muscle", f" of {side} trapezius").replace(" muscle", ""))
    for key in keys:
        hit = table.get(key)
        if hit:
            return hit
    return None


def side_phrase(side: str) -> str:
    if side == "left":
        return "on the patient's left"
    if side == "right":
        return "on the patient's right"
    return "along the midline"


def plain_english(side: str, raw: str, layer: str) -> str:
    low = raw.lower()
    where = side_phrase(side)
    rib = re.fullmatch(rf"({RIB_WORD}) rib", low)
    if rib:
        return (
            f"The {rib.group(1)} rib {where}, counting down from the top of the rib cage."
        )
    cartilage = re.fullmatch(rf"costal cartilage of ({RIB_WORD}) rib", low)
    if cartilage:
        return (
            f"The flexible cartilage connecting the {cartilage.group(1)} rib {where} to the breastbone."
        )
    fixed = {
        "body of sternum": "The long middle part of the breastbone, where many ribs attach.",
        "manubrium of sternum": "The upper part of the breastbone, just below the notch at the base of the neck.",
        "xiphoid process": "The small tip at the bottom of the breastbone.",
        "scapula": f"The shoulder blade {where}.",
        "clavicle": f"The collarbone {where}.",
        "humerus": f"The long bone of the upper arm {where}.",
        "diaphragm": "The dome-shaped muscle under the lungs that helps you breathe.",
        "oesophagus": "The tube that carries food from the throat to the stomach.",
        "esophagus": "The tube that carries food from the throat to the stomach.",
        "stomach": "The organ that holds food after you swallow. It sits in the upper belly, mostly on the patient's left.",
        "pancreas": "A gland behind the stomach. This label only names that gland. It is not a diagnosis.",
        "gallbladder": "The small sac tucked under the liver that stores bile, the fluid used to digest fat.",
        "trachea": "The windpipe. Air travels through it in the front of the neck and upper chest.",
        "right atrium": "The upper chamber on the right side of the heart. It receives blood coming back from the body.",
        "left atrium": "The upper chamber on the left side of the heart. It receives blood coming back from the lungs.",
        "right ventricle": "The lower chamber on the right side of the heart. It pumps blood toward the lungs.",
        "left ventricle": "The thick lower chamber on the left side of the heart. It pumps blood out to the body.",
        "ascending aorta": "The large artery that leaves the heart and curves upward, carrying blood to the body.",
        "thoracic aorta": "The large artery running down through the chest, behind the heart.",
        "abdominal aorta": "The large artery continuing down through the upper belly.",
        "pulmonary trunk": "The short, wide artery that carries blood from the heart toward the lungs.",
        "superior vena cava": "The large vein that brings blood from the head and arms back to the heart.",
        "inferior vena cava (thoracic part)": "The large vein that brings blood from the lower body back to the heart, where it passes through the chest.",
        "inferior vena cava (abdominal part)": "The large vein that brings blood from the lower body back to the heart, where it passes through the belly.",
        "external intercostal muscles": f"The outer layer of muscle between the ribs {where}.",
        "internal intercostal muscles": f"The middle layer of muscle between the ribs {where}.",
        "innermost intercostal muscles": f"The deepest layer of muscle between the ribs {where}.",
        "pectoralis minor muscle": f"A small chest muscle under the large chest muscle {where}.",
        "sternocostal head of pectoralis major muscle": f"The main part of the large chest muscle {where}, running from the breastbone and ribs toward the arm.",
        "clavicular head of pectoralis major muscle": f"The upper part of the large chest muscle {where}, running from the collarbone toward the arm.",
        "abdominal part of pectoralis major muscle": f"The lower slip of the large chest muscle {where}.",
        "serratus anterior muscle": f"The muscle along the side of the rib cage {where} that helps move the shoulder blade.",
        "latissimus dorsi muscle": f"The broad muscle of the lower back and side {where}.",
        "rectus abdominis muscle": f"The paired vertical muscle on the front of the belly {where}. People often call this area the abs.",
        "external abdominal oblique muscle": f"The outer sheet of muscle along the side of the belly {where}.",
        "internal abdominal oblique muscle": f"The middle sheet of muscle along the side of the belly {where}.",
        "transversus abdominis muscle": f"The deepest sheet of muscle wrapping the belly {where}.",
        "descending part of trapezius muscle": f"The upper part of the trapezius muscle {where}, from the neck toward the shoulder.",
        "transverse part of trapezius muscle": f"The middle part of the trapezius muscle {where}, across the top of the back.",
        "ascending part of trapezius muscle": f"The lower part of the trapezius muscle {where}, coming up from the mid-back.",
        "rhomboid major muscle": f"A muscle between the spine and the shoulder blade {where}.",
        "rhomboid minor muscle": f"A smaller muscle just above the rhomboid major {where}, between the spine and the shoulder blade.",
        "clavicular part of deltoid muscle": f"The front part of the shoulder cap muscle {where}.",
        "acromial part of deltoid muscle": f"The middle part of the shoulder cap muscle {where}.",
        "scapular spinal part of deltoid muscle": f"The back part of the shoulder cap muscle {where}.",
        "subclavius muscle": f"A small muscle just under the collarbone {where}.",
        "superior lobe of left lung": "The upper portion of the lung on the patient's left.",
        "inferior lobe of left lung": "The lower portion of the lung on the patient's left.",
        "superior lobe of right lung": "The upper portion of the lung on the patient's right.",
        "middle lobe of right lung": "The middle portion of the lung on the patient's right. The left lung does not have a separate middle lobe.",
        "inferior lobe of right lung": "The lower portion of the lung on the patient's right.",
        "pectoral region": f"The skin on the front of the chest {where}, over the chest muscle.",
        "presternal region": f"The skin directly over the breastbone {where}.",
        "lateral region of thorax": f"The skin on the side of the chest {where}.",
        "scapular region": f"The skin over the shoulder blade {where}.",
        "infrascapular region": f"The skin just below the shoulder blade {where}.",
        "interscapular region": f"The skin between the shoulder blade and the spine {where}.",
        "epigastric region": f"The skin of the upper middle belly {where}, just under the breastbone.",
        "hypochondriac region": f"The skin of the upper belly to the side {where}, under the ribs.",
        "umbilical region": f"The skin around the navel {where}.",
        "lateral region of abdomen": f"The skin on the side of the belly {where}.",
        "lumbar region": f"The skin of the lower back {where}, beside the spine.",
        "deltopectoral triangle": f"The skin in the groove between the chest muscle and the shoulder {where}.",
    }
    if low in fixed:
        return fixed[low]
    vertebra = re.fullmatch(r"vertebra ([ctl])(\d+)", low)
    if vertebra:
        kind = {"c": "neck", "t": "chest", "l": "lower back"}[vertebra.group(1)]
        return f"Back bone {vertebra.group(1).upper()}{vertebra.group(2)} in the {kind}."
    if "segment of liver" in low:
        return (
            f"One section of the liver ({raw}). The liver sits in the upper belly, mostly on the patient's right. "
            "This label only names that section."
        )
    if layer == "skin":
        return (
            f"Skin in the area the anatomy model calls the {raw[:1].lower() + raw[1:]} {where}. "
            "This is the outside surface of the body."
        )
    raise SystemExit(f"No plain-English sentence for {raw!r} ({layer})")


def bone_wanted(base: str) -> bool:
    if re.fullmatch(rf"({RIB_WORD}) rib", base):
        return True
    if re.fullmatch(rf"costal cartilage of ({RIB_WORD}) rib", base):
        return True
    if base in {"manubrium of sternum", "body of sternum", "xiphoid process", "clavicle", "scapula", "humerus"}:
        return True
    match = re.fullmatch(r"vertebra ([ctl])(\d+)", base)
    if not match:
        return False
    letter, number = match.group(1), int(match.group(2))
    if letter == "c":
        return number == 7
    if letter == "t":
        return 1 <= number <= 12
    return letter == "l" and number <= 2


def classify(source_key: str, node_name: str) -> str | None:
    if ".j" in node_name.lower() or node_name.lower().endswith(".t") or node_name.lower().endswith(".s"):
        return None
    _side, raw = split_side(node_name)
    base = raw.lower()
    if source_key == "skeleton":
        return "skeleton" if bone_wanted(base) else None
    if source_key == "muscle":
        return "muscle" if base in MUSCLE_BASES else None
    if source_key == "skin":
        if any(word in base for word in ("hair", "nail", "eyebrow", "eyelash", "perionyx")):
            return None
        return "skin"
    if source_key == "visceral":
        if any(word in base for word in ("bronch", "pleura", "duct", "impression", "omentum", "colon", "taenia")):
            return None
        if base in {"liver", "liver.001"} or base.startswith("liver "):
            return None
        if any(
            token in base
            for token in (
                "lobe of left lung",
                "lobe of right lung",
                "segment of liver",
                "stomach",
                "oesophagus",
                "esophagus",
                "pancreas",
                "gallbladder",
                "trachea",
            )
        ):
            return "organ"
        return None
    if source_key == "cardio":
        if any(word in base for word in ("papillary", "segmental", "vein of", "artery of", "circumflex", "bifurcation")):
            return None
        if any(word in base for word in ("atrium", "ventricle", "aorta", "vena cava", "pulmonary trunk")):
            return "organ"
    return None


def swatch_for(layer: str, raw: str) -> str:
    low = raw.lower()
    if "costal cartilage" in low:
        return "#c5d5de"
    if layer == "skeleton":
        return "#efe4cc"
    if layer == "muscle":
        return "#c45c64"
    if layer == "skin":
        return "#e4b59a"
    if "lung" in low:
        return "#e7b7c6"
    if any(word in low for word in ("atrium", "ventricle")):
        return "#9d2d3c"
    if "liver" in low:
        return "#7d403c"
    if "stomach" in low:
        return "#d7a184"
    if "oesophag" in low or "esophag" in low:
        return "#c98998"
    if "pancreas" in low:
        return "#e4c98a"
    if "gallbladder" in low:
        return "#6d8d58"
    if "aorta" in low or "pulmonary trunk" in low:
        return "#b4233a"
    if "vena cava" in low:
        return "#3c5c9c"
    if "trachea" in low:
        return "#d5e0e8"
    return "#c9b2a8"


def world_matrix(node, parent: np.ndarray) -> np.ndarray:
    local = np.array(node.transformation, dtype=np.float64)
    return parent @ local


def parts_from_node(node, matrix: np.ndarray) -> list[tuple[np.ndarray, np.ndarray]]:
    parts: list[tuple[np.ndarray, np.ndarray]] = []
    for mesh in node.meshes or []:
        verts = np.asarray(mesh.vertices, dtype=np.float64)
        faces = np.asarray(mesh.faces, dtype=np.int32)
        if verts.ndim != 2 or len(verts) < 40 or faces.ndim != 2 or faces.shape[1] != 3:
            continue
        homo = np.c_[verts, np.ones(len(verts))]
        world = (homo @ matrix.T)[:, :3]
        parts.append((world, faces))
    if len(parts) < 2:
        return parts
    kept: list[tuple[np.ndarray, np.ndarray]] = []
    boxes = [(v.min(0), v.max(0), len(v)) for v, _ in parts]
    for index, (verts, faces) in enumerate(parts):
        low, high, count = boxes[index]
        center = (low + high) / 2
        dominated = False
        for other, (low2, high2, count2) in enumerate(boxes):
            if other == index:
                continue
            if count2 > count * 3 and np.all(center >= low2) and np.all(center <= high2):
                dominated = True
                break
        if not dominated:
            kept.append((verts, faces))
    return kept or parts


def merge_parts(parts: list[tuple[np.ndarray, np.ndarray]]) -> trimesh.Trimesh | None:
    if not parts:
        return None
    verts = []
    faces = []
    offset = 0
    for block_v, block_f in parts:
        verts.append(block_v)
        faces.append(block_f + offset)
        offset += len(block_v)
    mesh = trimesh.Trimesh(vertices=np.vstack(verts), faces=np.vstack(faces), process=False)
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    if len(mesh.faces) < 20:
        return None
    return mesh


def simplify(mesh: trimesh.Trimesh, cap: int) -> tuple[trimesh.Trimesh, bool]:
    if len(mesh.faces) <= cap:
        return mesh, False
    reduced = mesh
    # A low aggressiveness setting stops early and leaves large muscles too heavy to turn smoothly.
    for agg in (8.0, 10.0, 12.0):
        points, triangles = fast_simplification.simplify(
            np.asarray(reduced.vertices, dtype=np.float64),
            np.asarray(reduced.faces, dtype=np.int32),
            target_count=cap,
            agg=agg,
        )
        reduced = trimesh.Trimesh(vertices=points, faces=triangles, process=False)
        reduced.update_faces(reduced.nondegenerate_faces())
        reduced.remove_unreferenced_vertices()
        if len(reduced.faces) <= int(cap * 1.05):
            break
    return reduced, True


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def collect(source_key: str, table: dict[str, str]) -> list[dict]:
    path = SOURCES[source_key]
    print(f"Reading {path.name}...", flush=True)
    found: list[dict] = []
    with pyassimp.load(str(path), processing=aiProcess_Triangulate) as scene:
        def walk(node, parent: np.ndarray) -> None:
            matrix = world_matrix(node, parent)
            name = node.name or ""
            layer = classify(source_key, name) if name else None
            if layer and node.meshes:
                side, raw = split_side(name)
                parts = parts_from_node(node, matrix)
                mesh = merge_parts(parts)
                if mesh is not None:
                    medical = medical_name(side, raw)
                    original = int(len(mesh.faces))
                    mesh, reduced = simplify(mesh, FACE_CAP[layer])
                    structure_id = f"{layer}-{slug(name)}"
                    found.append(
                        {
                            "id": structure_id,
                            "sourceName": name,
                            "medicalName": medical,
                            "plain": plain_english(side, raw, layer),
                            "fma": fma_for(table, side, raw, medical),
                            "layer": layer,
                            "side": side,
                            "swatch": swatch_for(layer, raw),
                            "file": f"{layer}.glb",
                            "originalFaces": original,
                            "faces": int(len(mesh.faces)),
                            "simplified": reduced,
                            "mesh": mesh,
                        }
                    )
            for child in node.children or []:
                walk(child, matrix)

        walk(scene.rootnode, np.eye(4))
    print(f"  kept {len(found)} structures", flush=True)
    return found


def first_hit(structures: list[dict], origin: np.ndarray, direction: np.ndarray) -> tuple[float, dict] | None:
    direction = direction / np.linalg.norm(direction)
    best: tuple[float, dict] | None = None
    for structure in structures:
        locations, _ray, _tri = structure["mesh"].ray.intersects_location(
            [origin], [direction]
        )
        if len(locations) == 0:
            continue
        distance = float(np.min(np.linalg.norm(locations - origin, axis=1)))
        if best is None or distance < best[0]:
            best = (distance, structure)
    return best


def landmark_probe(structures: list[dict], structure_id: str, approach: np.ndarray) -> dict:
    target = next(item for item in structures if item["id"] == structure_id)
    approach = approach / np.linalg.norm(approach)
    mesh = target["mesh"]
    centers = mesh.triangles_center
    areas = mesh.area_faces
    # Aim at the middle of a real face. A ray through a hairline triangle can
    # be counted by one geometry library and ignored by the viewer.
    facing = (mesh.face_normals @ approach) > 0.2
    solid = areas > max(0.02, float(np.percentile(areas, 60)))
    candidates = np.where(facing & solid)[0]
    if len(candidates) == 0:
        candidates = np.where(areas > 0.02)[0]
    if len(candidates) == 0:
        candidates = np.arange(len(areas))
    scores = centers @ approach
    order = candidates[np.argsort(scores[candidates])[::-1]][:40]
    skeleton = [item for item in structures if item["layer"] == "skeleton"]
    for index in order:
        origin = centers[index] + approach * 12.0
        hit = first_hit(skeleton, origin, -approach)
        if hit and hit[1]["id"] == structure_id:
            return {
                "id": structure_id,
                "origin": origin.tolist(),
                "direction": (-approach).tolist(),
                "expectMedical": target["medicalName"],
                "expectFma": target["fma"],
                "expectPlainIncludes": "breastbone"
                if "sternum" in target["medicalName"].lower()
                else ("rib" if "rib" in target["medicalName"].lower() else "shoulder blade"),
            }
    raise SystemExit(f"Could not build a clean tap probe for {structure_id}")


def depth_probe(structures: list[dict], direct: dict) -> dict:
    origin = np.array(direct["origin"], dtype=float)
    direction = np.array(direct["direction"], dtype=float)
    # Start farther outside so skin, which sits beyond the bone, is on the ray.
    origin = origin - direction * 30.0
    hits = []
    for structure in structures:
        locations, _ray, _tri = structure["mesh"].ray.intersects_location([origin], [direction])
        if len(locations) == 0:
            continue
        distance = float(np.min(np.linalg.norm(locations - origin, axis=1)))
        hits.append((distance, structure))
    hits.sort(key=lambda item: item[0])
    if not hits or hits[0][1]["layer"] != "skin":
        raise SystemExit(f"Skin is not the first surface for {direct['id']}: {[h[1]['medicalName'] for h in hits[:4]]}")
    if not any(item[1]["id"] == direct["id"] for item in hits):
        raise SystemExit(f"Landmark {direct['id']} is not under the skin along the tap ray")
    return {
        "id": direct["id"],
        "origin": origin.tolist(),
        "direction": direction.tolist(),
        "expectFirstLayer": "skin",
        "expectIncludesId": direct["id"],
        "surfaceToDeep": [item[1]["id"] for item in hits],
    }


def main() -> None:
    table = load_fma_table()
    structures: list[dict] = []
    for key in ("skeleton", "muscle", "visceral", "cardio", "skin"):
        structures.extend(collect(key, table))

    ids = [item["id"] for item in structures]
    if len(ids) != len(set(ids)):
        dupes = sorted({item for item in ids if ids.count(item) > 1})
        raise SystemExit(f"Duplicate structure ids: {dupes[:10]}")

    sternum = next(item for item in structures if item["sourceName"] == "Body of sternum")
    offset = sternum["mesh"].vertices.mean(axis=0)
    for item in structures:
        item["mesh"].vertices -= offset

    left_rib = next(item for item in structures if item["sourceName"] == "Fourth rib.l")
    right_scapula = next(item for item in structures if item["sourceName"] == "Scapula.r")
    if left_rib["mesh"].vertices[:, 0].mean() <= 0:
        raise SystemExit("Patient left is not on +X")
    if right_scapula["mesh"].vertices[:, 0].mean() >= 0:
        raise SystemExit("Patient right scapula is not on -X")
    if sternum["mesh"].vertices[:, 2].mean() <= right_scapula["mesh"].vertices[:, 2].mean():
        raise SystemExit("Front is not +Z")

    probes = [
        landmark_probe(structures, sternum["id"], np.array([0.0, 0.0, 1.0])),
        landmark_probe(structures, left_rib["id"], np.array([1.0, 0.0, 0.35])),
        landmark_probe(structures, right_scapula["id"], np.array([-0.25, 0.05, -1.0])),
    ]
    depth = [depth_probe(structures, probe) for probe in probes]

    OUT.mkdir(parents=True, exist_ok=True)
    for layer in ("skeleton", "muscle", "organ", "skin"):
        scene = trimesh.Scene()
        for item in structures:
            if item["layer"] != layer:
                continue
            scene.add_geometry(item["mesh"], geom_name=item["id"])
        target = OUT / f"{layer}.glb"
        scene.export(target)
        print(f"Wrote {target.name} ({target.stat().st_size / 1e6:.1f} MB)", flush=True)

    simplified = [item for item in structures if item["simplified"]]
    original_faces = sum(item["originalFaces"] for item in structures)
    final_faces = sum(item["faces"] for item in structures)
    catalog = {
        "source": "Z-Anatomy",
        "coordinateSpace": {
            "units": "centimeters",
            "up": "+Y",
            "patientLeft": "+X",
            "anterior": "+Z",
            "centeredOn": "centroid of the body of the sternum",
        },
        "simplification": {
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
        },
        "omitted": [
            "The pleural sheet was left out because it is one wrapping surface that would cover the lung lobes and hide them from a tap.",
            "Bronchial branches inside the lungs were left out so a tap on the chest hits the lung lobe surface rather than an airway inside it.",
            "Hair and nails were left out of the skin layer.",
            "Tiny internal heart muscles (papillary muscles) and small cardiac vessels were left out so the heart chambers stay readable.",
        ],
        "structures": [
            {key: value for key, value in item.items() if key != "mesh"}
            for item in structures
        ],
        "probes": probes,
        "depthProbes": depth,
    }
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=2))
    missing_fma = [item["medicalName"] for item in structures if not item["fma"]]
    print(f"Structures: {len(structures)}  missing FMA: {len(missing_fma)}")
    for name in missing_fma:
        print("  no FMA:", name)
    for probe in probes:
        print("probe", probe["expectMedical"], probe["expectFma"])


if __name__ == "__main__":
    main()
