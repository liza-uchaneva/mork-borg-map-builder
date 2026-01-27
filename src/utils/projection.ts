import * as THREE from "three";
import type { UIState } from "./types";
import { degToRad } from "./placement";

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

export function rebuildProjection(
  proj: THREE.Mesh,
  ui: UIState
) {
  proj.rotation.set(-Math.PI / 2, degToRad(ui.rotation.y), 0);
}
