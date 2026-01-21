import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.style.width = "100vw";
app.style.height = "100vh";
app.style.margin = "0";
app.style.overflow = "hidden";

// -------------------- Scene --------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0f);

// -------------------- Renderer --------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

// -------------------- Camera (perspective, iso-like) --------------------
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

// -------------------- Lights --------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 20, 10);
scene.add(dir);

// -------------------- UI (brush size) --------------------
const uiW = document.querySelector<HTMLInputElement>("#w")!;
const uiD = document.querySelector<HTMLInputElement>("#d")!;
const uiH = document.querySelector<HTMLInputElement>("#h")!;

let TILE_W = Number(uiW.value);
let TILE_D = Number(uiD.value);
let TILE_H = Number(uiH.value);

// Field is 30x30 world units, centered at (0,0,0)
const GRID_SIZE = 30;

// Base voxel cell size (do not change unless you redesign the editor)
const CELL = 1;

// Height levels limit used for capacity (your request)
const MAX_LEVELS = 50;

// Instanced capacity = field area * max levels
const CAPACITY = GRID_SIZE * GRID_SIZE * MAX_LEVELS;

function clampPositiveInt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

function readFromUI() {
  TILE_W = clampPositiveInt(Number(uiW.value));
  TILE_D = clampPositiveInt(Number(uiD.value));
  TILE_H = clampPositiveInt(Number(uiH.value));

  uiW.value = String(TILE_W);
  uiD.value = String(TILE_D);
  uiH.value = String(TILE_H);
}

// -------------------- Ground + grid --------------------
let ground: THREE.Mesh;
let grid: THREE.GridHelper;

