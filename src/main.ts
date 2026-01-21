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

// -------------------- UI --------------------
const uiShape = document.querySelector<HTMLSelectElement>("#shape")!;
const uiStyle = document.querySelector<HTMLSelectElement>("#style")!;
const uiColor = document.querySelector<HTMLInputElement>("#color")!;
const uiRot = document.querySelector<HTMLInputElement>("#rot")!;

const uiW = document.querySelector<HTMLInputElement>("#w")!;
const uiD = document.querySelector<HTMLInputElement>("#d")!;
const uiH = document.querySelector<HTMLInputElement>("#h")!;

type ShapeId = "box" | "sphere" | "cone" | "cylinder" | "pyramid";
type StyleId = "solid" | "wire" | "solidWire";

let currentShape: ShapeId = (uiShape.value as ShapeId) || "box";
let currentStyle: StyleId = (uiStyle.value as StyleId) || "solid";
let currentColor = new THREE.Color(uiColor.value || "#8a8a9a");
let currentRotY = THREE.MathUtils.degToRad(Number(uiRot.value || 0));

let TILE_W = Number(uiW.value);
let TILE_D = Number(uiD.value);
let TILE_H = Number(uiH.value);

// Ground is a fixed plane: 30 x 30 world units, centered at (0,0,0)
const GRID_SIZE = 30;
const HALF = GRID_SIZE / 2;

// Height level changes by 1 unit with Q/E
const MAX_LEVELS = 50;

function clampPositiveInt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

function readFromUI() {
  TILE_W = clampPositiveInt(Number(uiW.value));
  TILE_D = clampPositiveInt(Number(uiD.value));
  TILE_H = clampPositiveInt(Number(uiH.value));

  currentShape = (uiShape.value as ShapeId) || "box";
  currentStyle = (uiStyle.value as StyleId) || "solid";
  currentColor.set(uiColor.value || "#8a8a9a");
  currentRotY = THREE.MathUtils.degToRad(Number(uiRot.value || 0));
}

// Auto-fill the shape dropdown so you don't need to edit HTML
function ensureShapeOptions() {
  const wanted: Array<{ value: ShapeId; label: string }> = [
    { value: "box", label: "Box" },
    { value: "sphere", label: "Sphere" },
    { value: "cone", label: "Cone" },
    { value: "cylinder", label: "Cylinder" },
    { value: "pyramid", label: "Pyramid" },
  ];

  const existing = new Set(Array.from(uiShape.options).map((o) => o.value));
  for (const it of wanted) {
    if (existing.has(it.value)) continue;
    const opt = document.createElement("option");
    opt.value = it.value;
    opt.textContent = it.label;
    uiShape.appendChild(opt);
  }

  if (!uiShape.value) uiShape.value = "box";
}
ensureShapeOptions();
readFromUI();

// -------------------- Ground --------------------
let ground!: THREE.Mesh;

function buildGround() {
  if (ground) {
    scene.remove(ground);
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
  }

  const groundGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
  groundGeo.rotateX(-Math.PI / 2);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 1 });
  ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = "ground";
  scene.add(ground);
}

buildGround();

// -------------------- Placed objects --------------------
const placed = new THREE.Group();
scene.add(placed);

// -------------------- Geometry factory (current shape) --------------------
function buildGeometryForCurrentShape(): THREE.BufferGeometry {
  const w = Math.max(1, TILE_W);
  const d = Math.max(1, TILE_D);
  const h = Math.max(1, TILE_H);

  const rx = w / 2;
  const rz = d / 2;
  const r = Math.max(rx, rz);

  switch (currentShape) {
    case "box":
      return new THREE.BoxGeometry(w, h, d);

    case "sphere":
      return new THREE.SphereGeometry(r, 24, 16);

    case "cone":
      return new THREE.ConeGeometry(r, h, 24, 1);

    case "cylinder":
      return new THREE.CylinderGeometry(r, r, h, 24, 1);

    case "pyramid":
      // 4-sided pyramid
      return new THREE.ConeGeometry(r, h, 4, 1);

    default:
      return new THREE.BoxGeometry(w, h, d);
  }
}

