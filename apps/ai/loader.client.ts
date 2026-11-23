// The Ravel thinking loaders (the glyphs on /branding), standalone so the chat's working line can inline it.
// The working line is replaced on every update and this runs again each time, so the engine and each slot's thread
// (`data-key`) live on window: a new canvas picks the thread up where the old one left it and morphs into its kind.
type Point = [number, number];
type Rgb = number[];
type Shape = { pts: Point[]; twist: number; freq: number; fade: number; dots: number; slow?: number };
type Look = Pick<Shape, "twist" | "freq" | "fade" | "dots">;
type Kind = (n: number, now: number, w: number, h: number) => Shape;
type LoaderCanvas = HTMLCanvasElement & { __ravelLoader?: boolean };
type Mounted = { canvas: LoaderCanvas; glyph: Glyph; colors: Rgb[]; blend: GlobalCompositeOperation };
type Loader = { scan: () => void };

const TAU = Math.PI * 2;
const COUNT = 72;
const BEADS = [0.3, 0.5, 0.7];
const LOOK_KEYS = ["twist", "freq", "fade", "dots"] as const;

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const line = (u: number, w: number, y = 0): Point => [(u - 0.5) * w * 0.84, y];

function tangle(n: number, time: number, speed: number): Point[] {
  const t0 = time * 0.00035 * speed;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * TAU;
    return [
      0.78 * Math.sin(2 * a + t0 * 2.1) + 0.3 * Math.sin(5 * a - t0 * 3) + 0.06 * Math.cos(7 * a + t0),
      0.78 * Math.sin(3 * a + 1.3 - t0 * 1.7) + 0.3 * Math.cos(4 * a + t0 * 2.4) + 0.06 * Math.sin(8 * a - t0),
    ];
  });
}

// Each returns the thread's points around the canvas centre plus how to draw it:
// twist (ply spread in px), freq (ply turns along the line), fade (comet tail), dots (beads).
const KINDS: Record<string, Kind> = {
  unravel(n, now, w, h) {
    const radius = Math.min(w, h) * 0.36, k = smooth(clamp(0.5 - 0.75 * Math.cos(((now % 4200) / 4200) * TAU)));
    const pts = tangle(n, now, 1).map((p, i): Point => {
      const angle = -Math.PI / 2 + (i / (n - 1)) * TAU;
      return [lerp(p[0] * radius * 1.1, Math.cos(angle) * radius, k), lerp(p[1] * radius * 1.1, Math.sin(angle) * radius, k)];
    });
    return { pts, twist: radius * lerp(0.12, 0.05, k), freq: 3, fade: 0, dots: 0 };
  },
  // The closed chat button: a circle that ripples gently.
  idle(n, now, w, h) {
    const radius = Math.min(w, h) * 0.36;
    const pts = Array.from({ length: n }, (_, i): Point => {
      const angle = (i / (n - 1)) * TAU, ripple = 1 + 0.06 * Math.sin(angle * 3 - now * 0.0014) + 0.03 * Math.sin(angle * 5 + now * 0.0009);
      return [Math.cos(angle) * radius * ripple, Math.sin(angle) * radius * ripple];
    });
    return { pts, twist: radius * 0.1, freq: 4, fade: 0, dots: 0, slow: 0.35 };
  },
  knot(n, now, w, h) {
    const radius = Math.min(w, h) * 0.36;
    return { pts: tangle(n, now, 2.6).map((p): Point => [p[0] * radius * 1.1, p[1] * radius * 1.1]), twist: radius * 0.12, freq: 3, fade: 0, dots: 0 };
  },
  orbit(n, now, w, h) {
    const radius = Math.min(w, h) * 0.36, head = now * 0.0042, tail = lerp(1, 4.4, (Math.sin(now * 0.0017) + 1) / 2);
    const pts = Array.from({ length: n }, (_, i): Point => {
      const angle = head - (1 - i / (n - 1)) * tail;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
    return { pts, twist: radius * 0.09, freq: 4, fade: 1, dots: 0 };
  },
  wave(n, now, w, h) {
    const bump = ((now * 0.0006) % 1.5) - 0.25;
    const pts = Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1), falloff = Math.exp(-(((u - bump) / 0.09) ** 2));
      return line(u, w, Math.sin(u * 70 - now * 0.012) * h * 0.3 * falloff);
    });
    return { pts, twist: 0, freq: 1, fade: 0, dots: 0 };
  },
  braid(n, _now, w, h) {
    return { pts: Array.from({ length: n }, (_, i) => line(i / (n - 1), w)), twist: h * 0.24, freq: 2.4, fade: 0, dots: 0 };
  },
  beads(n, now, w, h) {
    const lifts = BEADS.map((_, k) => Math.max(0, Math.sin(now * 0.005 - k * 0.9)));
    const pts = Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1);
      return line(u, w, h * 0.16 * Math.sin(u * Math.PI) - BEADS.reduce((sum, at, k) => sum + lifts[k] * h * 0.32 * Math.exp(-(((u - at) / 0.08) ** 2)), 0));
    });
    return { pts, twist: 0, freq: 1, fade: 0, dots: 1 };
  },
};

const parse = (color: string): Rgb => {
  const hex = color.trim().replace("#", "");
  if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return [0, 2, 4].map((at) => parseInt((hex.length === 3 ? hex.replace(/./g, "$&$&") : hex).slice(at, at + 2), 16));
  return (color.match(/[\d.]+/g) ?? ["255", "255", "255"]).slice(0, 3).map(Number);
};

