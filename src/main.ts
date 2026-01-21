import * as THREE from "three";
import { createScene, addLights, buildGround, 
         createCamera, createControls, setupIsoCamera } from "./utils/scene";
import { buildGeometry } from "./utils/editor";
import { getUIRefs, ensureShapeOptions, readUI, onUIChange, getAppRoot } from "./utils/ui";
import { buildStyledObject, calcCenterY, degToRad } from "./utils/placement";
import { createProjection, rebuildProjection } from "./utils/projection";
import { createGhost, rebuildGhost } from "./utils/ghost";
import { createRay, ndcFromEvent, deleteClickedObject, updateHoverFromGroundHit } from "./utils/input";
import type { AppConfig, HoverState, UIState } from "./utils/editor";

const cfg: AppConfig = {
  gridSize: 30,
  maxLevels: 50,
  isoY: Math.PI / 4,
  isoTilt: Math.atan(Math.sqrt(2)),
  cameraDistance: 35,
}

const app = getAppRoot();
const scene = createScene();
addLights(scene);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

// Camera + controls
const camera = createCamera(app);
const target = new THREE.Vector3(0, 0, 0);
setupIsoCamera(camera, target, cfg);
const controls = createControls(camera, renderer.domElement, target);

// World
const ground = buildGround(scene, cfg.gridSize);
const placed = new THREE.Group();
scene.add(placed);

// UI
const ui = getUIRefs();
ensureShapeOptions(ui.shape);

let uiState: UIState = readUI(ui);

// Ghost + projection
let ghost = createGhost(uiState);
scene.add(ghost);

const projection = createProjection();
scene.add(projection);
rebuildProjection(projection, uiState);

// Hover + raycasting
const hover: HoverState = { hasHover: false, x: 0, z: 0 };
const { raycaster, mouseNDC } = createRay();

let currentLevel = 0;

// --- Helpers
function applyGhostAndProjection() {
  if (!hover.hasHover) {
    ghost.visible = false;
    projection.visible = false;
    return;
  }

  const y = calcCenterY(uiState.shape, uiState, currentLevel);
  ghost.position.set(hover.x, y, hover.z);
  ghost.rotation.set(0, degToRad(uiState.rotDeg), 0);
  ghost.visible = true;

  projection.position.set(hover.x, projection.position.y, hover.z);
  projection.rotation.x = -Math.PI / 2;
  projection.rotation.y = 0;

  const isRound = uiState.shape === "sphere" || uiState.shape === "cone" || uiState.shape === "cylinder";
  if (!isRound) projection.rotation.y = degToRad(uiState.rotDeg);
  projection.visible = true;
}

function placeObject() {
  if (!hover.hasHover) return;

  const color = new THREE.Color(uiState.colorHex);
  const geo = buildGeometry(uiState.shape, uiState);
  const obj = buildStyledObject(geo, uiState.style, color);

  obj.position.set(hover.x, calcCenterY(uiState.shape, uiState, currentLevel), hover.z);
  obj.rotation.set(0, degToRad(uiState.rotDeg), 0);

  placed.add(obj);
}

// --- Hover
renderer.domElement.addEventListener("pointermove", (ev) => {
  ndcFromEvent(ev, renderer.domElement, mouseNDC);
  raycaster.setFromCamera(mouseNDC, camera);

  const hits = raycaster.intersectObject(ground, false);
  if (!hits.length) {
    hover.hasHover = false;
    applyGhostAndProjection();
    return;
  }

  updateHoverFromGroundHit(hits[0].point, uiState, cfg.gridSize / 2, hover);
  applyGhostAndProjection();
});

renderer.domElement.addEventListener("contextmenu", (ev) => ev.preventDefault());

renderer.domElement.addEventListener("pointerdown", (ev) => {
  if (ev.button === 0) placeObject();
  if (ev.button === 2) deleteClickedObject(ev, renderer.domElement, raycaster, mouseNDC, camera, placed);
});

// --- Keyboard (Q/E)
window.addEventListener("keydown", (ev) => {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement) {
    active.blur();
  }

  if (ev.code === "KeyQ") {
    ev.preventDefault();
    currentLevel = Math.max(0, currentLevel - 1);
    applyGhostAndProjection();
  }

  if (ev.code === "KeyE") {
    ev.preventDefault();
    currentLevel = Math.min(cfg.maxLevels, currentLevel + 1);
    applyGhostAndProjection();
  }
});

// --- UI change handler
onUIChange(ui, () => {
  uiState = readUI(ui);

  ghost = rebuildGhost(scene, ghost, uiState);
  rebuildProjection(projection, uiState);

  // Re-apply transforms after rebuild
  applyGhostAndProjection();
});

// --- Resize
function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// --- Loop
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
