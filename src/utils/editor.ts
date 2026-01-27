import * as THREE from "three";
import type { ShapeId, UIState } from "./types";

export function makeSolidMaterial(color: THREE.Color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1 });
}

export function makeTransparentWireMaterial(color: THREE.Color) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
}

export function makeEdgeLineMaterial(color: THREE.Color) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
}

export function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
}


export function buildGeometry(shape: ShapeId, s: UIState): THREE.BufferGeometry {
  const w = Math.max(1, s.w);
  const d = Math.max(1, s.d);
  const h = Math.max(1, s.h);

  const rx = w / 2;
  const rz = d / 2;
  const r = Math.max(rx, rz);

  switch (shape) {
    case "box":
      return new THREE.BoxGeometry(w, h, d);
    case "sphere":
      return new THREE.SphereGeometry(r, 24, 16);
    case "cone":
      return new THREE.ConeGeometry(r, h, 24, 1);
    case "cylinder":
      return new THREE.CylinderGeometry(r, r, h, 24, 1);
    case "pyramid":
      return new THREE.ConeGeometry(r, h, 4, 1);
    default:
      return new THREE.BoxGeometry(w, h, d);
  }
}

export function isRound(shape: ShapeId) {
  return shape === "sphere" || shape === "cone" || shape === "cylinder";
}
