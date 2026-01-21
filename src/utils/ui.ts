import type { ShapeId, StyleId, UIRefs, UIState } from "./types";

function clampPosInt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

export function getUIRefs(): UIRefs {
  const shape = document.querySelector<HTMLSelectElement>("#shape")!;
  const style = document.querySelector<HTMLSelectElement>("#style")!;
  const color = document.querySelector<HTMLInputElement>("#color")!;
  const rot = document.querySelector<HTMLInputElement>("#rot")!;
  const w = document.querySelector<HTMLInputElement>("#w")!;
  const d = document.querySelector<HTMLInputElement>("#d")!;
  const h = document.querySelector<HTMLInputElement>("#h")!;

  return { shape, style, color, rot, w, d, h };
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

export function readUI(refs: UIRefs): UIState {
  return {
    shape: (refs.shape.value as ShapeId) || "box",
    style: (refs.style.value as StyleId) || "solid",
    colorHex: refs.color.value || "#8a8a9a",
    rotDeg: Number(refs.rot.value || 0),
    w: clampPosInt(Number(refs.w.value)),
    d: clampPosInt(Number(refs.d.value)),
    h: clampPosInt(Number(refs.h.value)),
  };
}

export function onUIChange(refs: UIRefs, fn: () => void) {
  refs.shape.addEventListener("change", fn);
  refs.style.addEventListener("change", fn);
  refs.color.addEventListener("input", fn);
  refs.rot.addEventListener("input", fn);
  refs.w.addEventListener("input", fn);
  refs.d.addEventListener("input", fn);
  refs.h.addEventListener("input", fn);
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