// -------------------- Materials for styles --------------------
function makeSolidMaterial(color: THREE.Color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
  });
}

function makeTransparentWireMaterial(color: THREE.Color) {
  // Transparent wireframe is easiest with MeshBasicMaterial + wireframe=true
  // (it draws triangle edges, not "box edges", but works well for all shapes)
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
}

function makeEdgeLineMaterial(color: THREE.Color) {
  // Used for "Solid + Wireframe" overlay (crisper edges than triangle wireframe)
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
}

// Build a renderable object for the current style:
// - solid: Mesh only
// - wire: Mesh with wireframe material
// - solidWire: Mesh + wire overlay lines
function buildStyledObject(geo: THREE.BufferGeometry, color: THREE.Color): THREE.Object3D {
  if (currentStyle === "solid") {
    return new THREE.Mesh(geo, makeSolidMaterial(color));
  }

  if (currentStyle === "wire") {
    return new THREE.Mesh(geo, makeTransparentWireMaterial(color));
  }

  // solidWire
  const g = new THREE.Group();

  const solid = new THREE.Mesh(geo, makeSolidMaterial(color));
  g.add(solid);

  // Edges overlay: for round shapes it looks "technical", for box it's perfect
  const edgesGeo = new THREE.EdgesGeometry(geo);
  const edges = new THREE.LineSegments(edgesGeo, makeEdgeLineMaterial(color));
  g.add(edges);

  return g;
}

// -------------------- Ghost (3D preview) --------------------
const ghostColor = new THREE.Color("#ffffff");

// Ghost is also style-aware (uses current style, but white color)
let ghostObj: THREE.Object3D = buildStyledObject(buildGeometryForCurrentShape(), ghostColor);
ghostObj.visible = false;
scene.add(ghostObj);

function rebuildGhostObject() {
  // Remove old
  scene.remove(ghostObj);

  // Dispose old resources
  ghostObj.traverse((child) => {
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

  // Build new
  const geo = buildGeometryForCurrentShape();
  ghostObj = buildStyledObject(geo, ghostColor);
  ghostObj.visible = false;
  scene.add(ghostObj);
}

// -------------------- Projection (2D footprint on ground) --------------------
const projMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.08,
  depthWrite: false,
});

const projection = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
  new THREE.PlaneGeometry(TILE_W, TILE_D),
  projMat
);
projection.rotation.x = -Math.PI / 2;
projection.position.y = 0.02;
projection.visible = false;
scene.add(projection);

function rebuildProjectionGeometry() {
  projection.geometry.dispose();

  let geo: THREE.BufferGeometry;

  if (currentShape === "sphere" || currentShape === "cone" || currentShape === "cylinder") {
    const r = Math.max(TILE_W / 2, TILE_D / 2);
    geo = new THREE.CircleGeometry(r, 48);
  } else {
    geo = new THREE.PlaneGeometry(TILE_W, TILE_D);
  }

  projection.geometry = geo;
}

// -------------------- Raycasting & hover --------------------
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2(1, 1);

function ndcFromEvent(ev: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
}

let currentLevel = 0;

let hoverX = 0;
let hoverZ = 0;
let hasHover = false;

// Clamp based on an axis-aligned footprint (simple & predictable).
// Note: if you rotate a large rectangle, real footprint becomes larger.
// This clamp keeps it easy, even if rotated corners could still go out near edges.
function clampCenterToGround(x: number, z: number) {
  const halfW = TILE_W / 2;
  const halfD = TILE_D / 2;

  const r = Math.max(halfW, halfD);
  const isRound = currentShape === "sphere" || currentShape === "cone" || currentShape === "cylinder";

  const marginX = isRound ? r : halfW;
  const marginZ = isRound ? r : halfD;

  const minX = -HALF + marginX;
  const maxX = HALF - marginX;
  const minZ = -HALF + marginZ;
  const maxZ = HALF - marginZ;

  return {
    x: THREE.MathUtils.clamp(x, minX, maxX),
    z: THREE.MathUtils.clamp(z, minZ, maxZ),
  };
}

