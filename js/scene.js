// The travel scene: a pixel-art camel crossing a side-scrolling world.
// Every point = KM_PER_POINT km. Scenery changes by zone; each stop has a landmark.
// Drawn on a small canvas (W x H) and scaled up with crisp pixels.
import { KM_PER_POINT } from "./config.js";
import { ROUTE } from "./ui.js";

// Canvas size in "game pixels". The scene fills the whole window, so these are set
// from the window size: about 5 screen pixels per game pixel.
let W = 384, H = 180, GROUND = 90, CAMEL_X = 96;
function fit(canvas) {
  const vw = window.innerWidth, vh = window.innerHeight;
  H = Math.max(120, Math.min(230, Math.round(vh / 4.6)));
  W = Math.round(H * vw / vh);
  GROUND = Math.round(H * 0.5);
  CAMEL_X = Math.round(Math.min(W * 0.32, 140));
  canvas.width = W; canvas.height = H;
}
const SCREENS = 7; // how many screen-widths the whole journey spans

// ---------- palettes per zone ----------
const ZONES = {
  campus: { sky: ["#7cc3f2", "#d9f1ff"], far: "#86b97c", mid: "#5e9a57", ground: "#4f8a3c", ground2: "#43782f", path: "#d8c48f", light: 1 },
  city:   { sky: ["#6fb2e6", "#d3ecfb"], far: "#a9b9cc", mid: "#7f93aa", ground: "#5f6670", ground2: "#535a63", path: "#e8d65a", light: 1, skyline: true },
  usa:    { sky: ["#64aeea", "#e6f5ff"], far: "#9cbf7f", mid: "#76a05a", ground: "#7f9f48", ground2: "#6f8d3c", path: "#c2a56d", light: 1 },
  ocean:  { sky: ["#4f9fe0", "#d2edfd"], far: "#8fb8d6", mid: "#5f9cc8", ground: "#2e6e9e", ground2: "#28628d", path: "#d8f0ff", light: 1, water: true },
  hills:  { sky: ["#e98d55", "#fcd9a2"], far: "#b5866d", mid: "#8f6553", ground: "#9a7a4c", ground2: "#8a6c41", path: "#dcbb7c", light: 0.9 },
  desert: { sky: ["#ee7f45", "#ffd99b"], far: "#e6ad6c", mid: "#d6924f", ground: "#e8c27c", ground2: "#ddb46c", path: "#f3d79c", light: 0.85, dunes: true },
  levant: { sky: ["#b8648a", "#f8c08c"], far: "#a07a7f", mid: "#7f5e67", ground: "#b59466", ground2: "#a58459", path: "#dcc08c", light: 0.75 },
  holy:   { sky: ["#0d1638", "#2f3d82"], far: "#24306a", mid: "#1a2455", ground: "#cdab63", ground2: "#bd9b55", path: "#f2dc9c", light: 0.45, stars: true, glow: true },
};

// ---------- pixel sprites ----------
// Camel, facing right. Two walking frames. Legend in PAL.
const CAMEL_A = [
  "..............dd.",
  ".............dbbd",
  ".............bbeb",
  ".............bbbb",
  "............bbb..",
  ".....bbb...bbb...",
  "....bbbbb.bbb....",
  "..sssssssbbbb....",
  ".bwwwwwwwbbbb....",
  "dbbbbbbbbbbbb....",
  ".bbbbbbbbbbbb....",
  "..bbbbbbbbbb.....",
  "..bb.b....bb.b...",
  "..b..b....b..b...",
  "..b..b....b..b...",
  "..dd.dd...dd.dd..",
];
const CAMEL_B = CAMEL_A.slice(0, 12).concat([
  "...bb.b..bb.b....",
  "...b..b...b.b....",
  "..b...b..b...b...",
  ".dd...dd.dd..dd..",
]);
const PAL = { b: "#c99353", d: "#7d5127", e: "#1c1c1c", s: "#b3263a", w: "#f1d27a" };

function sprite(ctx, rows, x, y, pal) {
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const k = rows[r][c];
      if (k !== "." && pal[k]) { ctx.fillStyle = pal[k]; ctx.fillRect(x + c, y + r, 1, 1); }
    }
}

