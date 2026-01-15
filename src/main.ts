import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.style.width = "100vw";
app.style.height = "100vh";
app.style.margin = "0";
app.style.overflow = "hidden";

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0f);

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

// --- Camera (perspective, iso-like) ---
const camera = new THREE.PerspectiveCamera(35, app.clientWidth / app.clientHeight, 0.1, 1000);

const ISO_Y = Math.PI / 4;
const ISO_TILT = Math.atan(Math.sqrt(2));
const CAMERA_DISTANCE = 35;

const target = new THREE.Vector3(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.update();

const y = CAMERA_DISTANCE * Math.sin(ISO_TILT);
const xz = CAMERA_DISTANCE * Math.cos(ISO_TILT);
camera.position.set(xz * Math.cos(ISO_Y), y, xz * Math.sin(ISO_Y));
camera.lookAt(target);

// --- Lights ---
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 20, 10);
scene.add(dir);

// --- UI for tile size ---
const uiW = document.querySelector<HTMLInputElement>("#w")!;
const uiD = document.querySelector<HTMLInputElement>("#d")!;
const uiH = document.querySelector<HTMLInputElement>("#h")!;

let TILE_W = Number(uiW.value);
let TILE_D = Number(uiD.value);
let TILE_H = Number(uiH.value);

const GRID_SIZE = 30;

function clampPositive(n: number) {
  // keep it simple: avoid 0 / NaN
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

function readFromUI() {
  TILE_W = clampPositive(Number(uiW.value));
  TILE_D = clampPositive(Number(uiD.value));
  TILE_H = clampPositive(Number(uiH.value));

  uiW.value = String(TILE_W);
  uiD.value = String(TILE_D);
  uiH.value = String(TILE_H);
}

// --- Ground + grid (rebuilt when tile size changes) ---
let ground: THREE.Mesh;
let grid: THREE.GridHelper;

function buildGroundAndGrid() {
  // remove old
  if (ground) {
    scene.remove(ground);
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
  }
  if (grid) {
    scene.remove(grid);
    // GridHelper has geometry + material(s)
    (grid.geometry as THREE.BufferGeometry).dispose();
    const m = grid.material;
    if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
    else (m as THREE.Material).dispose();
  }

  const worldW = GRID_SIZE;
  const worldD = GRID_SIZE;

  const groundGeo = new THREE.PlaneGeometry(worldW, worldD);
  groundGeo.rotateX(-Math.PI / 2);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 1 });
  ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = "ground";
  scene.add(ground);

  // GridHelper is square, so pick the larger dimension so it covers the whole plane visually
  const gridSize = Math.max(worldW, worldD);
  grid = new THREE.GridHelper(gridSize, GRID_SIZE, 0x2b2b3a, 0x1c1c28);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  grid.position.y = 0.01;
  scene.add(grid);
}

buildGroundAndGrid();

// --- Ghost ---
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25,
});

const ghost = new THREE.Mesh(new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D), ghostMat);
ghost.visible = false;
scene.add(ghost);

function rebuildGhostGeometry() {
  ghost.geometry.dispose();
  ghost.geometry = new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D);
}

// --- Placed tiles ---
const placed = new THREE.Group();
scene.add(placed);

// --- State (stacking) ---
let currentLevel = 0;

type TileKey = string;
function makeKey(gx: number, gz: number, gy: number): TileKey {
  return `${gx},${gz},${gy}`;
}
const tileState = new Map<TileKey, THREE.Mesh>();

// --- Raycasting ---
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2( 1, 1);

function ndcFromEvent(ev: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
}

type Snap = { gx: number; gz: number; world: THREE.Vector3 };
let lastCell: Snap | null = null;

function cellFromPoint(p: THREE.Vector3): Snap {
  const gx = Math.floor(p.x / TILE_W);
  const gz = Math.floor(p.z / TILE_D);

  const x = gx * TILE_W + TILE_W / 2;
  const z = gz * TILE_D + TILE_D / 2;
  const y = currentLevel * TILE_H + TILE_H / 2;

  return { gx, gz, world: new THREE.Vector3(x, y, z) };
}

