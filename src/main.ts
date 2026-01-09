import * as THREE from "three";
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

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
const camera = new THREE.PerspectiveCamera(
  35,
  app.clientWidth / app.clientHeight,
  0.1,
  1000
);

const ISO_Y = Math.PI / 4; // 45°
const ISO_TILT = Math.atan(Math.sqrt(2)); // ~54.7356°
const CAMERA_DISTANCE = 35;

const target = new THREE.Vector3(0, 0, 0);
const controls = new TrackballControls(camera, renderer.domElement);

// --- Controls tuning (important) ---
controls.rotateSpeed = 10.0;          // 🔒 lock rotation
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;

controls.noRotate = true;          // 🔒 no free rotation
controls.noZoom = false;
controls.noPan = false;

controls.staticMoving = true;      // snappy editor feel
controls.dynamicDampingFactor = 0.15;

// Keep map center as focus
controls.target.set(0, 0, 0);
controls.update();

  controls.rotateSpeed = 10.0;
// Set distance, then apply “iso” rotation
const y = CAMERA_DISTANCE * Math.sin(ISO_TILT);
const xz = CAMERA_DISTANCE * Math.cos(ISO_TILT);
camera.position.set(
  xz * Math.cos(ISO_Y),
  y,
  xz * Math.sin(ISO_Y)
);
camera.lookAt(target);
// --- Lights ---
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 20, 10);
scene.add(dir);

// --- Ground plane for picking ---
const TILE = 1;
const GRID_SIZE = 30;

const groundGeo = new THREE.PlaneGeometry(GRID_SIZE * TILE, GRID_SIZE * TILE);
groundGeo.rotateX(-Math.PI / 2);

const groundMat = new THREE.MeshStandardMaterial({
  color: 0x111118,
  roughness: 1,
});

const ground = new THREE.Mesh(groundGeo, groundMat);
ground.name = "ground";
scene.add(ground);

// --- Grid helper (visual only) ---
const grid = new THREE.GridHelper(
  GRID_SIZE * TILE,
  GRID_SIZE,
  0x2b2b3a,
  0x1c1c28
);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.35;
grid.position.y = 0.01; // <— prevents z-fighting with the ground plane
scene.add(grid);


// --- Hover “ghost” tile ---
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25,
});
const ghost = new THREE.Mesh(new THREE.BoxGeometry(TILE, TILE, TILE), ghostMat);
ghost.visible = false;
scene.add(ghost);

// --- Placed tiles group ---
const placed = new THREE.Group();
scene.add(placed);

// --- Raycasting ---
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

function ndcFromEvent(ev: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
}

function snapToGrid(p: THREE.Vector3) {
  const x = Math.floor(p.x / TILE) * TILE + TILE / 2;
  const z = Math.floor(p.z / TILE) * TILE + TILE / 2;
  return new THREE.Vector3(x, TILE / 2, z);
}

function updateHover(ev: PointerEvent) {
  ndcFromEvent(ev);
  raycaster.setFromCamera(mouseNDC, camera);

  const hits = raycaster.intersectObject(ground, false);
  if (!hits.length) {
    ghost.visible = false;
    return;
  }

  ghost.position.copy(snapToGrid(hits[0].point));
  ghost.visible = true;
}

function placeTile() {
  if (!ghost.visible) return;

  const tile = new THREE.Mesh(
    new THREE.BoxGeometry(TILE, TILE, TILE),
    new THREE.MeshStandardMaterial({ color: 0x8a8a9a, roughness: 1 })
  );

  tile.position.copy(ghost.position);
  placed.add(tile);
}

// --- Pointer events ---
renderer.domElement.addEventListener("pointermove", updateHover);
renderer.domElement.addEventListener("pointerdown", (ev) => {
  if (ev.button === 0) placeTile();
});

// --- Resize ---
function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;

  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  controls.handleResize();
}

window.addEventListener("resize", resize);
resize();
camera.position.y = Math.max(camera.position.y, 5);

// --- Render loop ---
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
