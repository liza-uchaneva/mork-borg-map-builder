import * as THREE from "three";
import type { UIState } from "./types";
import { isRound } from "./shapes";

export function createProjection(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
    new THREE.PlaneGeometry(1, 1),
    mat
  );

  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.visible = false;

  return mesh;
}

export function rebuildProjection(mesh: THREE.Mesh, s: UIState) {
  mesh.geometry.dispose();

  if (isRound(s.shape)) {
    const r = Math.max(s.w / 2, s.d / 2);
    mesh.geometry = new THREE.CircleGeometry(r, 48);
  } else {
    mesh.geometry = new THREE.PlaneGeometry(s.w, s.d);
  }
}
