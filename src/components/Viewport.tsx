import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  AmbientLight,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { assignStructureNames, hitsAlongRay, stackFromSurface } from "../anatomy/pick";
import { publicUrl } from "../lib/publicUrl";
import type { Catalog, LayerSetting, StructureRecord } from "../lib/types";

export type TapResult = {
  position: [number, number, number];
  structure: StructureRecord;
  beneath: StructureRecord[];
};

export type PinMarker = {
  id: string;
  position: [number, number, number];
  radiation: [number, number, number] | null;
  selected: boolean;
  number: number;
};

export type ViewportHandle = {
  capture: (view: "front" | "back" | "side") => string;
};

type Props = {
  catalog: Catalog | null;
  layers: LayerSetting[];
  pins: PinMarker[];
  radiationArmed: boolean;
  onTap: (result: TapResult) => void;
  onPinSelect: (id: string) => void;
  onRadiation: (result: TapResult) => void;
  onViewChange: (title: string, detail: string) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

type SceneApi = {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  anatomy: Mesh[];
  pins: Group;
  render: () => void;
};

const sphere = new SphereGeometry(0.85, 20, 16);
const cone = new ConeGeometry(1.1, 2.4, 16);

function labelSprite(text: string, fill: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not draw a label.");
  context.fillStyle = fill;
  context.beginPath();
  context.arc(64, 64, 56, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#1c2430";
  context.font = "700 64px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 64, 70);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(5.5, 5.5, 1);
  sprite.raycast = () => undefined;
  return sprite;
}

function describeView(camera: PerspectiveCamera): { title: string; detail: string } {
  const offset = camera.position;
  const ax = Math.abs(offset.x);
  const ay = Math.abs(offset.y);
  const az = Math.abs(offset.z);
  let title = "Angled view";
  if (az >= ax && az >= ay) title = offset.z > 0 ? "Looking at the front" : "Looking at the back";
  else if (ax >= ay) title = offset.x > 0 ? "Looking at the patient's left side" : "Looking at the patient's right side";
  else title = offset.y > 0 ? "Looking down from above" : "Looking up from below";
  const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const patientLeftOn = right.x >= 0 ? "right" : "left";
  return {
    title,
    detail: `Patient's left is on the ${patientLeftOn} side of this picture. Left always means the patient's left.`,
  };
}

function layerFromName(name: string): LayerSetting["id"] {
  if (name.startsWith("skin-")) return "skin";
  if (name.startsWith("skeleton-")) return "skeleton";
  if (name.startsWith("muscle-")) return "muscle";
  return "organ";
}

function applyLayers(meshes: Mesh[], layers: LayerSetting[]) {
  const settings = new Map(layers.map((layer) => [layer.id, layer]));
  for (const mesh of meshes) {
    const record = mesh.userData.record as StructureRecord | undefined;
    const setting = settings.get(record?.layer ?? layerFromName(mesh.name));
    const material = mesh.material;
    if (!(material instanceof MeshStandardMaterial) || !setting) continue;
    mesh.visible = setting.visible && setting.opacity > 0.02;
    material.opacity = setting.opacity;
    material.transparent = setting.opacity < 0.98;
    material.depthWrite = setting.opacity > 0.85;
    material.needsUpdate = true;
  }
}

function drawPins(group: Group, pins: PinMarker[]) {
  while (group.children.length > 0) group.remove(group.children[0]);
  for (const pin of pins) {
    const marker = new Mesh(
      sphere,
      new MeshStandardMaterial({
        color: pin.selected ? "#9d1c2b" : "#d4533a",
        emissive: "#7a2a1c",
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
    );
    marker.position.set(pin.position[0], pin.position[1], pin.position[2]);
    marker.name = `pin:${pin.id}`;
    group.add(marker);

    const number = labelSprite(String(pin.number), pin.selected ? "#f6d4cc" : "#f8e1c8");
    number.position.set(pin.position[0], pin.position[1] + 3.2, pin.position[2]);
    group.add(number);

    if (!pin.radiation) continue;
    const start = new Vector3(pin.position[0], pin.position[1], pin.position[2]);
    const end = new Vector3(pin.radiation[0], pin.radiation[1], pin.radiation[2]);
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 0.4) continue;
    const shaft = new Mesh(
      new CylinderGeometry(0.28, 0.28, length, 10),
      new MeshStandardMaterial({ color: "#9d1c2b" }),
    );
    shaft.position.copy(start).add(direction.clone().multiplyScalar(0.5));
    shaft.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
    shaft.raycast = () => undefined;
    group.add(shaft);
    const head = new Mesh(cone, new MeshStandardMaterial({ color: "#9d1c2b" }));
    head.position.copy(end);
    head.quaternion.copy(shaft.quaternion);
    head.raycast = () => undefined;
    group.add(head);
  }
}

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(
  { catalog, layers, pins, radiationArmed, onTap, onPinSelect, onRadiation, onViewChange, onReady, onError },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef(layers);
  const radiationRef = useRef(radiationArmed);
  const catalogRef = useRef(catalog);
  const callbacks = useRef({ onTap, onPinSelect, onRadiation, onViewChange, onReady, onError });
  useEffect(() => {
    layersRef.current = layers;
    radiationRef.current = radiationArmed;
    catalogRef.current = catalog;
    callbacks.current = { onTap, onPinSelect, onRadiation, onViewChange, onReady, onError };
  });

  const api = useRef<SceneApi | null>(null);

  useImperativeHandle(ref, () => ({
    capture(view) {
      const current = api.current;
      if (!current) return "";
      const savedPosition = current.camera.position.clone();
      const savedTarget = current.controls.target.clone();
      const spot = {
        front: new Vector3(0, 12, 86),
        back: new Vector3(0, 12, -86),
        side: new Vector3(86, 12, 0),
      }[view];
      current.camera.position.copy(spot);
      current.controls.target.set(0, 0, 0);
      current.camera.lookAt(0, 0, 0);
      current.controls.update();
      current.render();
      const url = current.renderer.domElement.toDataURL("image/jpeg", 0.72);
      current.camera.position.copy(savedPosition);
      current.controls.target.copy(savedTarget);
      current.camera.lookAt(savedTarget);
      current.controls.update();
      current.render();
      return url;
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !catalog) return;

    const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(host.clientWidth, Math.max(host.clientHeight, 1));
    renderer.outputColorSpace = SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.background = new Color("#e6ded0");
    const camera = new PerspectiveCamera(35, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 2000);
    camera.position.set(0, 8, 92);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.enableDamping = false;
    controls.minDistance = 18;
    controls.maxDistance = 280;
    controls.update();

    scene.add(new HemisphereLight(0xfff8ee, 0xb7aa98, 1.2));
    scene.add(new AmbientLight(0xffffff, 0.25));
    const key = new DirectionalLight(0xffffff, 1.45);
    key.position.set(40, 90, 50);
    scene.add(key);
    const fill = new DirectionalLight(0xd5e4ea, 0.55);
    fill.position.set(-50, 20, -40);
    scene.add(fill);

    const leftMark = labelSprite("L", "#f4e7c4");
    leftMark.position.set(24, 8, 6);
    const rightMark = labelSprite("R", "#f4e7c4");
    rightMark.position.set(-24, 8, 6);
    scene.add(leftMark, rightMark);

    const pinGroup = new Group();
    scene.add(pinGroup);
    const anatomy: Mesh[] = [];

    const render = () => {
      renderer.render(scene, camera);
      const view = describeView(camera);
      callbacks.current.onViewChange(view.title, view.detail);
    };
    controls.addEventListener("change", render);

    api.current = { renderer, camera, controls, anatomy, pins: pinGroup, render };

    const resize = () => {
      camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, Math.max(host.clientHeight, 1));
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let pointer: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointer) return;
      const moved = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
      pointer = null;
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new Vector3(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
        0.5,
      );
      const origin = camera.position.clone();
      const direction = ndc.clone().unproject(camera).sub(origin).normalize();
      const pinMeshes = pinGroup.children.filter((child): child is Mesh => child instanceof Mesh);
      const pinHit = hitsAlongRay(pinMeshes, origin, direction).find((hit) => hit.id.startsWith("pin:"));
      if (pinHit) {
        callbacks.current.onPinSelect(pinHit.id.slice(4));
        return;
      }
      const visible = anatomy.filter((mesh) => mesh.visible);
      const hits = hitsAlongRay(visible, origin, direction);
      const records = catalogRef.current?.structures ?? [];
      const byId = new Map(records.map((item) => [item.id, item]));
      const stack = stackFromSurface(hits, (id) => byId.get(id)?.layer ?? "organ").flatMap((hit) => {
        const structure = byId.get(hit.id);
        return structure ? [{ hit, structure }] : [];
      });
      const first = stack[0];
      if (!first) return;
      const result: TapResult = {
        position: first.hit.point,
        structure: first.structure,
        beneath: stack.slice(1).map((item) => item.structure),
      };
      if (radiationRef.current) callbacks.current.onRadiation(result);
      else callbacks.current.onTap(result);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const ids = new Set(catalog.structures.map((item) => item.id));
    const byId = new Map(catalog.structures.map((item) => [item.id, item]));
    const loader = new GLTFLoader();
    let cancelled = false;

    void (async () => {
      try {
        for (const file of ["skin.glb", "skeleton.glb", "muscle.glb", "organ.glb"]) {
          const gltf = await loader.loadAsync(publicUrl(`anatomy/${file}`));
          if (cancelled) return;
          for (const mesh of assignStructureNames(gltf.scene, ids)) {
            const record = byId.get(mesh.name);
            if (!record) continue;
            mesh.userData.record = record;
            mesh.material = new MeshStandardMaterial({
              color: record.swatch,
              roughness: 0.74,
              metalness: 0,
              transparent: true,
              opacity: 1,
              side: DoubleSide,
            });
            anatomy.push(mesh);
          }
          scene.add(gltf.scene);
        }
        if (anatomy.length === 0) {
          callbacks.current.onError("The body model loaded, but none of the named parts matched the catalog.");
          return;
        }
        applyLayers(anatomy, layersRef.current);
        render();
        callbacks.current.onReady();
      } catch (error) {
        callbacks.current.onError(
          error instanceof Error ? error.message : "The body model could not be loaded from this computer.",
        );
      }
    })();

    render();

    return () => {
      cancelled = true;
      observer.disconnect();
      controls.removeEventListener("change", render);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [catalog]);

  useEffect(() => {
    if (!api.current) return;
    applyLayers(api.current.anatomy, layers);
    api.current.render();
  }, [layers]);

  useEffect(() => {
    if (!api.current) return;
    drawPins(api.current.pins, pins);
    api.current.render();
  }, [pins]);

  return <div ref={hostRef} className="h-full min-h-[320px] w-full touch-none" />;
});
