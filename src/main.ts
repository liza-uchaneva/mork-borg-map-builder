import * as THREE from "three";
import "./style.css";
import { VcrOverlay } from "./utils/vcrOverlay";

import {
  createScene,
  addLights,
  buildGround,
  createCamera,
  createControls,
  setupIsoCamera,
} from "./utils/scene";

import { buildGeometry } from "./utils/editor";

import {
  getUIRefs,
  ensureShapeOptions,
  readUI,
  onUIChange,
  getAppRoot,
  syncUIOutputs,
} from "./utils/ui";

import {
  savePlacedToLocalStorage,
  fetchAllTemplates,
  fetchTemplate,
  loadTemplateIntoPlaced,
  deleteTemplate,
  tagPlacedObject,
} from "./utils/lochalstorage";

import { buildStyledObject, calcCenterY, applyRotation } from "./utils/placement";

import { createProjection, rebuildProjection } from "./utils/projection";
import { createGhost, rebuildGhost } from "./utils/ghost";

import {
  createRay,
  ndcFromEvent,
  deleteClickedObject,
  updateHoverFromGroundHit,
} from "./utils/input";

import type { AppConfig, HoverState } from "./utils/types";

// -------------------- Config --------------------
const cfg: AppConfig = {
  gridSize: 100,
  maxLevels: 100,
  isoY: Math.PI / 4,
  isoTilt: Math.atan(Math.sqrt(2)),
  cameraDistance: 35,
};

// -------------------- App root / scene / renderer --------------------
const app = getAppRoot();

const scene = createScene();
addLights(scene);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

// -------------------- Camera + controls --------------------
const camera = createCamera(app);
const target = new THREE.Vector3(0, 12, 0);
setupIsoCamera(camera, target, cfg);
const controls = createControls(camera, renderer.domElement, target);

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
function updateInspectorCameras() {
  const { center, radius } = getFocusBounds();
  const look = new THREE.Vector3(center.x, center.y + radius * 0.15, center.z);

  // ---------- TOP CAMERA ----------
  const topDist = distanceToFitSphere(radius, topCam.fov, 1.25);

  topCam.position.set(look.x, look.y + topDist, look.z);
  topCam.up.set(0, 0, -1);
  topCam.near = Math.max(0.1, topDist - radius * 4);
  topCam.far = topDist + radius * 8 + 500;
  topCam.lookAt(look);
  topCam.updateProjectionMatrix();
  topCam.updateMatrixWorld(true);

  // ---------- SIDE CAMERA ----------
  // Камера смотрит сбоку, но чуть сверху (чтобы видеть верх объекта и землю).
  const sideDist = distanceToFitSphere(radius, sideCam.fov, 1.35);

  // направление "сбоку" — по +X (можешь сменить на +Z)
  const dir = new THREE.Vector3(1, 0, 0);

  // боковая камера: чуть выше, чем центр
  const sideHeight = radius * 0.6 + 2;

  sideCam.position.copy(look).addScaledVector(dir, sideDist);
  sideCam.position.y += sideHeight;

  sideCam.up.set(0, 1, 0);
  sideCam.near = Math.max(0.1, sideDist - radius * 4);
  sideCam.far = sideDist + radius * 8 + 500;
  sideCam.lookAt(look);
  sideCam.updateProjectionMatrix();
  sideCam.updateMatrixWorld(true);
}


// -------------------- World --------------------
const ground = buildGround(scene, cfg.gridSize);

const placed = new THREE.Group();
placed.name = "placed";
scene.add(placed);

// -------------------- UI --------------------
const ui = getUIRefs();
ensureShapeOptions(ui.shape);
syncUIOutputs(ui);

let uiState = readUI(ui);

// -------------------- Ghost + projection --------------------
let ghost: THREE.Object3D = createGhost(uiState);
scene.add(ghost);

const projection = createProjection();
scene.add(projection);
rebuildProjection(projection, uiState);

