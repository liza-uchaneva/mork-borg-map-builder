import * as THREE from "three";
import type { HoverState, UIState } from "./editor";
import { disposeObject3D } from "./editor";

export function createRay(): { raycaster: THREE.Raycaster; mouseNDC: THREE.Vector2 } {
  return { raycaster: new THREE.Raycaster(), mouseNDC: new THREE.Vector2(1, 1) };
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

  let obj: THREE.Object3D = hits[0].object;
  while (obj.parent && obj.parent !== placed) obj = obj.parent;

  placed.remove(obj);
  disposeObject3D(obj);
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
