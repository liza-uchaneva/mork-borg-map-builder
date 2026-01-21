import * as THREE from "three";

export function buildGround(scene: THREE.Scene, gridSize: number) {
  const geo = new THREE.PlaneGeometry(gridSize, gridSize);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 1 });
  const ground = new THREE.Mesh(geo, mat);
  ground.name = "ground";
  scene.add(ground);

  return ground;
}
