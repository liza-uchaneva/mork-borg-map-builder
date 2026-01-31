import type { ShapeId, StyleId, UIRefs, UIState } from "./types";

function qs<T extends Element>(sel: string) {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing UI element: ${sel}`);
  return el;
}

function clampPositiveInt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

export function getUIRefs(): UIRefs {
  return {
    shape: qs<HTMLSelectElement>("#shape"),
    style: qs<HTMLSelectElement>("#style"),
    color: qs<HTMLInputElement>("#color"),

    w: qs<HTMLInputElement>("#w"),
    d: qs<HTMLInputElement>("#d"),
    h: qs<HTMLInputElement>("#h"),

    rx: qs<HTMLInputElement>("#rx"),
    ry: qs<HTMLInputElement>("#ry"),
    rz: qs<HTMLInputElement>("#rz"),

    playerModeBtn: qs<HTMLButtonElement>("#playerModeBtn"),

    wVal: document.querySelector<HTMLOutputElement>("#wVal"),
    dVal: document.querySelector<HTMLOutputElement>("#dVal"),
    hVal: document.querySelector<HTMLOutputElement>("#hVal"),

    rxVal: document.querySelector<HTMLOutputElement>("#rxVal"),
    ryVal: document.querySelector<HTMLOutputElement>("#ryVal"),
    rzVal: document.querySelector<HTMLOutputElement>("#rzVal"),
  };
}

export function ensureShapeOptions(select: HTMLSelectElement) {
  const wanted: Array<{ value: ShapeId; label: string }> = [
    { value: "box", label: "Box" },
    { value: "sphere", label: "Sphere" },
    { value: "cone", label: "Cone" },
    { value: "cylinder", label: "Cylinder" },
    { value: "pyramid", label: "Pyramid" },
  ];

  const existing = new Set(Array.from(select.options).map((o) => o.value));
  for (const it of wanted) {
    if (existing.has(it.value)) continue;
    const opt = document.createElement("option");
    opt.value = it.value;
    opt.textContent = it.label;
    select.appendChild(opt);
  }

  if (!select.value) select.value = "box";
}

export function syncUIOutputs(refs: UIRefs) {
  if (refs.wVal) refs.wVal.textContent = refs.w.value;
  if (refs.dVal) refs.dVal.textContent = refs.d.value;
  if (refs.hVal) refs.hVal.textContent = refs.h.value;

  if (refs.rxVal) refs.rxVal.textContent = refs.rx.value;
  if (refs.ryVal) refs.ryVal.textContent = refs.ry.value;
  if (refs.rzVal) refs.rzVal.textContent = refs.rz.value;
}

export function readUI(refs: UIRefs): UIState {
  return {
    shape: refs.shape.value as ShapeId,
    style: refs.style.value as StyleId,
    colorHex: refs.color.value || "#8a8a9a",

    w: clampPositiveInt(Number(refs.w.value)),
    d: clampPositiveInt(Number(refs.d.value)),
    h: clampPositiveInt(Number(refs.h.value)),

    rotation: {
      x: Number(refs.rx.value) || 0,
      y: Number(refs.ry.value) || 0,
      z: Number(refs.rz.value) || 0,
    },
  };
}

export function onUIChange(refs: UIRefs, fn: () => void) {
  const inputs: Array<HTMLInputElement | HTMLSelectElement> = [
    refs.shape,
    refs.style,
    refs.color,
    refs.w,
    refs.d,
    refs.h,
    refs.rx,
    refs.ry,
    refs.rz,
  ];

  for (const el of inputs) {
    el.addEventListener("input", fn);
    el.addEventListener("change", fn);
  }
}

export function getAppRoot(): HTMLDivElement {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing element: #app");

  app.style.width = "100vw";
  app.style.height = "100vh";
  app.style.margin = "0";
  app.style.overflow = "hidden";

  return app;
}
