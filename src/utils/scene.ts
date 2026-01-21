import * as THREE from "three";

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
