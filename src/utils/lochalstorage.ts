import * as THREE from "three";
import type { ShapeId, StyleId, UIState } from "./types";
import { buildGeometry, disposeObject3D } from "./editor";
import { buildStyledObject, applyRotation } from "./placement";

export type SavedBlock = {
  id: string;
  name?: string;
  createdAt: number;

  // Placement
  position: { x: number; y: number; z: number };

  // Visual / params
  shape: ShapeId;
  style: StyleId;
  colorHex: string;
  w: number;
  d: number;
  h: number;
  rotation: { x: number; y: number; z: number };
};

export type SavedTemplate = {
  id: string;
  title: string;
  createdAt: number;
  blocks: SavedBlock[];
};

type LocalStore = {
  saved: SavedTemplate[];
};

const NAMESPACE = "mork_iso_builder__storage_v1";

function defaultStore(): LocalStore {
  return { saved: [] };
}

function readStore(): LocalStore {
  const raw = window.localStorage.getItem(NAMESPACE);
  if (!raw) return defaultStore();

  try {
    const parsed = JSON.parse(raw) as LocalStore;
    if (!parsed || !Array.isArray(parsed.saved)) return defaultStore();
    return parsed;
  } catch {
    return defaultStore();
  }
}

function writeStore(store: LocalStore) {
  window.localStorage.setItem(NAMESPACE, JSON.stringify(store));
}

function uid(): string {
  return Math.floor(Math.random() * 1e12).toString(16);
}

/**
 * We store per-object params in userData when placing:
 * obj.userData.editor = { shape, style, colorHex, w,d,h, rotation }
 */
function extractEditorData(obj: THREE.Object3D): UIState | null {
  const d = obj.userData?.editor;
  if (!d) return null;

  // Light validation / defaults
  return {
    shape: d.shape,
    style: d.style,
    colorHex: d.colorHex,
    w: Number(d.w) || 1,
    d: Number(d.d) || 1,
    h: Number(d.h) || 1,
    rotation: {
      x: Number(d.rotation?.x) || 0,
      y: Number(d.rotation?.y) || 0,
      z: Number(d.rotation?.z) || 0,
    },
  };
}

function setEditorData(obj: THREE.Object3D, ui: UIState) {
  obj.userData.editor = {
    shape: ui.shape,
    style: ui.style,
    colorHex: ui.colorHex,
    w: ui.w,
    d: ui.d,
    h: ui.h,
    rotation: { ...ui.rotation },
  };
}

export function savePlacedToLocalStorage(placed: THREE.Group): SavedTemplate | null {
  const title = window.prompt("Template name?");
  if (!title) return null;

  const blocks: SavedBlock[] = [];

  for (const child of placed.children) {
    const ui = extractEditorData(child);
    if (!ui) continue; // skip objects we didn't create through the editor

    blocks.push({
      id: uid(),
      createdAt: Date.now(),
      name: child.name || undefined,
      position: {
        x: child.position.x,
        y: child.position.y,
        z: child.position.z,
      },
      shape: ui.shape,
      style: ui.style,
      colorHex: ui.colorHex,
      w: ui.w,
      d: ui.d,
      h: ui.h,
      rotation: { ...ui.rotation },
    });
  }

  const template: SavedTemplate = {
    id: uid(),
    title,
    createdAt: Date.now(),
    blocks,
  };

  const store = readStore();
  store.saved.push(template);
  writeStore(store);

  return template;
}

export function fetchAllTemplates(): SavedTemplate[] {
  return readStore().saved;
}

export function fetchTemplate(id: string): SavedTemplate | undefined {
  return readStore().saved.find((t) => t.id === id);
}

export function deleteTemplate(id: string): void {
  const store = readStore();
  store.saved = store.saved.filter((t) => t.id !== id);
  writeStore(store);
}

export function clearAllTemplates(): void {
  writeStore(defaultStore());
}

export function loadTemplateIntoPlaced(
  template: SavedTemplate,
  placed: THREE.Group
): number {
  // Remove current objects
  for (const obj of [...placed.children]) {
    placed.remove(obj);
    disposeObject3D(obj);
  }

  // Rebuild
  for (const b of template.blocks) {
    const ui: UIState = {
      shape: b.shape,
      style: b.style,
      colorHex: b.colorHex,
      w: b.w,
      d: b.d,
      h: b.h,
      rotation: { ...b.rotation },
    };

    const geo = buildGeometry(ui.shape, ui);
    const color = new THREE.Color(ui.colorHex);
    const obj = buildStyledObject(geo, ui.style, color);

    obj.name = b.name ?? "";
    obj.position.set(b.position.x, b.position.y, b.position.z);
    applyRotation(obj, ui.rotation);

    // Important: keep editor metadata for later saves
    setEditorData(obj, ui);

    placed.add(obj);
  }

  return template.blocks.length;
}

export function tagPlacedObject(obj: THREE.Object3D, ui: UIState) {
  setEditorData(obj, ui);
}
