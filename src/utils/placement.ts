import * as THREE from "three";
import type { StyleId, UIState } from "./editor";
import { makeEdgeLineMaterial, makeSolidMaterial, makeTransparentWireMaterial } from "./editor";

export function buildStyledObject(
  geo: THREE.BufferGeometry,
  style: StyleId,
  color: THREE.Color
): THREE.Object3D {
  if (style === "solid") {
    return new THREE.Mesh(geo, makeSolidMaterial(color));
  }
  if (style === "wire") {
    return new THREE.Mesh(geo, makeTransparentWireMaterial(color));
  }

  const g = new THREE.Group();
  const solid = new THREE.Mesh(geo, makeSolidMaterial(color));
  g.add(solid);

  const edgesGeo = new THREE.EdgesGeometry(geo);
  const edges = new THREE.LineSegments(edgesGeo, makeEdgeLineMaterial(color));
  g.add(edges);

  return g;
}

export function calcCenterY(shape: UIState["shape"], s: UIState, currentLevel: number): number {
  if (shape === "sphere") {
    const r = Math.max(s.w / 2, s.d / 2);
    return currentLevel + r;
  }
  return currentLevel + s.h / 2;
}

export function degToRad(deg: number) {
  return THREE.MathUtils.degToRad(deg);
}