function threadColor(colors: Rgb[], t: number, alpha: number) {
  const scaled = clamp(t) * 2, low = Math.min(1, Math.floor(scaled)), local = scaled - low;
  const rgb = colors[low].map((channel, k) => Math.round(lerp(channel, colors[low + 1][k], local)));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function stroke(ctx: CanvasRenderingContext2D, points: Point[], colors: Rgb[], alpha: number, width: number, fade: number, offsetT = 0) {
  ctx.lineWidth = width;
  for (let start = 0; start < points.length - 1; start += 4) {
    ctx.beginPath();
    ctx.moveTo(points[start][0], points[start][1]);
    for (let i = start + 1; i <= Math.min(points.length - 1, start + 4); i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = threadColor(colors, (start / points.length + offsetT) % 1.0001, alpha * (1 - fade * (1 - start / points.length)));
    ctx.stroke();
  }
}

class Glyph {
  kind: string;
  from: Point[] | null = null;
  switchedAt = -1e9;
  look: Look | null = null;
  shown: Point[] = [];

  constructor(kind: string) {
    this.kind = kind;
  }

  set(kind: string) {
    if (!KINDS[kind] || kind === this.kind) return;
    this.from = this.shown.length ? this.shown.map((point): Point => [point[0], point[1]]) : null;
    this.kind = kind;
    this.switchedAt = performance.now();
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number, now: number, colors: Rgb[], blend: GlobalCompositeOperation) {
    const target = KINDS[this.kind](COUNT, now, width, height);
    const progress = (now - this.switchedAt) / 1100;
    const from = this.from;
    this.shown = target.pts.map((point, i): Point => {
      if (!from || progress >= 1.4) return point;
      const mix = ease(clamp((progress - (i / COUNT) * 0.4) / 0.6));
      return [lerp(from[i][0], point[0], mix), lerp(from[i][1], point[1], mix)];
    });
    const look = this.look ??= { twist: target.twist, freq: target.freq, fade: target.fade, dots: target.dots };
    const plyPhase = now * 0.004 * (target.slow ?? 1);
    for (const key of LOOK_KEYS) look[key] += (target[key] - look[key]) * 0.08;
    const { freq, fade, dots } = look;
    const weight = clamp(Math.min(width, height) / 40, 1, 1.5), small = weight < 1.5, twist = look.twist * (small ? 0.6 : 1);
    const plies = [0, 1, 2].map((ply) => this.shown.map((point, i): Point => {
      const before = this.shown[Math.max(0, i - 1)], after = this.shown[Math.min(COUNT - 1, i + 1)];
      const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy) || 1;
      const offset = Math.sin((i / COUNT) * freq * TAU - plyPhase + (ply * TAU) / 3) * twist;
      return [width / 2 + point[0] - (dy / length) * offset, height / 2 + point[1] + (dx / length) * offset];
    }));
    ctx.globalCompositeOperation = blend;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    stroke(ctx, plies[0], colors, 0.95, 1.7 * weight * 1.4, fade);
    stroke(ctx, plies[1], colors, 0.55, weight * 1.4, fade, 0.05);
    if (!small) stroke(ctx, plies[2], colors, 0.4, 0.9 * weight * 1.4, fade, 0.1);
    if (dots > 0.02) {
      BEADS.forEach((at, k) => {
        const point = plies[0][Math.round(at * (COUNT - 1))];
        ctx.fillStyle = threadColor(colors, 0.25 + k * 0.3, 1);
        ctx.beginPath();
        ctx.arc(point[0], point[1], Math.max(2.2, height * 0.13) * dots, 0, TAU);
        ctx.fill();
      });
    }
  }
}

function createLoader(): Loader {
  const glyphs: Record<string, Glyph> = {};
  const mounted = new Set<Mounted>();
  let frame = 0;

  function paint(now: number) {
    for (const item of mounted) {
      const { canvas } = item;
      if (!canvas.isConnected) {
        mounted.delete(item);
        continue;
      }
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) continue;
      const ratio = Math.min(3, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
      if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);
      item.glyph.draw(ctx, width, height, now, item.colors, item.blend);
    }
    frame = mounted.size ? requestAnimationFrame(paint) : 0;
  }

  function mount(canvas: LoaderCanvas) {
    if (canvas.__ravelLoader) return;
    const named = canvas.dataset.ravelLoader ?? "";
    const kind = KINDS[named] ? named : "unravel";
    const key = canvas.dataset.key || kind;
    const glyph = glyphs[key] ??= new Glyph(kind);
    glyph.set(kind);
    const given = (canvas.dataset.colors || "").split(",").filter(Boolean).map(parse);
    const colors = given.length === 3 ? given : Array(3).fill(parse(getComputedStyle(canvas).color));
    canvas.__ravelLoader = true;
    mounted.add({ canvas, glyph, colors, blend: (canvas.dataset.blend || "source-over") as GlobalCompositeOperation });
    if (!frame) frame = requestAnimationFrame(paint);
  }

  return { scan: () => document.querySelectorAll<LoaderCanvas>("canvas[data-ravel-loader]").forEach(mount) };
}

const page = globalThis as typeof globalThis & { ravelLoader?: Loader };
(page.ravelLoader ??= createLoader()).scan();
