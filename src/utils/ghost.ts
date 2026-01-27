import * as THREE from "three";
import type { UIState } from "./types";
import { buildStyledObject, applyRotation } from "./placement";
import { buildGeometry } from "./editor";

export function createGhost(initial: UIState): THREE.Object3D {
  const ghostColor = new THREE.Color("#ffffff");
  const geo = buildGeometry(initial.shape, initial);

  const obj = buildStyledObject(geo, initial.style, ghostColor);
  obj.visible = false;

  // Apply initial rotation (important for ghost)
  applyRotation(obj, initial.rotation);

  return obj;
}

export function rebuildGhost(scene: THREE.Scene, oldGhost: THREE.Object3D, ui: UIState): THREE.Object3D {
  scene.remove(oldGhost);
  disposeObject3D(oldGhost); // important to avoid memory leaks

  const ghostColor = new THREE.Color("#ffffff");
  const geo = buildGeometry(ui.shape, ui);

  const next = buildStyledObject(geo, ui.style, ghostColor);
  next.visible = oldGhost.visible;

  applyRotation(next, ui.rotation);

  scene.add(next);
  return next;
}

export function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
    if (child instanceof THREE.LineSegments) {
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
    }
  });
}