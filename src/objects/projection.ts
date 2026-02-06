import * as THREE from "three";
import type { UIState } from "../utils/types";
import { degToRad } from "../utils/placement";

function isRound(shape: UIState["shape"]) {
  return shape === "sphere" || shape === "cone" || shape === "cylinder";
}

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

  // Always lies on the ground
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.visible = false;

  return mesh;
}

export function rebuildProjection(proj: THREE.Mesh, ui: UIState) {
  // Dispose the previous geometry to avoid memory leaks
  proj.geometry.dispose();

  const w = Math.max(1, ui.w);
  const d = Math.max(1, ui.d);

  if (isRound(ui.shape)) {
    const r = Math.max(w, d) / 2;

    // Circle centered at origin; looks correct as "shadow" for round-ish shapes
    proj.geometry = new THREE.CircleGeometry(r, 48);

    // Circle doesn't need Y rotation (symmetry), keep it stable
    proj.rotation.set(-Math.PI / 2, 0, 0);
  } else {
    // Box projection = rectangle on ground
    proj.geometry = new THREE.PlaneGeometry(w, d);

    // Rectangle should rotate around Y to match the object yaw
    proj.rotation.set(-Math.PI / 2, degToRad(ui.rotation.y), 0);
  }
}
