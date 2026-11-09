// src/utils/mapFile.ts
import * as THREE from "three";
import type { ShapeId, StyleId, UIState } from "./types";
import { disposeObject3D, buildGeometry } from "./editor";
import { buildStyledObject, applyRotation } from "./placement";
import { tagPlacedObject, extractEditorData } from "./lochalstorage";

export type MapFileV1 = {
  version?: 1;
  title?: string;
  createdAt: number;
  objects: Array<{
    id: string;
    name?: string;
    createdAt: number;
    position: { x: number; y: number; z: number };
    shape: ShapeId;
    style: StyleId;
    colorHex: string;
    w: number;
    d: number;
    h: number;
    rotation: { x: number; y: number; z: number };
  }>;
};

function downloadTextFile(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function safeFilename(base: string) {
  return base.trim().replace(/[^\w\-]+/g, "_").slice(0, 60) || "map";
}

export function exportPlacedToMapFile(placed: THREE.Group, title?: string): MapFileV1 {
  const objects: MapFileV1["objects"] = [];

  for (const child of placed.children) {
    const ud = extractEditorData(child);
    if (!ud) continue;

    objects.push({
      id: Math.floor(Math.random() * 1e12).toString(16),
      createdAt: Date.now(),
      name: child.name || undefined,
      position: {
        x: child.position.x,
        y: child.position.y,
        z: child.position.z,
      },
      shape: ud.shape,
      style: ud.style,
      colorHex: ud.colorHex,
      w: ud.w || 1,
      d: ud.d || 1,
      h: ud.h,
      rotation: { ...ud.rotation },
    });
  }

  return {
    version: 1,
    title,
    createdAt: Date.now(),
    objects,
  };
}

/**
 * Downloads a JSON map file.
 */
export function exportMapToFile(
  placed: THREE.Group,
  opts?: { title?: string; filename?: string }
) {
  const payload = exportPlacedToMapFile(placed, opts?.title);
  const json = JSON.stringify(payload, null, 2);

  const base = safeFilename(opts?.title ?? "map");
  const filename = opts?.filename ?? `${base}.mork.json`;

  downloadTextFile(filename, json);
}

const SHAPES: readonly ShapeId[] = ["box", "sphere", "cone", "cylinder", "pyramid"];
const STYLES: readonly StyleId[] = ["solid", "wire", "solidWire"];

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function posNum(v: unknown, fallback: number): number {
  const n = num(v, fallback);
  return n > 0 ? n : fallback;
}

function vec3(v: unknown): { x: number; y: number; z: number } {
  const o = (v ?? {}) as Record<string, unknown>;
  return { x: num(o.x, 0), y: num(o.y, 0), z: num(o.z, 0) };
}

function color(v: unknown): string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#8a8a9a";
}

type ParsedRecord = { ui: UIState; position: { x: number; y: number; z: number }; name?: string };

function parseRecord(raw: unknown): ParsedRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const shape = SHAPES.includes(r.shape as ShapeId) ? (r.shape as ShapeId) : "box";
  const style = STYLES.includes(r.style as StyleId) ? (r.style as StyleId) : "solid";

  return {
    ui: {
      shape,
      style,
      colorHex: color(r.colorHex),
      w: posNum(r.w, 3),
      d: posNum(r.d, 3),
      h: posNum(r.h, 2),
      rotation: vec3(r.rotation),
    },
    position: vec3(r.position),
    name: typeof r.name === "string" ? r.name : undefined,
  };
}

/**
 * Import from a JSON File.
 * Validates everything first, then replaces the current placed group.
 */
export async function importMapFromFile(file: File, placed: THREE.Group): Promise<MapFileV1> {
  const text = await file.text();

  let data: Partial<MapFileV1>;
  try {
    data = JSON.parse(text) as Partial<MapFileV1>;
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  if (!data || !Array.isArray(data.objects)) {
    throw new Error('Unsupported map file format (expected { "objects": [...] }).');
  }

  // Parse all records before touching the scene, so a bad file can't leave a half-loaded map.
  const records = data.objects.map(parseRecord);

  // Clear placed
  for (const child of [...placed.children]) {
    placed.remove(child);
    disposeObject3D(child);
  }

  for (const { ui, position, name } of records) {
    const geo = buildGeometry(ui.shape, ui);
    const obj = buildStyledObject(geo, ui.style, new THREE.Color(ui.colorHex));

    obj.position.set(position.x, position.y, position.z);
    applyRotation(obj, ui.rotation);
    if (name) obj.name = name;

    // Keep userData consistent for later saves/deletes/etc.
    tagPlacedObject(obj, ui);

    placed.add(obj);
  }

  return data as MapFileV1;
}
