import * as THREE from "three";

export type InspectorCameras = {
  topCam: THREE.PerspectiveCamera;
  sideCam: THREE.PerspectiveCamera;

  update: () => void;
  renderInset: (
    cameraInset: THREE.PerspectiveCamera,
    x: number,
    y: number,
    w: number,
    h: number,
    clearColor: number
  ) => void;
};

type CreateInspectorCamerasArgs = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  getFocusObject: () => THREE.Object3D | null;
};

export function createInspectorCameras({
  scene,
  renderer,
  getFocusObject,
}: CreateInspectorCamerasArgs): InspectorCameras {
  // -------------------- Extra “inspector” cameras --------------------
  const topCam = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
  topCam.up.set(0, 0, -1);

  const sideCam = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
  sideCam.up.set(0, 1, 0);

  function renderInset(
    cameraInset: THREE.PerspectiveCamera,
    x: number,
    y: number,
    w: number,
    h: number,
    clearColor: number
  ) {
    cameraInset.aspect = w / h;
    cameraInset.updateProjectionMatrix();

    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.setScissorTest(true);

    renderer.setClearColor(clearColor, 1);
    renderer.clear(true, true, true);

    renderer.render(scene, cameraInset);
  }

  const tmpBox = new THREE.Box3();
  const tmpSize = new THREE.Vector3();
  const tmpCenter = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const tmpDir = new THREE.Vector3(1, 0, 0);

  function getFocusBounds() {
    const obj = getFocusObject();

    if (!obj) {
      return {
        center: tmpCenter.set(0, 0, 0),
        radius: 10,
      };
    }

    obj.updateMatrixWorld(true);
    tmpBox.setFromObject(obj);

    if (!isFinite(tmpBox.min.x) || tmpBox.isEmpty()) {
      obj.getWorldPosition(tmpCenter);
      return { center: tmpCenter, radius: 10 };
    }

    tmpBox.getCenter(tmpCenter);
    tmpBox.getSize(tmpSize);

    const radius = tmpSize.length() * 0.5;
    return { center: tmpCenter, radius: Math.max(radius, 0.5) };
  }

  function distanceToFitSphere(radius: number, fovDeg: number, padding = 1.2) {
    const fov = THREE.MathUtils.degToRad(fovDeg);
    return (radius * padding) / Math.tan(fov * 0.5);
  }

  function update() {
    const { center, radius } = getFocusBounds();

    tmpLook.set(center.x, center.y + radius * 0.15, center.z);

    // ---------- TOP CAMERA ----------
    const topDist = distanceToFitSphere(radius, topCam.fov, 1.25);

    topCam.position.set(tmpLook.x, tmpLook.y + topDist, tmpLook.z);
    topCam.up.set(0, 0, -1);
    topCam.near = Math.max(0.1, topDist - radius * 4);
    topCam.far = topDist + radius * 8 + 500;
    topCam.lookAt(tmpLook);
    topCam.updateProjectionMatrix();
    topCam.updateMatrixWorld(true);

    // ---------- SIDE CAMERA ----------
    const sideDist = distanceToFitSphere(radius, sideCam.fov, 1.35);

    const sideHeight = radius * 0.6 + 2;

    sideCam.position.copy(tmpLook).addScaledVector(tmpDir, sideDist);
    sideCam.position.y += sideHeight;

    sideCam.up.set(0, 1, 0);
    sideCam.near = Math.max(0.1, sideDist - radius * 4);
    sideCam.far = sideDist + radius * 8 + 500;
    sideCam.lookAt(tmpLook);
    sideCam.updateProjectionMatrix();
    sideCam.updateMatrixWorld(true);
  }

  return { topCam, sideCam, update, renderInset };
}
