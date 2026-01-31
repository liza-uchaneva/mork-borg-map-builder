export type ShapeId = "box" | "sphere" | "cone" | "cylinder" | "pyramid";
export type StyleId = "solid" | "wire" | "solidWire";

export type Rotation = { x: number; y: number; z: number };

export type UIState = {
  shape: ShapeId;
  style: StyleId;
  colorHex: string;
  rotation: Rotation;
  w: number;
  d: number;
  h: number;
};

export type HoverState = { hasHover: boolean; x: number; z: number };

export type AppConfig = {
  gridSize: number;
  maxLevels: number;
  isoY: number;
  isoTilt: number;
  cameraDistance: number;
};

export type UIRefs = {
  shape: HTMLSelectElement;
  style: HTMLSelectElement;
  color: HTMLInputElement;

  w: HTMLInputElement;
  d: HTMLInputElement;
  h: HTMLInputElement;

  rx: HTMLInputElement;
  ry: HTMLInputElement;
  rz: HTMLInputElement;

  playerModeBtn: HTMLButtonElement;

  wVal?: HTMLOutputElement | null;
  dVal?: HTMLOutputElement | null;
  hVal?: HTMLOutputElement | null;
  rxVal?: HTMLOutputElement | null;
  ryVal?: HTMLOutputElement | null;
  rzVal?: HTMLOutputElement | null;
};


