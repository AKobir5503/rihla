// The travel scene: a pixel-art traveler crossing a side-scrolling world.
// Every point = KM_PER_POINT km. Scenery changes by zone; each stop has a landmark.
// Drawn on a small canvas (W x H) and scaled up with crisp pixels.
import { KM_PER_POINT } from "./config.js";
import { ROUTE } from "./ui.js";

// Canvas size in "game pixels". The scene fills the whole window, so these are set
// from the window size: about 5 screen pixels per game pixel.
let W = 384, H = 180, GROUND = 90, HERO_X = 96;
function fit(canvas) {
  const vw = window.innerWidth, vh = window.innerHeight;
  H = Math.max(120, Math.min(230, Math.round(vh / 4.6)));
  W = Math.round(H * vw / vh);
  GROUND = Math.round(H * 0.6);
  HERO_X = Math.round(Math.min(W * 0.32, 140));
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
// The traveler: an original yellow jacket in a white thobe and kufi, with a satchel. Facing right.
const HERO_A = [
  "...........k...k..",
  "............k.k...",
  "..........ccccc...",
  ".........ccccccc..",
  ".........kkkkkkk..",
  ".........yyyyyyy..",
  ".........yyyeeky..",
  ".........yyyeeky..",
  ".........yyyyyyyy.",
  "..........yyyyk...",
  "..........tttt....",
  ".........tsttt....",
  "........ttstttt...",
  "..kyyky.tttsttty..",
  ".kyykyktttttsttyy.",
  ".kyykykttttbbbt...",
  "..kykyk.tttbbbt...",
  "...kk...tttttttt..",
  "........tttttttt..",
  "........uuuuuuuu..",
  ".........k....k...",
  "........kk...kk...",
];
const HERO_B = HERO_A.slice(0, 20).concat([
  "..........k..k....",
  ".........kk.kk....",
]);
const WING_A = [".ww...", "wwww..", "wwwwww", ".wwwww"];
const WING_B = ["......", ".www..", "wwwwww", "wwwwww"];
const HERO_H = HERO_A.length;
const PAL = { y: "#f2c230", k: "#1d1a16", c: "#ffffff", e: "#ffffff", t: "#f4f1ea", u: "#d6cfbf", s: "#8a5a2e", b: "#a46a34", w: "#cfe9fb" };
const OUTLINE = Object.fromEntries(Object.keys(PAL).map((k) => [k, "#2a2112"]));

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
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
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
// ---------- little world details ----------
const SKIN = ["#f1c9a5", "#d9a47a", "#b07a52", "#7d5236", "#5a3a26"];
const CLOTH = ["#2f6db3", "#b3263a", "#3f7d5c", "#e3b23c", "#6b4fa0", "#e07a3a", "#3b3b46", "#f4f1ea", "#2b9aa0"];
// A 4x8 pixel person facing dir (1 right, -1 left). kind: 0 student w/ backpack, 1 thobe, 2 hijab, 3 kid
function person(ctx, x, g, kind, c1, c2, skin, frame, dir) {
  x = Math.round(x);
  const kid = kind === 3, top = g - (kid ? 6 : 8);
  if (kind === 2) { rect(ctx, c2, x, top, 4, 3); rect(ctx, skin, x + (dir > 0 ? 2 : 0), top + 1, 2, 2); rect(ctx, c1, x, top + 3, 4, 5); }
  else {
    rect(ctx, skin, x + 1, top, 2, 2); rect(ctx, kind === 1 ? "#f4f1ea" : "#2a2019", x + 1, top, 2, 1);
    rect(ctx, kind === 1 ? "#f4f1ea" : c1, x, top + 2, 4, kind === 1 ? 5 : 3);
    if (kind === 0) rect(ctx, c2, x + (dir > 0 ? -1 : 4), top + 2, 1, 3);
    if (kind !== 1) { const leg = "#2d3140"; if (frame) { rect(ctx, leg, x, g - 3 + (kid ? 1 : 0), 1, kid ? 2 : 3); rect(ctx, leg, x + 3, g - 3 + (kid ? 1 : 0), 1, kid ? 2 : 3); } else rect(ctx, leg, x + 1, g - 3 + (kid ? 1 : 0), 2, kid ? 2 : 3); }
    else rect(ctx, "#2a2019", x + (frame ? 0 : 1), g - 1, frame ? 4 : 2, 1);
  }
  if (kind === 2) rect(ctx, "#2a2019", x + (frame ? 0 : 1), g - 1, frame ? 4 : 2, 1);
}
function tree(ctx, x, g, kind, sway) {
  if (kind === "palm") {
    for (let i = 0; i < 16; i++) rect(ctx, "#8a6236", x + Math.round(Math.sin(i / 6) * 2), g - i, 2, 1);
    const tx = x + 2, ty = g - 17;
    for (const [dx, dy] of [[-5, 1], [-3, 0], [-1, -1], [1, -1], [3, 0], [5, 1], [-6, 2], [6, 2]]) rect(ctx, "#3f8a3a", tx + dx + sway, ty + dy, 2, 1);
    rect(ctx, "#2f6e2c", tx - 2 + sway, ty - 1, 4, 2); rect(ctx, "#6b4a22", tx - 1, ty + 1, 2, 1);
  } else if (kind === "lamp") {
    rect(ctx, "#3b3f48", x, g - 18, 1, 18); rect(ctx, "#3b3f48", x, g - 18, 4, 1); rect(ctx, "#ffe9a8", x + 3, g - 17, 2, 2);
  } else if (kind === "olive") {
    rect(ctx, "#6b5238", x, g - 6, 2, 6); disc(ctx, "#7f9a5b", x + 1 + sway, g - 10, 4); rect(ctx, "#93ad6c", x - 1 + sway, g - 13, 3, 1);
  } else if (kind === "rock") {
    rect(ctx, "#8b8178", x, g - 3, 5, 3); rect(ctx, "#a59a8f", x + 1, g - 4, 3, 1);
  } else if (kind === "bush") {
    disc(ctx, "#3f7a38", x + 2, g - 2, 3); rect(ctx, "#5c9a4f", x + 1, g - 4, 2, 1);
  } else { // round tree
    rect(ctx, "#6b4a2b", x, g - 7, 2, 7); disc(ctx, "#3e7f3a", x + 1 + sway, g - 12, 5); rect(ctx, "#5a9a4e", x - 1 + sway, g - 15, 3, 1); rect(ctx, "#5a9a4e", x + 2 + sway, g - 13, 2, 1);
  }
}
const PROPS = { campus: ["tree", "tree", "bush", "lamp"], city: ["lamp", "tree", "lamp"], usa: ["tree", "bush", "tree", "rock"], hills: ["olive", "tree", "rock"], desert: ["palm", "rock", "palm"], levant: ["olive", "palm", "rock"], holy: ["palm", "palm", "lamp"] };
function cloud(ctx, x, y, w) { ctx.globalAlpha = 0.85; rect(ctx, "#ffffff", x, y, w, 3); rect(ctx, "#ffffff", x + 3, y - 2, Math.max(3, w - 8), 2); rect(ctx, "#ffffff", x + 6, y - 3, Math.max(2, w - 14), 1); rect(ctx, "#e4eef6", x + 1, y + 3, w - 2, 1); ctx.globalAlpha = 1; }
function bird(ctx, x, y, frame, c) { x = Math.round(x); y = Math.round(y); rect(ctx, c, x, y, 1, 1); if (frame) { rect(ctx, c, x - 1, y - 1, 1, 1); rect(ctx, c, x + 1, y - 1, 1, 1); rect(ctx, c, x - 2, y - 1, 1, 1); rect(ctx, c, x + 2, y - 1, 1, 1); } else { rect(ctx, c, x - 1, y, 1, 1); rect(ctx, c, x + 1, y, 1, 1); rect(ctx, c, x - 2, y + 1, 1, 1); rect(ctx, c, x + 2, y + 1, 1, 1); } }

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

  // ---------- world layout (in world pixels) ----------
  let flatXs = [], props = [], people = [];
  const rawZone = (k) => { let z = regular[0]; for (const s of regular) if (kmOf(s) <= k) z = s; if (sp && k >= gateKm()) z = sp; return z.zone; };
  const landX = (s) => kmOf(s) * pxPerKm + (s === regular[0] ? -46 : s.special ? 0 : 52);
  function build() {
    flatXs = [...regular.map(landX), ...(sp ? [landX(sp), gateKm() * pxPerKm] : [])];
    const end = (sp ? kmOf(sp) : maxScore * KM_PER_POINT) * pxPerKm + 200;
    const nearLand = (x, r) => flatXs.some((l) => Math.abs(x - l) < r);
    props = []; people = [];
    for (let x = -120, i = 0; x < end; x += 30 + Math.floor(hash(i) * 60), i++) {
      const zone = rawZone(x / pxPerKm); if (zone === "ocean" || nearLand(x, 48)) continue;
      const list = PROPS[zone] || PROPS.campus;
      props.push({ x, kind: list[Math.floor(hash(i + 50) * list.length)], back: true });
    }
    const add = (x, i) => { const zone = rawZone(x / pxPerKm); if (zone === "ocean") return;
      const kind = zone === "campus" || zone === "city" ? (hash(i + 3) < 0.55 ? 0 : hash(i + 4) < 0.5 ? 2 : 1) : hash(i + 3) < 0.15 ? 3 : hash(i + 4) < 0.5 ? 2 : 1;
      people.push({ x, kind, range: 10 + hash(i + 5) * 30, speed: hash(i + 6) < 0.65 ? 0 : 0.003 + hash(i + 7) * 0.003, ph: hash(i + 8) * 100, c1: CLOTH[Math.floor(hash(i + 1) * CLOTH.length)], c2: CLOTH[Math.floor(hash(i + 2) * CLOTH.length)], skin: SKIN[Math.floor(hash(i + 11) * SKIN.length)], back: hash(i + 12) < 0.5 }); };
    let n = 0;
    for (let x = 60; x < end; x += 90 + Math.floor(hash(n + 400) * 110)) add(x, n++);
    for (const l of flatXs.slice(0, regular.length)) for (let k = 0; k < 3; k++) add(l - 30 + k * 22 + hash(n) * 8, n++);
  }
  // Rolling, bumpy ground: offset (in pixels) of the path at world x. Flat around landmarks.
  function bump(wx) {
    let h = Math.sin(wx * 0.016) * 2.6 + Math.sin(wx * 0.037 + 1.3) * 1.1;
    for (const l of flatXs) { const d = Math.abs(wx - l); if (d < 75) h *= Math.max(0, (d - 42) / 33); }
    return Math.round(h);
  }

  function draw(time) {
    const camX = km * pxPerKm - HERO_X;
    const z = zoneAt(km + 40 / pxPerKm);
    // sky in bands for a pixel look
    for (let i = 0; i < 8; i++) rect(ctx, mix(z.sky[0], z.sky[1], i / 7), 0, i * (GROUND / 8), W, Math.ceil(GROUND / 8));
    if (z.stars) { for (let i = 0; i < 90; i++) { const sx = (i * 97 - camX * 0.05) % W, sy = (i * 53) % Math.round(GROUND * 0.7); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time / 500 + i); rect(ctx, "#fff7d6", (sx + W) % W, sy + 4, 1, 1); } ctx.globalAlpha = 1; disc(ctx, "#fff3c4", W - 60, Math.round(GROUND * 0.25), 6); disc(ctx, z.sky[0], W - 57, Math.round(GROUND * 0.25) - 2, 6); }
    else disc(ctx, "#fff4c2", W - 64, Math.round(GROUND * 0.3), 7);
    // clouds and birds
    if (!z.stars) {
      for (let i = 0; i < 6; i++) { const w = 12 + Math.floor(hash(i + 70) * 14), span = W + 60; const cx = ((hash(i + 60) * span - camX * 0.08 + time * 0.003 * (1 + i % 3)) % span + span) % span - 40; cloud(ctx, Math.round(cx), Math.round(8 + hash(i + 80) * GROUND * 0.35), w); }
      for (let i = 0; i < 4; i++) { const span = W + 40; const bx = ((hash(i + 90) * span + time * 0.012 * (1 + hash(i + 91)) - camX * 0.2) % span + span) % span - 20; bird(ctx, bx, 14 + hash(i + 92) * GROUND * 0.3 + Math.sin(time / 700 + i) * 2, Math.floor(time / 180 + i) % 2, mix(z.sky[0], "#1c2433", 0.6)); }
    }
    // far + mid parallax layers
    const ys = new Array(W);
    for (let x = 0; x < W; x++) {
      const wx = x + camX;
      ys[x] = z.water ? GROUND + Math.round(Math.sin(wx * 0.08 + time / 500)) : GROUND + bump(wx);
      const far = z.skyline ? GROUND - 52 + (Math.floor((wx * 0.3) / 9) * 37 % 23) : GROUND - 40 + noise(wx * 0.3) * 10;
      rect(ctx, z.far, x, far, 1, GROUND - far);
      if (z.skyline && (Math.floor(wx * 0.3) % 9) > 2 && (Math.floor(wx * 0.3 / 9) * 13 + Math.floor((GROUND - far) / 3)) % 5 === 0) rect(ctx, mix(z.far, "#fff3c4", 0.5), x, far + 4, 1, 1);
      const mid = z.dunes ? GROUND - 18 + Math.sin(wx * 0.6 * 0.03) * 6 : GROUND - 18 + noise(wx * 0.6 + 300) * 5;
      rect(ctx, z.mid, x, mid, 1, ys[x] - mid + 1);
    }
    const toScreen = (wx) => Math.round(wx - camX);
    const groundAt = (sx) => ys[Math.max(0, Math.min(W - 1, Math.round(sx)))];
    // things behind the path: props and people on the far side
    const drawProps = (back) => { for (const p of props) { if (p.back !== back || z.water) continue; const sx = toScreen(p.x); if (sx < -20 || sx > W + 20 || Math.abs(sx - HERO_X) < 12) continue; tree(ctx, sx, groundAt(sx) + (back ? 0 : 7), p.kind, Math.round(Math.sin(time / 900 + p.x) * 0.6)); } };
    const drawPeople = (back) => { for (const q of people) { if (q.back !== back || z.water) continue;
      // walkers stroll slowly back and forth (speed is game pixels per ms); the rest stand and chat
      const tri = q.speed ? ((time * q.speed / q.range + q.ph) % 2) : 0.5, pos = tri < 1 ? tri : 2 - tri, dir = q.speed ? (tri < 1 ? 1 : -1) : (hash(q.x) < 0.5 ? 1 : -1);
      const sx = toScreen(Math.round(q.x + pos * q.range)); if (sx < -8 || sx > W + 8) continue;
      person(ctx, sx, groundAt(sx) + 1, q.kind, q.c1, q.c2, q.skin, q.speed ? Math.floor(time / 380 + q.ph) % 2 : 0, dir); } };
    drawProps(true);
    // landmarks
    for (const s of regular) { const sx = kmOf(s) * pxPerKm - camX + (s === regular[0] ? -46 : 52); if (sx > -60 && sx < W + 60) LANDMARKS[s.sprite]?.(ctx, sx, GROUND); }
    drawPeople(true);
    if (sp) {
      const gx = gateKm() * pxPerKm - camX; if (gx > -40 && gx < W + 40) gate(ctx, gx, GROUND, special);
      const sx = kmOf(sp) * pxPerKm - camX; if (sx > -60 && sx < W + 60) LANDMARKS[sp.sprite]?.(ctx, sx, GROUND, time);
    }
    // ground follows the bumps; the path is a rough dirt track on top
    for (let x = 0; x < W; x++) rect(ctx, z.ground, x, ys[x], 1, H - ys[x]);
    if (z.water) {
      for (let row = 0; GROUND + 2 + row * 7 < H; row++) for (let x = 0; x < W; x += 1) { const y = GROUND + 2 + row * 7 + Math.round(Math.sin((x + camX * (1 - row * 0.04)) * 0.15 + time / 300 + row) * 1.2); if ((x + Math.floor(camX) + row * 11) % 23 < 4) rect(ctx, row ? z.ground2 : z.path, x, y, 1, 1); }
    } else {
      // grass tufts, flowers and stones on the foreground, lower rows scroll faster for depth
      const flowers = z.dunes || z.glow ? null : ["#f2c94c", "#ffffff", "#e889b5", "#b9a3f0"];
      for (let row = 0; GROUND + 14 + row * 5 < H; row++) {
        const y = GROUND + 14 + row * 5, sp = 1 + row * 0.035;
        for (let x = 0; x < W; x++) {
          const wx = Math.floor(x + camX * sp) * 3 + row * 1013, r = hash(wx);
          if (r < 0.012) { rect(ctx, z.ground2, x, y, 3, 1); rect(ctx, z.ground2, x + 1, y - 1, 1, 1); if (r < 0.012) rect(ctx, z.ground2, x - 1, y - 2, 1, 2); }
          else if (r < 0.0145) { if (flowers) { rect(ctx, mix(z.ground2, "#000000", 0.1), x, y, 1, 2); rect(ctx, flowers[Math.floor(hash(wx + 5) * 4)], x, y - 1, 1, 1); } else { rect(ctx, mix(z.ground, "#000000", 0.2), x, y, 2, 1); rect(ctx, mix(z.ground, "#ffffff", 0.2), x, y - 1, 1, 1); } }
          else if (r > 0.999) rect(ctx, mix(z.ground, "#ffffff", 0.12), x, y, 2, 1);
        }
      }
      const edge = mix(z.path, z.ground, 0.45), pebble = mix(z.path, "#000000", 0.18);
      for (let x = 0; x < W; x++) {
        const wx = Math.floor(x + camX), y = ys[x];
        rect(ctx, edge, x, y + 1, 1, 1);
        rect(ctx, z.path, x, y + 2, 1, 4);
        rect(ctx, edge, x, y + 6, 1, 1);
        if (hash(wx + 13) < 0.025) rect(ctx, pebble, x, y + 3 + Math.floor(hash(wx + 3) * 2), 1, 1);
      }
    }
    // dust
    dust = dust.filter((d) => (d.life -= 1) > 0);
    for (const d of dust) { d.x -= d.vx; d.y -= d.vy; ctx.globalAlpha = d.life / 30; rect(ctx, z.water ? "#e6f6ff" : mix(z.path, "#ffffff", 0.3), d.x, d.y, d.s, d.s); }
    ctx.globalAlpha = 1;
    // the traveler: walks the path, flies low over the sea
    const fly = !!z.water, cg = fly ? GROUND - 8 + Math.round(Math.sin(time / 300) * 2) : groundAt(HERO_X) + 3;
    const stepping = walking && !fly && Math.floor(stepPx / 5) % 2;
    const frame = stepping ? HERO_B : HERO_A;
    const shook = time < shakeUntil ? Math.round(Math.sin(time / 25) * 2) : 0;
    const hx = HERO_X - 9 + shook, hy = cg - HERO_H + (stepping ? -1 : 0);
    const wing = Math.floor(time / (fly || walking ? 70 : 260)) % 2 ? WING_B : WING_A;
    if (fly) { ctx.globalAlpha = 0.25; rect(ctx, "#0b2a44", HERO_X - 6, GROUND + 3, 12, 1); ctx.globalAlpha = 1; }
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { sprite(ctx, wing, hx + 1 + dx, hy + 8 + dy, OUTLINE); sprite(ctx, frame, hx + dx, hy + dy, OUTLINE); }
    ctx.globalAlpha = 0.9; sprite(ctx, wing, hx + 1, hy + 8, PAL); ctx.globalAlpha = 1;
    sprite(ctx, frame, hx, hy, PAL);
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
    setMax(m) { maxScore = Math.max(1, m); pxPerKm = (384 * SCREENS) / (maxScore * KM_PER_POINT); build(); },
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
          if (!zoneAt(km).water && Math.random() < 0.35) dust.push({ x: HERO_X - 6, y: GROUND + 2 + bump(km * pxPerKm), vx: 0.6 + Math.random(), vy: Math.random() * 0.4, s: 1 + (Math.random() < 0.3), life: 30 });
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
  canvas.width = 20; canvas.height = 24;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { sprite(ctx, WING_A, 2 + dx, 9 + dy, OUTLINE); sprite(ctx, HERO_A, 1 + dx, 1 + dy, OUTLINE); }
  sprite(ctx, WING_A, 2, 9, PAL); sprite(ctx, HERO_A, 1, 1, PAL);
}
