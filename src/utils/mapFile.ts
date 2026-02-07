// src/utils/mapFile.ts
import * as THREE from "three";
import type { ShapeId, StyleId, UIState } from "./types";
import { disposeObject3D, buildGeometry } from "./editor";
import { buildStyledObject, applyRotation } from "./placement";
import { tagPlacedObject, extractEditorData } from "./lochalstorage";

export type MapFileV1 = {
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

/**
 * Import from a JSON File (versioned).
 * Clears current placed group.
 */
export async function importMapFromFile(file: File, placed: THREE.Group): Promise<MapFileV1> {
  const text = await file.text();
  const data = JSON.parse(text) as Partial<MapFileV1>;

  if (!data || !Array.isArray(data.objects)) {
    throw new Error("Unsupported map file format (expected { version: 1, objects: [] }).");
  }

  // Clear placed
  for (const child of [...placed.children]) {
    placed.remove(child);
    disposeObject3D(child);
  }

  for (const recRaw of data.objects) {
    const rec = recRaw as MapFileV1["objects"][number];

    const shape = (rec.shape ?? "box") as ShapeId;
    const style = (rec.style ?? "solid") as StyleId;

    const w = rec.w;
    const d = rec.d;
    const h = rec.h;

    const colorHex = rec.colorHex;
    const rotation = rec.rotation;
    const position = rec.position;

    // Minimal UIState for your builders
    const uiLike = {
      shape,
      style,
      colorHex,
      w,
      d,
      h,
      rotation,
    } as unknown as UIState;

    const color = new THREE.Color(colorHex);
    const geo = buildGeometry(shape, uiLike);
    const obj = buildStyledObject(geo, style, color);

    obj.position.set(position.x, position.y, position.z);
    applyRotation(obj, rotation);

    if (typeof rec.name === "string") obj.name = rec.name;

    // Keep userData consistent for later saves/deletes/etc.
    tagPlacedObject(obj, uiLike);

    placed.add(obj);
  }

  return data as MapFileV1;
}

// /**
//  * Import from raw JSON string (useful for tests / paste).
//  */
// export function importMapFromJSON(json: string, placed: THREE.Group): MapFileV1 {
//   const data = JSON.parse(json) as Partial<MapFileV1>;
//   if (!data || data.version !== 1 || !Array.isArray(data.objects)) {
//     throw new Error("Unsupported map JSON (expected version: 1).");
//   }

//   // Clear placed
//   for (const child of [...placed.children]) {
//     placed.remove(child);
//     disposeObject3D(child);
//   }

//   for (const recRaw of data.objects) {
//     const rec = recRaw as MapFileV1["objects"][number];

//     const shape = (rec.shape ?? "box") as ShapeId;
//     const style = (rec.style ?? "solid") as StyleId;

//     const w = safeNum(rec.w, 3);
//     const d = safeNum(rec.d, 3);
//     const h = safeNum(rec.h, 2);

//     const colorHex = safeColor(rec.colorHex);
//     const rotation = safeRotation(rec.rotation);
//     const position = safePosition(rec.position);

//     const uiLike = {
//       shape,
//       style,
//       colorHex,
//       w,
//       d,
//       h,
//       rotation,
//     } as unknown as UIState;

//     const geo = buildGeometry(shape, uiLike);
//     const obj = buildStyledObject(geo, style, new THREE.Color(colorHex));

//     obj.position.set(position.x, position.y, position.z);
//     applyRotation(obj, rotation);

//     if (typeof rec.name === "string") obj.name = rec.name;

//     tagPlacedObject(obj, uiLike);
//     placed.add(obj);
//   }

//   return data as MapFileV1;
// }