function currentShapeCenterY(): number {
  if (currentShape === "sphere") {
    const r = Math.max(TILE_W / 2, TILE_D / 2);
    return currentLevel + r;
  }
  return currentLevel + TILE_H / 2;
}

function updateGhostAndProjection() {
  if (!hasHover) return;

  const yCenter = currentShapeCenterY();

  ghostObj.position.set(hoverX, yCenter, hoverZ);
  ghostObj.rotation.set(0, currentRotY, 0);
  ghostObj.visible = true;

  projection.position.set(hoverX, projection.position.y, hoverZ);
  projection.rotation.z = 0; // keep flat
  projection.rotation.y = 0;
  projection.rotation.x = -Math.PI / 2;

  // Rotate the footprint only for rectangular shapes (looks nice)
  const isRound = currentShape === "sphere" || currentShape === "cone" || currentShape === "cylinder";
  if (!isRound) {
    projection.rotation.y = currentRotY;
  }

  projection.visible = true;
}

function updateHover(ev: PointerEvent) {
  ndcFromEvent(ev);
  raycaster.setFromCamera(mouseNDC, camera);

  const hits = raycaster.intersectObject(ground, false);
  if (!hits.length) {
    hasHover = false;
    ghostObj.visible = false;
    projection.visible = false;
    return;
  }

  const p = hits[0].point;
  const clamped = clampCenterToGround(p.x, p.z);

  hoverX = clamped.x;
  hoverZ = clamped.z;
  hasHover = true;

  updateGhostAndProjection();
}

// -------------------- Place / delete --------------------
function placeObject() {
  if (!hasHover) return;

  const geo = buildGeometryForCurrentShape();
  const obj = buildStyledObject(geo, currentColor);

  obj.position.set(hoverX, currentShapeCenterY(), hoverZ);
  obj.rotation.set(0, currentRotY, 0);

  // Store basic info for debugging / future editor actions
  obj.userData.shape = currentShape;
  obj.userData.style = currentStyle;
  obj.userData.color = `#${currentColor.getHexString()}`;
  obj.userData.rotY = currentRotY;

  placed.add(obj);
}

function deleteClickedObject(ev: PointerEvent) {
  ndcFromEvent(ev);
  raycaster.setFromCamera(mouseNDC, camera);

  const hits = raycaster.intersectObjects(placed.children, true);
  if (!hits.length) return;

  let obj: THREE.Object3D = hits[0].object;
  while (obj.parent && obj.parent !== placed) obj = obj.parent;

  placed.remove(obj);

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

// -------------------- Input --------------------
renderer.domElement.addEventListener("pointermove", updateHover);

renderer.domElement.addEventListener("contextmenu", (ev: MouseEvent) => {
  ev.preventDefault();
});

renderer.domElement.addEventListener("pointerdown", (ev: PointerEvent) => {
  if (ev.button === 0) placeObject();
  if (ev.button === 2) deleteClickedObject(ev);
});

// -------------------- Level controls (Q/E) --------------------
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
    updateGhostAndProjection();
  }

  if (ev.code === "KeyE") {
    ev.preventDefault();
    currentLevel = Math.min(MAX_LEVELS, currentLevel + 1);
    updateGhostAndProjection();
  }
});

// -------------------- UI events --------------------
function onUiChanged() {
  readFromUI();

  rebuildGhostObject();
  rebuildProjectionGeometry();

  if (hasHover) {
    const clamped = clampCenterToGround(hoverX, hoverZ);
    hoverX = clamped.x;
    hoverZ = clamped.z;
    updateGhostAndProjection();
  }
}

uiShape.addEventListener("change", onUiChanged);
uiStyle.addEventListener("change", onUiChanged);
uiColor.addEventListener("input", onUiChanged);
uiRot.addEventListener("input", onUiChanged);
for (const inp of [uiW, uiD, uiH]) {
  inp.addEventListener("input", onUiChanged);
}

// Initial build for projection + ghost
rebuildProjectionGeometry();

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