// ---------- helpers ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const noise = (x) => Math.sin(x * 0.05) * 0.5 + Math.sin(x * 0.013 + 1.7) * 0.8 + Math.sin(x * 0.11 + 4) * 0.2;

// ---------- landmarks (drawn standing on the ground at screen x) ----------
function rect(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function dome(ctx, c, cx, base, r) { for (let i = 0; i <= r; i++) { const w = Math.round(Math.sqrt(r * r - i * i) * 2); rect(ctx, c, cx - w / 2, base - i, w, 1); } }
function disc(ctx, c, cx, cy, r) { for (let i = -r; i <= r; i++) { const w = Math.round(Math.sqrt(r * r - i * i) * 2); rect(ctx, c, cx - w / 2, cy + i, w, 1); } }
function minaret(ctx, c, x, base, h, cap) { rect(ctx, c, x, base - h, 3, h); rect(ctx, c, x - 1, base - h + 6, 5, 1); rect(ctx, cap, x, base - h - 3, 3, 3); rect(ctx, cap, x + 1, base - h - 5, 1, 2); }
function finial(ctx, cx, top) { rect(ctx, "#f2c94c", cx, top - 4, 1, 3); }

const LANDMARKS = {
  gttower(ctx, x, g) { // brick tower with a gold "T" sign
    rect(ctx, "#8e4b32", x - 12, g - 30, 24, 30); rect(ctx, "#7a3f2a", x - 6, g - 48, 12, 18);
    rect(ctx, "#5c2f20", x - 7, g - 52, 14, 4); rect(ctx, "#f2c94c", x - 3, g - 44, 6, 2); rect(ctx, "#f2c94c", x - 1, g - 42, 2, 6);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) rect(ctx, "#f6e3a3", x - 9 + i * 7, g - 26 + j * 8, 3, 4);
  },
  masjid(ctx, x, g, light = "#f4efe4") {
    rect(ctx, light, x - 16, g - 16, 32, 16); dome(ctx, light, x, g - 16, 10); finial(ctx, x, g - 26);
    minaret(ctx, light, x - 24, g, 34, "#3f7d5c"); minaret(ctx, light, x + 21, g, 34, "#3f7d5c");
    rect(ctx, "#6b5b4a", x - 3, g - 9, 6, 9); for (const dx of [-11, 7]) rect(ctx, "#9aa7b2", x + dx, g - 12, 4, 5);
  },
  tallmasjid(ctx, x, g) {
    rect(ctx, "#f3f1ea", x - 14, g - 14, 28, 14); rect(ctx, "#d9d4c5", x - 14, g - 16, 28, 2);
    minaret(ctx, "#f3f1ea", x + 18, g, 50, "#c9b37a"); rect(ctx, "#6b5b4a", x - 3, g - 9, 6, 9);
  },
  smallmasjid(ctx, x, g) {
    rect(ctx, "#f5f2ea", x - 12, g - 12, 24, 12); dome(ctx, "#4c9a6a", x, g - 12, 6); finial(ctx, x, g - 18);
    rect(ctx, "#6b5b4a", x - 2, g - 7, 4, 7);
  },
  bigmasjid(ctx, x, g) {
    const c = "#ebe3d3";
    rect(ctx, c, x - 26, g - 14, 52, 14); dome(ctx, "#a9b2b8", x, g - 14, 13); dome(ctx, "#a9b2b8", x - 15, g - 14, 6); dome(ctx, "#a9b2b8", x + 15, g - 14, 6); finial(ctx, x, g - 27);
    for (const dx of [-34, -29, 27, 32]) minaret(ctx, c, x + dx, g, dx < -30 || dx > 30 ? 38 : 44, "#a9b2b8");
  },
  goldendome(ctx, x, g) {
    rect(ctx, "#6e8fb8", x - 14, g - 14, 28, 14); for (let i = 0; i < 6; i++) rect(ctx, "#e9edf2", x - 12 + i * 4, g - 12, 2, 6);
    rect(ctx, "#5d7fa8", x - 9, g - 18, 18, 4); dome(ctx, "#f2c230", x, g - 18, 9); finial(ctx, x, g - 27);
  },
  greendome(ctx, x, g, t = 0) {
    for (let r = 34; r > 0; r -= 4) { ctx.globalAlpha = 0.05 + 0.02 * Math.sin(t / 400); dome(ctx, "#ffe9a8", x, g, r); }
    ctx.globalAlpha = 1;
    rect(ctx, "#efe6d2", x - 28, g - 14, 56, 14); dome(ctx, "#2f9e5b", x - 6, g - 14, 9); finial(ctx, x - 6, g - 23);
    minaret(ctx, "#efe6d2", x - 32, g, 40, "#2f9e5b"); minaret(ctx, "#efe6d2", x + 25, g, 40, "#2f9e5b");
    for (let i = 0; i < 6; i++) rect(ctx, "#ffe9a8", x - 24 + i * 8, g - 10, 3, 5);
  },
  building(ctx, x, g) {
    rect(ctx, "#c7b9a0", x - 18, g - 26, 36, 26); rect(ctx, "#b0a185", x - 18, g - 28, 36, 2);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) rect(ctx, "#6f8fb0", x - 14 + i * 8, g - 22 + j * 7, 5, 4);
  },
  spire(ctx, x, g) {
    rect(ctx, "#9aa3ad", x - 3, g - 54, 6, 54); rect(ctx, "#b8c0c9", x - 2, g - 62, 4, 8); rect(ctx, "#ffe9a8", x - 1, g - 66, 2, 4);
  },
};
function gate(ctx, x, g, open) {
  const stone = "#b9a27a";
  rect(ctx, stone, x - 16, g - 30, 6, 30); rect(ctx, stone, x + 10, g - 30, 6, 30); rect(ctx, stone, x - 16, g - 34, 32, 5);
  for (let i = 0; i < 10; i++) { const w = Math.round(Math.sqrt(100 - i * i)) * 2; rect(ctx, stone, x - w / 2, g - 34 - i * 0.6, w, 1); }
  if (!open) { rect(ctx, "#6b4a2b", x - 10, g - 29, 20, 29); rect(ctx, "#4e351e", x - 1, g - 29, 2, 29); rect(ctx, "#d6b25a", x - 4, g - 15, 2, 2); rect(ctx, "#d6b25a", x + 2, g - 15, 2, 2); }
}