function findTopLevel(gx: number, gz: number): number {
  let top = -1;
  for (const k of tileState.keys()) {
    const [kx, kz, ky] = k.split(",").map(Number);
    if (kx === gx && kz === gz && ky > top) top = ky;
  }
  return top;
}

function findNextFreeLevel(gx: number, gz: number, startGy: number): number {
  let gy = startGy;
  while (tileState.has(makeKey(gx, gz, gy))) gy++;
  return gy;
}

function updateHover(ev: PointerEvent) {
  ndcFromEvent(ev);
  raycaster.setFromCamera(mouseNDC, camera);

  const hits = raycaster.intersectObject(ground, false);
  if (!hits.length) {
    ghost.visible = false;
    lastCell = null;
    return;
  }

  lastCell = cellFromPoint(hits[0].point);
  ghost.position.copy(lastCell.world);
  ghost.visible = true;
}

function placeTile() {
  if (!ghost.visible || !lastCell) return;

  const gy = findNextFreeLevel(lastCell.gx, lastCell.gz, currentLevel);
  const k = makeKey(lastCell.gx, lastCell.gz, gy);

  const tile = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D),
    new THREE.MeshStandardMaterial({ color: 0x8a8a9a, roughness: 1 })
  );

  tile.position.set(lastCell.world.x, gy * TILE_H + TILE_H / 2, lastCell.world.z);
  placed.add(tile);
  tileState.set(k, tile);
}

function deleteTileAtLevel() {
  if (!ghost.visible || !lastCell) return;

  const k = makeKey(lastCell.gx, lastCell.gz, currentLevel);
  const tile = tileState.get(k);
  if (!tile) return;

  placed.remove(tile);
  tile.geometry.dispose();
  (tile.material as THREE.Material).dispose();
  tileState.delete(k);
}

function deleteTopmostInColumn() {
  if (!ghost.visible || !lastCell) return;

  const top = findTopLevel(lastCell.gx, lastCell.gz);
  if (top < 0) return;

  const k = makeKey(lastCell.gx, lastCell.gz, top);
  const tile = tileState.get(k);
  if (!tile) return;

  placed.remove(tile);
  tile.geometry.dispose();
  (tile.material as THREE.Material).dispose();
  tileState.delete(k);
}

// --- Pointer events ---
renderer.domElement.addEventListener("pointermove", updateHover);

renderer.domElement.addEventListener("contextmenu", (ev: MouseEvent) => {
  ev.preventDefault();
});

renderer.domElement.addEventListener("pointerdown", (ev: PointerEvent) => {
  if (ev.button === 0) placeTile();

  if (ev.button === 2) {
    if (ev.shiftKey) deleteTopmostInColumn();
    else deleteTileAtLevel();
  }
});

// --- Level controls (Q/E) ---
window.addEventListener("keydown", (ev: KeyboardEvent) => {
  const k = ev.key.toLowerCase();
  if (k === "q") currentLevel = Math.max(0, currentLevel - 1);
  if (k === "e") currentLevel = Math.min(50, currentLevel + 1);
  console.log(currentLevel);
  if (ghost.visible && lastCell) {
    ghost.position.set(lastCell.world.x, currentLevel + ghost.geometry.parameters.height / 2, lastCell.world.z);
  }
});

// --- UI events ---
for (const inp of [uiW, uiD, uiH]) {
  inp.addEventListener("input", () => {
    readFromUI();

    // rebuild visuals that depend on tile size
    rebuildGhostGeometry();
    buildGroundAndGrid();

    // refresh hover position immediately (so ghost snaps correctly after resize)
    
    if (ghost.visible && lastCell) {
      const x = lastCell.gx;
      const z = lastCell.gz;
      const y = currentLevel;
      ghost.position.set(x, y, z);
      lastCell.world.set(x, y, z);
    }
  });
}

// --- Resize ---
function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// --- Render loop ---
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
