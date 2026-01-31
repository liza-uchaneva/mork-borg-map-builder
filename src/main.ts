import * as THREE from "three";
import "./style.css";

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

let isPlayerMode = false;

function setPlayerMode(on: boolean) {
  isPlayerMode = on;

  document.body.classList.toggle("player-mode", isPlayerMode);

  ui.playerModeBtn.classList.toggle("is-on", isPlayerMode);
  ui.playerModeBtn.textContent = isPlayerMode ? "Player mode: ON" : "Player mode: OFF";

  // Hide editor helpers in player mode
  ghost.visible = !isPlayerMode && hover.hasHover;
  projection.visible = !isPlayerMode && hover.hasHover;
}

// -------------------- Config --------------------
const cfg: AppConfig = {
  gridSize: 100,
  maxLevels: 100,
  isoY: Math.PI / 4,
  isoTilt: Math.atan(Math.sqrt(2)),
  cameraDistance: 35,
};

// -------------------- Scene / renderer --------------------
const app = getAppRoot();
const scene = createScene();
addLights(scene);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

// -------------------- Camera + controls --------------------
const camera = createCamera(app);
const target = new THREE.Vector3(0, 0, 0);
setupIsoCamera(camera, target, cfg);
const controls = createControls(camera, renderer.domElement, target);

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

  // newest first
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

      // keep hover ghost correct (optional, but feels nicer)
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

// render at startup
renderSavedList();

// -------------------- Helpers --------------------
function applyGhostAndProjection() {
  if (!hover.hasHover) {
    ghost.visible = false;
    projection.visible = false;
    return;
  }

  const y = calcCenterY(uiState.shape, uiState.h, currentLevel, uiState.w, uiState.d);
  ghost.position.set(hover.x, y, hover.z);

  // Apply full XYZ rotation to ghost (mesh or group)
  applyRotation(ghost, uiState.rotation);

  ghost.visible = true;

  // Projection: follows XZ, rotation handled in rebuildProjection(...)
  projection.position.set(hover.x, projection.position.y, hover.z);
  projection.visible = true;
}

function placeObject() {
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

  // IMPORTANT: this is what makes save/load work
  tagPlacedObject(obj, uiState);

  placed.add(obj);
}

// -------------------- Hover --------------------
renderer.domElement.addEventListener("pointermove", (ev: PointerEvent) => {
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
  if (ev.button === 0) placeObject();

  if (ev.button === 2) {
    deleteClickedObject(ev, renderer.domElement, raycaster, mouseNDC, camera, placed);
  }
});

// -------------------- Save (keyboard shortcuts) --------------------
window.addEventListener("keydown", (ev: KeyboardEvent) => {
  if (isPlayerMode) return;
  // Save: Ctrl/Cmd+S
  if ((ev.ctrlKey || ev.metaKey) && ev.code === "KeyS") {
    ev.preventDefault();
    const saved = savePlacedToLocalStorage(placed);
    if (saved) {
      console.log("Saved template:", saved.title, saved.id, `(${saved.blocks.length} blocks)`);
      renderSavedList();
    }
    return;
  }

  // Load: Ctrl/Cmd+O (asks for template id)
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

    const n = loadTemplateIntoPlaced(tpl, placed);
    console.log(`Loaded: ${tpl.title} (${n} blocks)`);
    renderSavedList();
    return;
  }
});

// -------------------- Keyboard (Q/E) --------------------
window.addEventListener("keydown", (ev: KeyboardEvent) => {
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
renderer.domElement.addEventListener("pointerdown", (ev: PointerEvent) => {
  if (isPlayerMode) return;

  if (ev.button === 0) placeObject();

  if (ev.button === 2) {
    deleteClickedObject(ev, renderer.domElement, raycaster, mouseNDC, camera, placed);
  }
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
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