// ---------- the scene ----------
export function createScene(canvas, hud) {
  const ctx = canvas.getContext("2d");
  fit(canvas);
  window.addEventListener("resize", () => { fit(canvas); ctx.imageSmoothingEnabled = false; });
  ctx.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let shakeUntil = 0;
  let maxScore = 500, pxPerKm = 1, km = 0, odo = 0, special = false, walking = false, raf = 0, last = 0, dust = [], stepPx = 0;
  const regular = ROUTE.filter((s) => !s.special);
  const sp = ROUTE.find((s) => s.special);
  const kmOf = (s) => (s.special ? maxScore * KM_PER_POINT : s.at * maxScore * KM_PER_POINT);
  const gateKm = () => (kmOf(regular[regular.length - 1]) + kmOf(sp)) / 2 + maxScore * KM_PER_POINT * 0.06;

  function zoneAt(k) {
    // segment i runs from stop i to stop i+1 and uses stop i's zone; blend near the boundary.
    const stops = [...regular, ...(sp ? [{ ...sp, at: null, km: gateKm() }] : [])].map((s) => ({ z: ZONES[s.zone] || ZONES.campus, km: s.km ?? kmOf(s), label: s.zoneLabel }));
    let i = 0; while (i < stops.length - 1 && k >= stops[i + 1].km) i++;
    const a = stops[i], b = stops[i + 1];
    const band = maxScore * KM_PER_POINT * 0.03;
    let t = 0; if (b && k > b.km - band) t = (k - (b.km - band)) / band;
    const z = {}; for (const key of ["far", "mid", "ground", "ground2", "path"]) z[key] = t ? mix(a.z[key], b.z[key], t) : a.z[key];
    z.sky = [0, 1].map((n) => (t ? mix(a.z.sky[n], b.z.sky[n], t) : a.z.sky[n]));
    const cur = t > 0.5 ? b : a;
    return { ...cur.z, ...z, label: cur.label, water: cur.z.water, stars: cur.z.stars, glow: cur.z.glow, skyline: cur.z.skyline, dunes: cur.z.dunes };
  }

  function draw(time) {
    const camX = km * pxPerKm - CAMEL_X;
    const z = zoneAt(km + 40 / pxPerKm);
    // sky in bands for a pixel look
    for (let i = 0; i < 8; i++) rect(ctx, mix(z.sky[0], z.sky[1], i / 7), 0, i * (GROUND / 8), W, Math.ceil(GROUND / 8));
    if (z.stars) { for (let i = 0; i < 90; i++) { const sx = (i * 97 - camX * 0.05) % W, sy = (i * 53) % Math.round(GROUND * 0.7); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time / 500 + i); rect(ctx, "#fff7d6", (sx + W) % W, sy + 4, 1, 1); } ctx.globalAlpha = 1; disc(ctx, "#fff3c4", W - 60, Math.round(GROUND * 0.25), 6); disc(ctx, z.sky[0], W - 57, Math.round(GROUND * 0.25) - 2, 6); }
    else disc(ctx, "#fff4c2", W - 64, Math.round(GROUND * 0.3), 7);
    // far + mid parallax layers
    for (let x = 0; x < W; x++) {
      const wx = x + camX;
      const far = z.skyline ? GROUND - 52 + (Math.floor((wx * 0.3) / 9) * 37 % 23) : GROUND - 40 + noise(wx * 0.3) * 10;
      rect(ctx, z.far, x, GROUND - (GROUND - far), 1, GROUND - far);
      const mid = z.dunes ? GROUND - 18 + Math.sin(wx * 0.6 * 0.03) * 6 : GROUND - 18 + noise(wx * 0.6 + 300) * 5;
      rect(ctx, z.mid, x, mid, 1, GROUND - mid);
    }
    // landmarks
    for (const s of regular) { const sx = kmOf(s) * pxPerKm - camX + (s === regular[0] ? -46 : 52); if (sx > -60 && sx < W + 60) LANDMARKS[s.sprite]?.(ctx, sx, GROUND); }
    if (sp) {
      const gx = gateKm() * pxPerKm - camX; if (gx > -40 && gx < W + 40) gate(ctx, gx, GROUND, special);
      const sx = kmOf(sp) * pxPerKm - camX; if (sx > -60 && sx < W + 60) LANDMARKS[sp.sprite]?.(ctx, sx, GROUND, time);
    }
    // ground
    rect(ctx, z.ground, 0, GROUND, W, H - GROUND);
    if (z.water) {
      for (let row = 0; GROUND + 2 + row * 7 < H; row++) for (let x = 0; x < W; x += 1) { const y = GROUND + 2 + row * 7 + Math.round(Math.sin((x + camX * (1 - row * 0.04)) * 0.15 + time / 300 + row) * 1.2); if ((x + Math.floor(camX) + row * 11) % 23 < 4) rect(ctx, row ? z.ground2 : z.path, x, y, 1, 1); }
    } else {
      for (let row = 0; GROUND + 9 + row * 6 < H; row++) for (let x = 0; x < W; x++) if (((x + Math.floor(camX) + row * 13) % (17 + row % 3 * 7)) < 1 + (row % 2)) rect(ctx, z.ground2, x, GROUND + 9 + row * 6, 1, 1);
      rect(ctx, z.path, 0, GROUND + 2, W, 3);
    }
    // dust / splash
    dust = dust.filter((d) => (d.life -= 1) > 0);
    for (const d of dust) { d.x -= d.vx; d.y -= d.vy; ctx.globalAlpha = d.life / 30; rect(ctx, z.water ? "#e6f6ff" : mix(z.path, "#ffffff", 0.3), d.x, d.y, d.s, d.s); }
    ctx.globalAlpha = 1;
    // camel (bobbing on a raft at sea)
    const frame = walking && Math.floor(stepPx / 6) % 2 ? CAMEL_B : CAMEL_A;
    const bob = z.water ? Math.round(Math.sin(time / 250)) : 0;
    if (z.water) { rect(ctx, "#8a5a2e", CAMEL_X - 6, GROUND - 1 + bob, 30, 3); rect(ctx, "#6d4522", CAMEL_X - 6, GROUND + 2 + bob, 30, 1); rect(ctx, "#6d4522", CAMEL_X + 4, GROUND - 26 + bob, 1, 25); rect(ctx, "#f2efe6", CAMEL_X + 5, GROUND - 25 + bob, 9, 10); }
    const shook = time < shakeUntil ? Math.round(Math.sin(time / 25) * 2) : 0;
    sprite(ctx, frame, CAMEL_X - 8 + shook, GROUND - 16 + (z.water ? -1 + bob : 0) + (walking && frame === CAMEL_B ? -1 : 0), PAL);
    // night glow near the end
    if (z.glow && special) { ctx.globalAlpha = 0.12; rect(ctx, "#ffe08a", 0, 0, W, H); ctx.globalAlpha = 1; }
    // HUD
    if (hud) {
      hud.km.textContent = Math.round(odo).toLocaleString() + " km";
      hud.zone.textContent = z.label || "";
    }
  }

  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function nextStopAfter(k) { return regular.find((s) => kmOf(s) > k + 1) || (special && sp && kmOf(sp) - 60 / pxPerKm > k ? sp : null); }

  return {
    setMax(m) { maxScore = Math.max(1, m); pxPerKm = (384 * SCREENS) / (maxScore * KM_PER_POINT); },
    // a little hop + red flash for a wrong guess
    shake() { shakeUntil = performance.now() + 350; },
    reset() { km = 0; odo = 0; special = false; dust = []; },
    start() { if (!raf) raf = requestAnimationFrame(loop); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    // Travel to a score. Calls onArrive(stop) for each stop passed. Resolves when done.
    travelTo(score, isSpecial, onArrive) {
      special = !!isSpecial;
      let target = score * KM_PER_POINT;
      if (!special && sp) target = Math.min(target, gateKm() - 30 / pxPerKm); // the gate stays shut
      if (special && sp) target = kmOf(sp) - 48 / pxPerKm; // stop in front of it
      const from = km, dist = target - from, odoFrom = odo, odoTo = score * KM_PER_POINT;
      if (reduce || dist <= 0.5) {
        for (const s of regular) if (kmOf(s) > from && kmOf(s) <= target) onArrive?.(s);
        if (special && sp && target > from) onArrive?.(sp);
        km = Math.max(km, target); odo = odoTo; return Promise.resolve();
      }
      const dur = Math.min(4200, 900 + (dist * pxPerKm) * 6);
      const t0 = performance.now();
      const passed = new Set();
      walking = true;
      return new Promise((done) => {
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const prev = km;
          km = from + dist * ease(p);
          odo = odoFrom + (odoTo - odoFrom) * ease(p);
          stepPx += (km - prev) * pxPerKm;
          if (Math.random() < 0.5) dust.push({ x: CAMEL_X - 6, y: GROUND - 1, vx: 0.6 + Math.random(), vy: Math.random() * 0.4, s: 1 + (Math.random() < 0.3), life: 30 });
          for (const s of [...regular, ...(special && sp ? [sp] : [])]) if (!passed.has(s) && kmOf(s) > from && (s.special ? target : kmOf(s)) <= target && km >= (s.special ? target : kmOf(s)) - 0.5) { passed.add(s); onArrive?.(s); }
          if (p < 1) requestAnimationFrame(step); else { walking = false; done(); }
        };
        requestAnimationFrame(step);
      });
    },
    nextStop() { const s = nextStopAfter(km); return s ? { stop: s, km: Math.max(0, Math.round(kmOf(s) - km)) } : sp && !special && kmOf(sp) > km + 1 ? { stop: sp, km: null, locked: true } : null; },
    get km() { return km; },
  };
}

// Tiny mascot for the header.
export function drawMascot(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = 17; canvas.height = 16;
  sprite(ctx, CAMEL_A, 0, 0, PAL);
}
