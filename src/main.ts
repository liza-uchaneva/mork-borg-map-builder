import * as THREE from "three";
import "./style.css";
import { VcrOverlay } from "./scenes/vcrOverlay";
import { createInspectorCameras } from "./scenes/inspectorCameras.ts";

import {
  createScene,
  addLights,
  buildGround,
  createCamera,
  createControls,
  setupIsoCamera,
} from "./scenes/scene";

import { buildGeometry, disposeObject3D } from "./utils/editor";

import {
  getUIRefs,
  ensureShapeOptions,
  readUI,
  onUIChange,
  getAppRoot,
  syncUIOutputs,
} from "./ui/ui";

import {
  savePlacedToLocalStorage,
  fetchAllTemplates,
  fetchTemplate,
  loadTemplateIntoPlaced,
  deleteTemplate,
  tagPlacedObject,
} from "./utils/lochalstorage";

import { buildStyledObject, calcCenterY, applyRotation } from "./utils/placement";

import { createProjection, rebuildProjection } from "./objects/projection";
import { createGhost, rebuildGhost } from "./objects/ghost";

import {
  createRay,
  ndcFromEvent,
  deleteClickedObject,
  updateHoverFromGroundHit,
} from "./utils/picking.ts";

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

const inspector = createInspectorCameras({ scene, renderer, getFocusObject });

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

const placedHistory: THREE.Object3D[] = [];

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

  placedHistory.push(obj);
  lastPlaced = obj;
}
function undoLastPlacement() {
  if (isPlayerMode) return;

  const obj = placedHistory.pop();
  if (!obj) return;

  placed.remove(obj);
  disposeObject3D(obj);

  // обновить lastPlaced на новый “последний” в стеке
  lastPlaced = placedHistory.length ? placedHistory[placedHistory.length - 1] : null;
}


let lastPlaced: THREE.Object3D | null = null;

function getFocusObject(): THREE.Object3D | null {
  if (!isPlayerMode && hover.hasHover) return ghost;
  return lastPlaced;
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

// -------------------- Hide cameras --------------------
const insetTop = document.getElementById("insetTop") as HTMLElement | null;
const insetSide = document.getElementById("insetSide") as HTMLElement | null;

let topCollapsed = false;
let sideCollapsed = false;

document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-collapse]");
  if (!btn) return;

  const kind = btn.dataset.collapse;
  if (kind === "top" && insetTop) {
    topCollapsed = !topCollapsed;
    insetTop.classList.toggle("is-collapsed", topCollapsed);
    btn.setAttribute("aria-expanded", String(!topCollapsed));
    btn.textContent = topCollapsed ? "+" : "–";
  }

  if (kind === "side" && insetSide) {
    sideCollapsed = !sideCollapsed;
    insetSide.classList.toggle("is-collapsed", sideCollapsed);
    btn.setAttribute("aria-expanded", String(!sideCollapsed));
    btn.textContent = sideCollapsed ? "+" : "–";
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

  // Undo: Ctrl+Z / Cmd+Z
  if ((ev.ctrlKey || ev.metaKey) && ev.code === "KeyZ") {
    ev.preventDefault();
    undoLastPlacement();
    applyGhostAndProjection();
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
    placedHistory.length = 0;
    lastPlaced = null;
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

  // --- FULL SCENE ---
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, app.clientWidth, app.clientHeight);
  renderer.render(scene, camera);

  // --- INSPECTORS (ONLY WHEN NOT IN PLAYER MODE) ---
  if (!isPlayerMode) {
    inspector.update();

    const W = app.clientWidth;
    const H = app.clientHeight;

    const insetW = Math.floor(Math.max(180, Math.min(W * 0.26, 320)));
    const insetH = Math.floor(insetW * (160 / 220));
    const pad = Math.floor(Math.max(10, Math.min(W * 0.015, 18)));

    inspector.renderInset(
      inspector.topCam,
      W - insetW - pad,
      H - (insetH + pad) * 2,
      insetW,
      insetH,
      0x102018
    );

    inspector.renderInset(
      inspector.sideCam,
      W - insetW - pad,
      H - insetH - pad,
      insetW,
      insetH,
      0x201010
    );
    renderer.setScissorTest(false);
  }

  requestAnimationFrame(tick);
}
tick();