import * as THREE from "three";
import type { HoverState, UIState, StyleId  } from "./types";
import { disposeObject3D } from "./editor";

export function createRay(): { raycaster: THREE.Raycaster; mouseNDC: THREE.Vector2 } {
  return { raycaster: new THREE.Raycaster(), mouseNDC: new THREE.Vector2(1, 1) };
}

function stylePriority(style: unknown): number {
  // Higher = more important to delete first
  const s = String(style) as StyleId;

  if (s === "solid") return 3;
  if (s === "solidWire") return 2;
  if (s === "wire") return 1;

  // Unknown style -> lowest priority
  return 0;
}

function findPlacedRoot(obj: THREE.Object3D, placed: THREE.Group): THREE.Object3D {
  let cur: THREE.Object3D = obj;
  while (cur.parent && cur.parent !== placed) cur = cur.parent;
  return cur;
}

export function ndcFromEvent(ev: PointerEvent, dom: HTMLElement, out: THREE.Vector2) {
  const rect = dom.getBoundingClientRect();
  out.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  out.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
}

export function deleteClickedObject(
  ev: PointerEvent,
  dom: HTMLElement,
  raycaster: THREE.Raycaster,
  mouseNDC: THREE.Vector2,
  camera: THREE.Camera,
  placed: THREE.Group
) {
  ndcFromEvent(ev, dom, mouseNDC);
  raycaster.setFromCamera(mouseNDC, camera);

  const hits = raycaster.intersectObjects(placed.children, true);
  if (!hits.length) return;

  // Pick best candidate: higher style priority wins; if tie -> closer wins
  let bestObj: THREE.Object3D | null = null;
  let bestPriority = -Infinity;
  let bestDist = Infinity;

  for (const h of hits) {
    const root = findPlacedRoot(h.object, placed);
    const pr = stylePriority(root.userData.style);

    // Prefer higher priority; if equal, prefer the closest hit
    if (pr > bestPriority || (pr === bestPriority && h.distance < bestDist)) {
      bestObj = root;
      bestPriority = pr;
      bestDist = h.distance;
    }
  }

  if (!bestObj) return;

  placed.remove(bestObj);
  disposeObject3D(bestObj);
}

export function clampCenterToGround(x: number, z: number, s: UIState, half: number) {
  const halfW = s.w / 2;
  const halfD = s.d / 2;

  const isRound = s.shape === "sphere" || s.shape === "cone" || s.shape === "cylinder";
  const r = Math.max(halfW, halfD);

  const marginX = isRound ? r : halfW;
  const marginZ = isRound ? r : halfD;

  const minX = -half + marginX;
  const maxX = half - marginX;
  const minZ = -half + marginZ;
  const maxZ = half - marginZ;

  return {
    x: THREE.MathUtils.clamp(x, minX, maxX),
    z: THREE.MathUtils.clamp(z, minZ, maxZ),
  };
}

export function updateHoverFromGroundHit(
  p: THREE.Vector3,
  s: UIState,
  half: number,
  hover: HoverState
) {
  const clamped = clampCenterToGround(p.x, p.z, s, half);
  hover.x = clamped.x;
  hover.z = clamped.z;
  hover.hasHover = true;
}
