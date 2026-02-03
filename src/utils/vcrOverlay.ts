function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type VcrOptions = {
  fps?: number;
  blur?: number;
  opacity?: number;
  miny?: number;
  miny2?: number;
  num?: number;
  maxy?: number;
};

export class VcrOverlay {
  private target: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;
  private raf: number | null = null;
  private interval: number | null = null;

  config: Required<Omit<VcrOptions, "maxy">> & { maxy?: number };

  constructor(target: HTMLElement | string, options: VcrOptions = {}) {
    const el =
      typeof target === "string"
        ? (document.querySelector(target) as HTMLElement | null)
        : target;

    if (!el) throw new Error("VcrOverlay: target not found");
    this.target = el;

    this.config = {
        fps: 60,
        blur: 8,
        opacity: 0.2,
        miny: 220,
        miny2: 220,
        num: 20,
      ...options,
    };

    this.canvas = document.createElement("canvas");
    this.canvas.className = "vcr-overlay";
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("VcrOverlay: canvas 2d context unavailable");
    this.ctx = ctx;

    const cs = getComputedStyle(this.target);
    if (cs.position === "static") this.target.style.position = "relative";

    this.target.appendChild(this.canvas);

    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);

    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(this.target);

    this.resize();
    this.start();
  }

  start() {
    this.stop();

    if (this.config.fps >= 60) {
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.interval = window.setInterval(
        () => this.renderTrackingNoise(),
        1000 / this.config.fps
      );
    }
  }

  stop() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    if (this.interval !== null) clearInterval(this.interval);
    this.raf = null;
    this.interval = null;
  }

  destroy() {
    this.stop();
    this.ro.disconnect();
    this.canvas.remove();
  }

  private tick() {
    this.renderTrackingNoise();
    this.raf = requestAnimationFrame(this.tick);
  }

  private resize() {
    const rect = this.target.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width));
    this.canvas.height = Math.max(1, Math.floor(rect.height));
  }

  private renderTrackingNoise(radius = 2, xmax?: number, ymax?: number) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const c = this.config;

    let posy1 = c.miny ?? 0;
    const posy2 = (c.maxy ?? canvas.height);
    let posy3 = c.miny2 ?? 0;
    const num = c.num ?? 20;

    if (xmax === undefined) xmax = canvas.width;
    if (ymax === undefined) ymax = canvas.height;

    canvas.style.filter = `blur(${c.blur}px)`;
    canvas.style.opacity = String(c.opacity);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";

    ctx.beginPath();
    for (let i = 0; i <= num; i++) {
      const x = Math.random() * xmax;
      const y1 = getRandomInt((posy1 += 3), posy2);
      const y2 = getRandomInt(0, (posy3 -= 3));

      ctx.fillRect(x, y1, radius, radius);
      ctx.fillRect(x, y2, radius, radius);

      this.renderTail(ctx, x, y1, radius);
      this.renderTail(ctx, x, y2, radius);
    }
    ctx.closePath();
  }

  private renderTail(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    const n = getRandomInt(1, 50);
    const dir = Math.random() < 0.5 ? 1 : -1;

    let rd = radius;

    for (let i = 0; i < n; i++) {
      const step = 0.01;
      const r = getRandomInt((rd -= step), radius);
      const dx = getRandomInt(1, 4) * dir;

      x += dx;
      ctx.fillRect(x, y, r, r);
    }
  }
}