// -------------------- Hover / raycasting --------------------
const hover: HoverState = { hasHover: false, x: 0, z: 0 };
const { raycaster, mouseNDC } = createRay();

let currentLevel = 0;

// -------------------- Player mode + VCR overlay --------------------
let isPlayerMode = false;

const playerOverlay = document.getElementById("playerOverlay") as HTMLDivElement | null;
let vcr: VcrOverlay | null = null;
let scanlinesEl: HTMLDivElement | null = null;

function setPlayerMode(on: boolean) {
  isPlayerMode = on;

  document.body.classList.toggle("player-mode", isPlayerMode);

  ui.playerModeBtn.classList.toggle("is-on", isPlayerMode);
  ui.playerModeBtn.textContent = isPlayerMode ? "Player mode: ON" : "Player mode: OFF";

  // Hide editor helpers
  ghost.visible = !isPlayerMode && hover.hasHover;
  projection.visible = !isPlayerMode && hover.hasHover;

  if (!playerOverlay) return;

  if (isPlayerMode) {
    playerOverlay.classList.add("is-on");

    if (!vcr) {
      vcr = new VcrOverlay(playerOverlay, {
        fps: 60,
        blur: 1,
        opacity: 0.3,
        miny: 220,
        miny2: 220,
        num: 20,
      });
    }

    // add scanlines once
    if (!scanlinesEl) {
      scanlinesEl = document.createElement("div");
      scanlinesEl.className = "scanlines";
      playerOverlay.appendChild(scanlinesEl);
    }
  } else {
    playerOverlay.classList.remove("is-on");

    vcr?.destroy();
    vcr = null;

    scanlinesEl?.remove();
    scanlinesEl = null;
  }
}

