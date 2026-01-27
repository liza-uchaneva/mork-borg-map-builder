import * as THREE from "three";
import type { Rotation, StyleId  } from "./types";

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function applyRotation(obj: THREE.Object3D, rot: Rotation) {
  obj.rotation.set(degToRad(rot.x), degToRad(rot.y), degToRad(rot.z));
}

function makeSolidMaterial(color: THREE.Color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1 });
}

function makeWireMaterial(color: THREE.Color) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
}

function makeEdgeMaterial(color: THREE.Color) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
}

export function buildStyledObject(
  geo: THREE.BufferGeometry,
  style: StyleId,
  color: THREE.Color
): THREE.Object3D {
  let obj: THREE.Object3D;

  if (style === "solid") {
    obj = new THREE.Mesh(geo, makeSolidMaterial(color));
  } else if (style === "wire") {
    obj = new THREE.Mesh(geo, makeWireMaterial(color));
  } else {
    // "solidWire"
    const g = new THREE.Group();
    const solid = new THREE.Mesh(geo, makeSolidMaterial(color));
    g.add(solid);

    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edges = new THREE.LineSegments(edgesGeo, makeEdgeMaterial(color));
    g.add(edges);

    obj = g;
  }

  // Important: mark style so deletion can prioritize correctly
  obj.userData.style = style;

  return obj;
}

export function calcCenterY(
  shape: string,
  h: number,
  level: number,
  w: number,
  d: number
): number {
  if (shape === "sphere") {
    return level + Math.max(w, d) / 2;
  }
  return level + h / 2;}