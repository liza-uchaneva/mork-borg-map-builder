export type ShapeId = "box" | "sphere" | "cone" | "cylinder" | "pyramid";
export type StyleId = "solid" | "wire" | "solidWire";

export type UIState = {
  shape: ShapeId;
  style: StyleId;
  colorHex: string;   // "#rrggbb"
  rotDeg: number;     // 0..360
  w: number;
  d: number;
  h: number;
};

export type HoverState = {
  hasHover: boolean;
  x: number;
  z: number;
};

export type AppConfig = {
  gridSize: number;     // 30
  maxLevels: number;    // 50
  isoY: number;
  isoTilt: number;
  cameraDistance: number;
};

export type UIRefs = {
  shape: HTMLSelectElement;
  style: HTMLSelectElement;
  color: HTMLInputElement;
  rot: HTMLInputElement;
  w: HTMLInputElement;
  d: HTMLInputElement;
  h: HTMLInputElement;
};