// -------------------- Saved maps panel --------------------
const saveBtn = document.querySelector<HTMLButtonElement>("#saveMap");
const savedList = document.querySelector<HTMLDivElement>("#savedList");

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function renderSavedList() {
  if (!savedList) return;

  const templates = fetchAllTemplates();

  if (!templates.length) {
    savedList.innerHTML = `<div class="saved-empty">No saved maps yet</div>`;
    return;
  }

  templates.sort((a, b) => b.createdAt - a.createdAt);
  savedList.innerHTML = "";

  for (const t of templates) {
    const row = document.createElement("div");
    row.className = "saved-row";

    const meta = document.createElement("div");
    meta.className = "saved-meta";
    meta.innerHTML = `
      <div class="saved-name">${t.title}</div>
      <div class="saved-sub">${t.blocks.length} objects • ${formatDate(t.createdAt)}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn btn-open";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => {
      const tpl = fetchTemplate(t.id);
      if (!tpl) return;

      loadTemplateIntoPlaced(tpl, placed);

      applyGhostAndProjection();
      renderSavedList();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-del";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      const ok = window.confirm(`Delete "${t.title}"?`);
      if (!ok) return;

      deleteTemplate(t.id);
      renderSavedList();
    });

    actions.appendChild(openBtn);
    actions.appendChild(delBtn);

    row.appendChild(meta);
    row.appendChild(actions);
    savedList.appendChild(row);
  }
}

saveBtn?.addEventListener("click", () => {
  const saved = savePlacedToLocalStorage(placed);
  if (!saved) return;
  renderSavedList();
});

renderSavedList();

// -------------------- Helpers --------------------
function applyGhostAndProjection() {
  if (isPlayerMode) return;

  if (!hover.hasHover) {
    ghost.visible = false;
    projection.visible = false;
    return;
  }

  const y = calcCenterY(uiState.shape, uiState.h, currentLevel, uiState.w, uiState.d);
  ghost.position.set(hover.x, y, hover.z);

  applyRotation(ghost, uiState.rotation);

  ghost.visible = true;

  projection.position.set(hover.x, projection.position.y, hover.z);
  projection.visible = true;
}

function placeObject() {
  if (isPlayerMode) return;
  if (!hover.hasHover) return;

  const color = new THREE.Color(uiState.colorHex);
  const geo = buildGeometry(uiState.shape, uiState);
  const obj = buildStyledObject(geo, uiState.style, color);

  obj.position.set(
    hover.x,
    calcCenterY(uiState.shape, uiState.h, currentLevel, uiState.w, uiState.d),
    hover.z
  );

  applyRotation(obj, uiState.rotation);
  tagPlacedObject(obj, uiState);

  placed.add(obj);
  lastPlaced = obj;
}

let lastPlaced: THREE.Object3D | null = null;

function getFocusObject(): THREE.Object3D | null {
  // если есть ховер — следим за ghost (он показывает текущую позицию размещения)
  if (!isPlayerMode && hover.hasHover) return ghost;

  // иначе — за последним поставленным объектом
  return lastPlaced;
}

function getFocusPoint(out = new THREE.Vector3()): THREE.Vector3 {
  const obj = getFocusObject();
  if (!obj) return out.set(0, 0, 0);

  obj.getWorldPosition(out);
  return out;
}

// -------------------- Hover (pointer move) --------------------
renderer.domElement.addEventListener("pointermove", (ev: PointerEvent) => {
  if (isPlayerMode) return;

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

// -------------------- Click / delete --------------------
renderer.domElement.addEventListener("pointerdown", (ev: PointerEvent) => {
  if (isPlayerMode) return;

  if (ev.button === 0) placeObject();

  if (ev.button === 2) {
    deleteClickedObject(ev, renderer.domElement, raycaster, mouseNDC, camera, placed);
  }
});

// -------------------- Keyboard shortcuts + Q/E --------------------
window.addEventListener("keydown", (ev: KeyboardEvent) => {
  if (isPlayerMode) return;

  // Save: Ctrl/Cmd+S
  if ((ev.ctrlKey || ev.metaKey) && ev.code === "KeyS") {
    ev.preventDefault();
    const saved = savePlacedToLocalStorage(placed);
    if (saved) renderSavedList();
    return;
  }

  // Load: Ctrl/Cmd+O
  if ((ev.ctrlKey || ev.metaKey) && ev.code === "KeyO") {
    ev.preventDefault();

    const all = fetchAllTemplates();
    if (!all.length) {
      alert("No saved templates yet.");
      return;
    }

    console.log("Saved templates:");
    for (const t of all) console.log(`- ${t.title}  (id: ${t.id})  blocks: ${t.blocks.length}`);

    const id = prompt("Paste template id to load (check console for ids):");
    if (!id) return;

    const tpl = fetchTemplate(id);
    if (!tpl) {
      alert("Template not found.");
      return;
    }

    loadTemplateIntoPlaced(tpl, placed);
    renderSavedList();
    applyGhostAndProjection();
    return;
  }

  // Blur inputs so Q/E doesn't type into sliders/selects
  const active = document.activeElement;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLSelectElement ||
    active instanceof HTMLTextAreaElement
  ) {
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

// -------------------- UI change handler --------------------
onUIChange(ui, () => {
  syncUIOutputs(ui);
  uiState = readUI(ui);

  ghost = rebuildGhost(scene, ghost, uiState);
  rebuildProjection(projection, uiState);

  applyGhostAndProjection();
});

ui.playerModeBtn.addEventListener("click", () => {
  setPlayerMode(!isPlayerMode);
});

// -------------------- Resize --------------------
function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// -------------------- Loop --------------------
function tick() {
  controls.update();
  updateInspectorCameras();

  // FULL render (один раз!)
  renderer.setViewport(0, 0, app.clientWidth, app.clientHeight);
  renderer.setScissorTest(false);
  renderer.render(scene, camera);

  // Insets
  const insetW = 220;
  const insetH = 160;
  const pad = 12;

  renderInset(topCam, pad, pad, insetW, insetH, 0x102018); // bottom-left
  renderInset(sideCam, app.clientWidth - insetW - pad, pad, insetW, insetH, 0x201010); // bottom-right

  // важно: выключить scissor после inset’ов
  renderer.setScissorTest(false);

  requestAnimationFrame(tick);
}
tick();
