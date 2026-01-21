import * as THREE from "three";

export function makeSolidMaterial(color: THREE.Color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1 });
}

export function makeTransparentWireMaterial(color: THREE.Color) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
}

export function makeEdgeLineMaterial(color: THREE.Color) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
}

export function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
}
