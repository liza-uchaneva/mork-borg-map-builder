import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AppConfig } from './types';

export function createCamera(app: HTMLElement): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(35, app.clientWidth / app.clientHeight, 0.1, 1000);
}

export function setupIsoCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  cfg: AppConfig
) {
  const y = cfg.cameraDistance * Math.sin(cfg.isoTilt);
  const xz = cfg.cameraDistance * Math.cos(cfg.isoTilt);
  camera.position.set(xz * Math.cos(cfg.isoY), y, xz * Math.sin(cfg.isoY));
  camera.lookAt(target);
}

export function createControls(camera: THREE.PerspectiveCamera, dom: HTMLElement, target: THREE.Vector3) {
  const controls = new OrbitControls(camera, dom);
  controls.target.copy(target);
  controls.update();
  return controls;
}
