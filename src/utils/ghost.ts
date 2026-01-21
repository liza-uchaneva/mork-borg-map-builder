import * as THREE from "three";
import type { UIState } from "./editor";
import { buildGeometry } from "./editor";
import { buildStyledObject } from "./placement";
import { disposeObject3D } from "./editor";

export function createGhost(initial: UIState): THREE.Object3D {
  const ghostColor = new THREE.Color("#ffffff");
  const geo = buildGeometry(initial.shape, initial);
  const obj = buildStyledObject(geo, initial.style, ghostColor);
  obj.visible = false;
  return obj;
}

export function rebuildGhost(scene: THREE.Scene, ghost: THREE.Object3D, s: UIState): THREE.Object3D {
  scene.remove(ghost);
  disposeObject3D(ghost);

  const ghostColor = new THREE.Color("#ffffff");
  const geo = buildGeometry(s.shape, s);
  const next = buildStyledObject(geo, s.style, ghostColor);
  next.visible = false;

  scene.add(next);
  return next;
}