function buildGroundAndGrid() {
  if (ground) {
    scene.remove(ground);
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
  }
  if (grid) {
    scene.remove(grid);
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

  const gridSize = Math.max(worldW, worldD);
  grid = new THREE.GridHelper(gridSize, GRID_SIZE, 0x2b2b3a, 0x1c1c28);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  grid.position.y = 0.01;
  scene.add(grid);
}

buildGroundAndGrid();

// -------------------- Ghost (shows brush volume bounds) --------------------
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

// -------------------- Instanced voxels state --------------------
// Each occupied cell => instance index
type CellKey = string;
function makeKey(x: number, z: number, y: number): CellKey {
  return `${x},${z},${y}`;
}
function parseKey(key: CellKey): [number, number, number] {
  const [x, z, y] = key.split(",").map(Number);
  return [x, z, y];
}

const cellToIndex = new Map<CellKey, number>();
const indexToCell: CellKey[] = [];

// One instanced mesh for all cubes
const voxelGeo = new THREE.BoxGeometry(CELL, CELL, CELL);
const voxelMat = new THREE.MeshStandardMaterial({ color: 0x8a8a9a, roughness: 1 });
const voxels = new THREE.InstancedMesh(voxelGeo, voxelMat, CAPACITY);
voxels.count = 0;
scene.add(voxels);

// Helper for writing transforms
const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3(1, 1, 1);

// Field bounds in world units (centered)
const HALF_W = GRID_SIZE / 2;
const HALF_D = GRID_SIZE / 2;

// Convert world coordinate to voxel grid coordinate, clamped to field
function worldToVoxelX(x: number) {
  // voxel centers at integer+0.5; voxel indices are integers in [-HALF .. HALF-1]
  return Math.floor(x);
}
function worldToVoxelZ(z: number) {
  return Math.floor(z);
}
function isInsideField(vx: number, vz: number) {
  return vx >= -HALF_W && vx < HALF_W && vz >= -HALF_D && vz < HALF_D;
}

function setInstanceAt(index: number, vx: number, vz: number, vy: number) {
  // Voxel center in world space
  _pos.set(vx + 0.5, vy + 0.5, vz + 0.5);
  _quat.identity();
  _scl.set(1, 1, 1);
  _mat.compose(_pos, _quat, _scl);
  voxels.setMatrixAt(index, _mat);
}

// Add a voxel if the cell is free
function addVoxel(vx: number, vz: number, vy: number) {
  if (!isInsideField(vx, vz)) return;

  const key = makeKey(vx, vz, vy);
  if (cellToIndex.has(key)) return; // prevent duplicates

  const idx = voxels.count;
  if (idx >= CAPACITY) {
    console.warn("InstancedMesh capacity reached; increase CAPACITY.");
    return;
  }

  setInstanceAt(idx, vx, vz, vy);

  voxels.count++;
  voxels.instanceMatrix.needsUpdate = true;

  cellToIndex.set(key, idx);
  indexToCell[idx] = key;
}

// Remove a voxel by swapping with the last instance
function removeVoxel(vx: number, vz: number, vy: number) {
  const key = makeKey(vx, vz, vy);
  const idx = cellToIndex.get(key);
  if (idx === undefined) return;

  const last = voxels.count - 1;
  if (last < 0) return;

  // If removing not-last, move last into removed slot
  if (idx !== last) {
    voxels.getMatrixAt(last, _mat);
    voxels.setMatrixAt(idx, _mat);

    const movedKey = indexToCell[last];
    cellToIndex.set(movedKey, idx);
    indexToCell[idx] = movedKey;
  }

  // Shrink active instances
  voxels.count = last;
  voxels.instanceMatrix.needsUpdate = true;

  // Remove mappings
  cellToIndex.delete(key);
  indexToCell.pop();
}

// -------------------- Placement / deletion logic --------------------
let currentLevel = 0;

// Convert hover (world center) + brush size into voxel ranges
function getBrushBoundsFromCenter(centerX: number, centerZ: number, baseY: number) {
  // Anchor brush so it spans exactly TILE_W/TILE_D/TILE_H voxels
  const startX = Math.floor(centerX - TILE_W / 2);
  const startZ = Math.floor(centerZ - TILE_D / 2);
  const startY = baseY;

  return { startX, startZ, startY };
}

// Delete volume equal to current ghost at the selected level
function eraseBrushVolumeAtCurrentLevel() {
  if (!ghost.visible || !lastCell) return;

  const baseY = currentLevel * CELL;
  const { startX, startZ, startY } = getBrushBoundsFromCenter(lastCell.world.x, lastCell.world.z, baseY);

  for (let y = 0; y < TILE_H; y++) {
    for (let z = 0; z < TILE_D; z++) {
      for (let x = 0; x < TILE_W; x++) {
        removeVoxel(startX + x, startZ + z, startY + y);
      }
    }
  }
}

// Shift+RightClick: delete topmost single voxel in the column under cursor
function eraseTopmostInColumn() {
  if (!ghost.visible || !lastCell) return;

  const vx = worldToVoxelX(lastCell.world.x);
  const vz = worldToVoxelZ(lastCell.world.z);
  if (!isInsideField(vx, vz)) return;

  let topY = -Infinity;
  let topKey: CellKey | null = null;

  // Simple scan (OK for a pet project; optimize later if needed)
  for (const key of cellToIndex.keys()) {
    const [kx, kz, ky] = parseKey(key);
    if (kx === vx && kz === vz && ky > topY) {
      topY = ky;
      topKey = key;
    }
  }

  if (!topKey) return;
  const [kx, kz, ky] = parseKey(topKey);
  removeVoxel(kx, kz, ky);
}

// Auto-stack: find the first Y level where at least one voxel in the column is free,
// starting from currentLevel; then place the whole volume (skipping occupied cells).
function placeBrushVolumeAutoStack() {
  if (!ghost.visible || !lastCell) return;

  // Compute X/Z brush origin based on hover center
  const baseX = Math.floor(lastCell.world.x - TILE_W / 2);
  const baseZ = Math.floor(lastCell.world.z - TILE_D / 2);

  // Start Y from selected level (in voxels)
  let baseY = currentLevel * CELL;

  // Find next free "baseY" where at least one cell in the first layer is free.
  // This preserves your editor feeling without adding strict collision rules.
  // If you want "all cells must be free" later, we can change this check.
  const MAX_TRIES = MAX_LEVELS;
  for (let i = 0; i < MAX_TRIES; i++) {
    let anyFree = false;

    for (let z = 0; z < TILE_D && !anyFree; z++) {
      for (let x = 0; x < TILE_W && !anyFree; x++) {
        const vx = baseX + x;
        const vz = baseZ + z;

        if (!isInsideField(vx, vz)) continue;

        const key = makeKey(vx, vz, baseY);
        if (!cellToIndex.has(key)) anyFree = true;
      }
    }

    if (anyFree) break;
    baseY += 1; // move up by 1 voxel
  }

  // Place volume (skip occupied cells, skip out-of-field)
  for (let y = 0; y < TILE_H; y++) {
    for (let z = 0; z < TILE_D; z++) {
      for (let x = 0; x < TILE_W; x++) {
        addVoxel(baseX + x, baseZ + z, baseY + y);
      }
    }
  }
}

// -------------------- Raycasting & hover --------------------
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2(1, 1);

function ndcFromEvent(ev: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
}

type Snap = { gx: number; gz: number; world: THREE.Vector3 };
let lastCell: Snap | null = null;

// Keep your existing "grid based on TILE_W/TILE_D" hover logic (no behavior change),
// but clamp center inside the field so big brushes still behave predictably.
function cellFromPoint(p: THREE.Vector3): Snap {
  const gx = Math.floor(p.x / TILE_W);
  const gz = Math.floor(p.z / TILE_D);

  let x = gx * TILE_W + TILE_W / 2;
  let z = gz * TILE_D + TILE_D / 2;

  // Clamp the brush center so the volume does not drift too far outside the field
  x = THREE.MathUtils.clamp(x, -HALF_W + 0.5, HALF_W - 0.5);
  z = THREE.MathUtils.clamp(z, -HALF_D + 0.5, HALF_D - 0.5);

  const y = currentLevel + TILE_H / 2;
  return { gx, gz, world: new THREE.Vector3(x, y, z) };
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

// -------------------- Input --------------------
renderer.domElement.addEventListener("pointermove", updateHover);

renderer.domElement.addEventListener("contextmenu", (ev: MouseEvent) => {
  ev.preventDefault();
});

renderer.domElement.addEventListener("pointerdown", (ev: PointerEvent) => {
  if (ev.button === 0) placeBrushVolumeAutoStack();

  if (ev.button === 2) {
    if (ev.shiftKey) eraseTopmostInColumn(); // variant B
    else eraseBrushVolumeAtCurrentLevel();   // delete volume equal to ghost
  }
});

// -------------------- Level controls (Q/E) --------------------
window.addEventListener("keydown", (ev: KeyboardEvent) => {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || 
      active instanceof HTMLSelectElement || 
      active instanceof HTMLTextAreaElement) {
    active.blur();
  }

  if (ev.code === "KeyQ") {
    ev.preventDefault();
    currentLevel = Math.max(0, currentLevel - 1);
  }

  if (ev.code === "KeyE") {
    ev.preventDefault();
    currentLevel = Math.min(MAX_LEVELS, currentLevel + 1);
  }

  if (ghost.visible && lastCell) {
    const newY = currentLevel + TILE_H / 2;
    ghost.position.set(lastCell.world.x, newY, lastCell.world.z);
    lastCell.world.y = newY;
  }
});


// -------------------- UI events --------------------
for (const inp of [uiW, uiD, uiH]) {
  inp.addEventListener("input", () => {
    readFromUI();
    rebuildGhostGeometry();
    buildGroundAndGrid();

    // Keep ghost position consistent after resizing brush
    if (ghost.visible && lastCell) {
      const y = currentLevel * TILE_H + TILE_H / 2;
      ghost.position.set(lastCell.world.x, y, lastCell.world.z);
      lastCell.world.y = y;
    }
  });
}

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
