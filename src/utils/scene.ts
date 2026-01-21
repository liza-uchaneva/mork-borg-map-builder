import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AppConfig } from './editor';

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0f);
  return scene;
}

export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 20, 10);
  scene.add(dir);
}

export function buildGround(scene: THREE.Scene, gridSize: number) {
  const geo = new THREE.PlaneGeometry(gridSize, gridSize);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 1 });
  const ground = new THREE.Mesh(geo, mat);
  ground.name = "ground";
  scene.add(ground);

  return ground;
}

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
