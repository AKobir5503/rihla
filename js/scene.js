// The travel scene: a pixel-art yellow jacket traveler crossing a side-scrolling world.
// Every point = KM_PER_POINT km. Each stop has a landmark; regions blend into each other.
// Drawn on a small canvas (W x H "game pixels") scaled up with crisp pixels.
import { KM_PER_POINT } from "./config.js";
import { ROUTE } from "./ui.js";

// About 2.5 screen pixels per game pixel, so lots of the world fits on screen.
let W = 480, H = 280, GROUND = 168, HERO_X = 140;
function fit(canvas) {
  const vw = window.innerWidth, vh = window.innerHeight;
  H = Math.max(200, Math.min(340, Math.round(vh / 2.5)));
  W = Math.max(120, Math.round((H * vw) / vh));
  GROUND = Math.round(H * 0.6);
  HERO_X = Math.round(Math.min(W * 0.3, 200));
  canvas.width = W; canvas.height = H;
}
const WORLD = 4600; // world width in game pixels from start to the final stop

// ---------- regions ----------
const ZONES = {
  campus: { sky: ["#7cc3f2", "#d9f1ff"], far: "#a3c9a0", mid: "#74a96a", ground: "#5a9a48", ground2: "#4a863a", path: "#d8c48f", town: "campus", props: ["tree", "tree", "bench", "lamp", "bike", "bush", "flowers", "tree"], animals: ["squirrel", "squirrel", "cat", "dog", "pigeon"] },
  city:   { sky: ["#6fb2e6", "#d3ecfb"], far: "#a9b9cc", mid: "#7f9a86", ground: "#5c8f4a", ground2: "#4d7d3e", path: "#c4bfb3", town: "city", props: ["lamp", "tree", "bench", "cart", "lamp", "tree", "flowers"], animals: ["pigeon", "pigeon", "cat", "dog"] },
  usa:    { sky: ["#64aeea", "#e6f5ff"], far: "#9cbf8a", mid: "#78a35c", ground: "#7f9f48", ground2: "#6f8d3c", path: "#c2a56d", town: "usa", props: ["tree", "bush", "fence", "tree", "rock", "flowers"], animals: ["dog", "cat", "pigeon", "squirrel"] },
  ocean:  { sky: ["#4f9fe0", "#d2edfd"], far: "#9ec2dc", mid: "#86b6c9", ground: "#e3cf98", ground2: "#d2bb82", path: "#efe0b4", town: "none", props: ["palm", "umbrella", "rock"], animals: ["pigeon"], water: "#2f78ad" },
  hills:  { sky: ["#e98d55", "#fcd9a2"], far: "#b98d76", mid: "#94705a", ground: "#8f8a4e", ground2: "#7d7843", path: "#dcbb7c", town: "ottoman", props: ["cypress", "olive", "stall", "lamp", "bench", "tree"], animals: ["cat", "cat", "cat", "pigeon"] },
  desert: { sky: ["#ee7f45", "#ffd99b"], far: "#e6ad6c", mid: "#d6924f", ground: "#e2b872", ground2: "#d3a762", path: "#f3d79c", town: "cairo", props: ["palm", "stall", "rock", "palm", "cart"], animals: ["cat", "pigeon", "goat"], dunes: true },
  levant: { sky: ["#b8648a", "#f8c08c"], far: "#a88486", mid: "#86686d", ground: "#a99363", ground2: "#998456", path: "#dcc08c", town: "levant", props: ["olive", "cypress", "stall", "palm", "olive"], animals: ["sheep", "sheep", "cat", "pigeon"] },
  holy:   { sky: ["#0d1638", "#2f3d82"], far: "#2a3570", mid: "#1f2a5c", ground: "#cdab63", ground2: "#bd9b55", path: "#f2dc9c", town: "holy", props: ["palm", "lamp", "palm"], animals: ["pigeon", "pigeon", "pigeon"], night: true },
};
const RANK_COLOR = { noor: "#f2c94c", hidden_gem: "#a98bff", scholar: "#5b9cff", pathfinder: "#3fcf8e", traveler: "#ff9d4d", footstep: "#d0d6dd", lost: "#ff6b6b" };

// ---------- color helpers ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixRaw = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const cache = new Map();
function mix(a, b, t) {
  t = Math.round(t * 32) / 32; if (t <= 0) return a; if (t >= 1) return b;
  const k = a + b + t; let v = cache.get(k); if (!v) { v = mixRaw(a, b, t); if (cache.size > 6000) cache.clear(); cache.set(k, v); } return v;
}
const dk = (c, t = 0.2) => mix(c, "#000000", t), lt = (c, t = 0.25) => mix(c, "#ffffff", t);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise = (x) => Math.sin(x * 0.05) * 0.5 + Math.sin(x * 0.013 + 1.7) * 0.8 + Math.sin(x * 0.11 + 4) * 0.2;
const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

let ctx = null;
function R(c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function disc(c, cx, cy, r) { for (let i = -r; i <= r; i++) { const w = Math.round(Math.sqrt(r * r - i * i)); R(c, cx - w, cy + i, w * 2 + 1, 1); } }

// ---------- the traveler: an original yellow jacket in a white thobe and kufi, with a satchel ----------
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
const HERO_B = HERO_A.slice(0, 20).concat(["..........k..k....", ".........kk.kk...."]);
const HERO_BLINK = HERO_A.map((r, i) => (i === 6 || i === 7 ? r.replace("eek", i === 6 ? "yyy" : "kkk") : r));
const WING_A = [".ww...", "wwww..", "wwwwww", ".wwwww"];
const WING_B = ["......", ".www..", "wwwwww", "wwwwww"];
const HERO_H = HERO_A.length;
const PAL = { y: "#f2c230", k: "#1d1a16", c: "#ffffff", e: "#ffffff", t: "#f4f1ea", u: "#d6cfbf", s: "#8a5a2e", b: "#a46a34", w: "#cfe9fb" };
const OUTLINE = Object.fromEntries(Object.keys(PAL).map((k) => [k, "#2a2112"]));
function sprite(rows, x, y, pal) {
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) { const k = rows[r][c]; if (k !== "." && pal[k]) R(pal[k], x + c, y + r, 1, 1); }
}
function hero(x, y, frame, wing, wingAlpha = 0.9) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { sprite(wing, x + 1 + dx, y + 8 + dy, OUTLINE); sprite(frame, x + dx, y + dy, OUTLINE); }
  ctx.globalAlpha = wingAlpha; sprite(wing, x + 1, y + 8, PAL); ctx.globalAlpha = 1;
  sprite(frame, x, y, PAL);
}

// ---------- architecture helpers ----------
function finial(cx, top, c = "#e9c75a") { R(c, cx, top - 4, 1, 4); R(c, cx - 1, top - 5, 3, 1); R(c, cx - 1, top - 8, 1, 2); R(c, cx, top - 9, 1, 1); R(c, cx, top - 6, 1, 1); }
function dome(c, cx, base, r, { onion = false } = {}) {
  const shade = dk(c, 0.16), hi = lt(c, 0.4);
  const rows = onion ? Math.round(r * 1.35) : r;
  for (let i = 0; i <= rows; i++) {
    let hw;
    if (onion) { const t = i / rows; hw = Math.round(r * (t < 0.55 ? 1 + 0.12 * Math.sin((t / 0.55) * Math.PI) : Math.cos(((t - 0.55) / 0.45) * Math.PI / 2))); }
    else hw = Math.round(Math.sqrt(r * r - i * i));
    R(c, cx - hw, base - i, hw * 2 + 1, 1);
    const sw = Math.round(hw * 0.6); R(shade, cx + hw - sw + 1, base - i, sw, 1);
  }
  R(hi, cx - Math.round(r * 0.5), base - Math.round(rows * 0.75), 1, Math.max(1, Math.round(rows * 0.3)));
  R(hi, cx - Math.round(r * 0.5) + 1, base - Math.round(rows * 0.85), 1, 1);
  return base - rows;
}
function arch(c, x, y, w, h) { if (w >= 3) R(c, x + 1, y, w - 2, 1); else R(c, x, y, w, 1); R(c, x, y + 1, w, h - 1); }
function archRow(c, x0, y, n, gap, w, h) { for (let i = 0; i < n; i++) arch(c, x0 + i * gap, y, w, h); }
function crenel(c, x, y, w) { for (let i = 0; i < w; i += 3) R(c, x + i, y - 2, 2, 2); }
function minaret(c, x, base, h, { w = 4, cap = "cone", capC = "#8f989f", balc = [0.55, 0.8], fin = true } = {}) {
  R(c, x, base - h, w, h); R(dk(c, 0.15), x + w - 1, base - h, 1, h);
  for (const f of balc) { const y = Math.round(base - h * f); R(lt(c, 0.1), x - 1, y, w + 2, 2); R(dk(c, 0.35), x - 1, y + 2, w + 2, 1); }
  for (let y = base - h + 6; y < base - 6; y += 9) R(dk(c, 0.45), x + Math.floor(w / 2) - (w > 3 ? 1 : 0), y, 1, 2);
  let top = base - h;
  if (cap === "cone") { const ch = w * 3; for (let i = 0; i < ch; i++) { const cw = Math.max(1, Math.round(w * (1 - i / ch))); R(i % 2 ? dk(capC, 0.08) : capC, x + (w - cw) / 2, top - 1 - i, cw, 1); } top -= ch + 1; }
  else if (cap === "bulb") { R(c, x - 1, top - 1, w + 2, 1); top = dome(capC, x + Math.floor(w / 2), top - 2, Math.ceil(w / 2) + 1, { onion: true }); }
  else if (cap === "square") { R(c, x - 1, top - 1, w + 2, 1); crenel(c, x - 1, top - 1, w + 2); R(capC, x + 1, top - 5, w - 2, 3); top -= 6; }
  if (fin) finial(x + Math.floor(w / 2), top);
}

// ---------- landmarks: drawn standing on the ground at x (center), each with a half-width ----------
const LANDMARKS = {
  gttower: { hw: 42, draw(x, g) { // red-brick hall with the TECH tower
    const b = "#9b4a30", trim = "#e8dcc6";
    R(b, x - 40, g - 30, 80, 30); R(dk(b, 0.12), x + 22, g - 30, 18, 30); R(trim, x - 41, g - 31, 82, 2); R(dk(b, 0.3), x - 40, g - 2, 80, 2);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) { if (i === 4) continue; const wx = x - 37 + i * 8; arch("#f6e3a3", wx, g - 26 + r * 8, 3, 5); R(trim, wx - 1, g - 21 + r * 8, 5, 1); }
    R(b, x - 9, g - 70, 18, 40); R(dk(b, 0.12), x + 4, g - 70, 5, 40); R(trim, x - 10, g - 71, 20, 2); R(trim, x - 10, g - 50, 20, 1);
    for (let i = 0; i < 6; i++) R("#5b2b1b", x - 9 + Math.floor(i * 1.5), g - 72 - i, 18 - i * 3, 1);
    R("#5a2a1a", x - 4, g - 67, 9, 17);
    const L = { T: ["###", ".#.", ".#."], E: ["###", "##.", "###"], C: ["###", "#..", "###"], H: ["#.#", "###", "#.#"] };
    "TECH".split("").forEach((ch, n) => L[ch].forEach((row, ry) => [...row].forEach((p, rx) => p === "#" && R("#f2c94c", x - 1 + rx, g - 66 + n * 4 + ry, 1, 1))));
    arch("#5a2a1a", x - 4, g - 13, 8, 13); R("#3a1a10", x - 3, g - 11, 6, 11); R("#cfc5b2", x - 8, g, 16, 1);
  } },
  masjid: { hw: 46, draw(x, g) { // Al Farooq: cream hall, big dome, tall minaret
    const c = "#efe4cc", d = "#e0d2b0";
    R(c, x - 36, g - 24, 72, 24); R(dk(c, 0.1), x + 18, g - 24, 18, 24); R("#c9a96b", x - 37, g - 26, 74, 2); crenel("#c9a96b", x - 37, g - 26, 74);
    R("#2f7d6b", x - 36, g - 21, 72, 1);
    archRow("#7b6a55", x - 32, g - 17, 4, 7, 4, 8); archRow("#7b6a55", x + 9, g - 17, 4, 7, 4, 8);
    arch("#2f7d6b", x - 5, g - 20, 10, 20); arch("#1f4f44", x - 3, g - 17, 6, 17);
    R(d, x - 14, g - 32, 28, 6); archRow(dk(d, 0.3), x - 11, g - 31, 5, 5, 2, 3);
    finial(x, dome("#e8dcc0", x, g - 32, 14));
    minaret(c, x + 38, g, 70, { w: 5, cap: "bulb", capC: "#e8dcc0", balc: [0.6, 0.85] });
  } },
  azhar: { hw: 50, draw(x, g) { // Al-Azhar: sandstone hall, several Mamluk minarets
    const c = "#d9c39a";
    R(c, x - 44, g - 20, 88, 20); R(dk(c, 0.1), x + 20, g - 20, 24, 20); crenel(c, x - 44, g - 20, 88);
    archRow(dk(c, 0.4), x - 40, g - 15, 11, 8, 4, 9); arch("#5a4632", x - 4, g - 18, 8, 18);
    finial(x - 22, dome(lt(c, 0.1), x - 22, g - 22, 7));
    minaret(c, x - 6, g - 20, 46, { w: 6, cap: "bulb", capC: lt(c, 0.15), balc: [0.4, 0.75] });
    minaret(c, x + 14, g - 20, 54, { w: 5, cap: "bulb", capC: lt(c, 0.15), balc: [0.35, 0.65, 0.88] });
    minaret(c, x + 34, g - 20, 38, { w: 6, cap: "square", capC: dk(c, 0.1), balc: [0.6] });
  } },
  tallmasjid: { hw: 40, draw(x, g) { // Islamic Center of Washington: white limestone, one very tall minaret
    const c = "#f4f1ea", tile = "#3b7fa6";
    R(c, x - 30, g - 26, 60, 26); R(dk(c, 0.08), x + 14, g - 26, 16, 26); R(tile, x - 30, g - 24, 60, 2); for (let i = 0; i < 60; i += 4) R("#8fc0de", x - 30 + i, g - 24, 2, 1);
    R(c, x - 31, g - 28, 62, 2); crenel(dk(c, 0.05), x - 31, g - 28, 62);
    for (let i = 0; i < 5; i++) { const ax = x - 26 + i * 11; arch(tile, ax - 1, g - 19, 9, 19); arch("#24506b", ax + 1, g - 16, 5, 16); }
    minaret(c, x - 40, g, 92, { w: 6, cap: "bulb", capC: "#e8e2d2", balc: [0.62, 0.82] });
  } },
  smallmasjid: { hw: 22, draw(x, g) { // Mother Mosque of America: small white building, green dome
    const c = "#f5f2ea";
    R(c, x - 18, g - 16, 36, 16); R(dk(c, 0.08), x + 8, g - 16, 10, 16); R("#cfc9bb", x - 19, g - 17, 38, 1);
    archRow("#5a7da0", x - 15, g - 12, 2, 6, 3, 6); archRow("#5a7da0", x + 7, g - 12, 2, 6, 3, 6);
    arch("#6b5b4a", x - 3, g - 11, 6, 11); R("#b9b3a5", x - 5, g, 10, 1);
    R(c, x - 6, g - 20, 12, 4); finial(x, dome("#4c9a6a", x, g - 20, 7));
  } },
  ottoman: { hw: 62, draw(x, g) { // Süleymaniye: cascading grey domes, four pencil minarets
    const c = "#ece4d4", lead = "#a6aeb5";
    R(c, x - 48, g - 18, 96, 18); R(dk(c, 0.08), x + 20, g - 18, 28, 18);
    archRow("#6a6e73", x - 45, g - 14, 15, 6, 3, 6); arch("#4e5257", x - 4, g - 15, 8, 15);
    for (const dx of [-38, -26, 26, 38]) dome(lead, x + dx, g - 18, 5);
    R(c, x - 30, g - 24, 60, 6); for (const dx of [-24, 24]) dome(lead, x + dx, g - 24, 10);
    R(c, x - 18, g - 30, 36, 6); archRow("#6a6e73", x - 16, g - 29, 8, 4, 2, 3);
    finial(x, dome(lead, x, g - 30, 19));
    minaret(c, x - 58, g, 70, { w: 3, capC: "#8f989f", balc: [0.5, 0.75] }); minaret(c, x + 55, g, 70, { w: 3, capC: "#8f989f", balc: [0.5, 0.75] });
    minaret(c, x - 52, g, 88, { w: 3, capC: "#8f989f", balc: [0.45, 0.65, 0.85] }); minaret(c, x + 49, g, 88, { w: 3, capC: "#8f989f", balc: [0.45, 0.65, 0.85] });
  } },
  umayyad: { hw: 60, draw(x, g) { // Umayyad Mosque: long arcaded hall, central dome, three different minarets
    const c = "#d8c8a8";
    R(c, x - 52, g - 22, 104, 22); R(dk(c, 0.1), x + 24, g - 22, 28, 22); R(dk(c, 0.25), x - 53, g - 23, 106, 1);
    archRow("#4a4034", x - 49, g - 16, 17, 6, 4, 13); R("#3f7d5c", x - 3, g - 16, 6, 16);
    R(c, x - 10, g - 34, 20, 12); R(dk(c, 0.1), x + 4, g - 34, 6, 12); archRow("#4a4034", x - 8, g - 31, 4, 5, 2, 5);
    finial(x, dome("#8e9aa3", x, g - 34, 11));
    minaret(c, x - 58, g, 50, { w: 7, cap: "square", capC: dk(c, 0.12), balc: [0.7] });
    minaret(c, x + 30, g - 22, 46, { w: 5, cap: "cone", capC: "#7d8a72", balc: [0.5, 0.8] });
    minaret(c, x + 52, g, 64, { w: 5, cap: "bulb", capC: lt(c, 0.15), balc: [0.55, 0.8] });
  } },
  goldendome: { hw: 50, draw(x, g) { // Dome of the Rock on the al-Aqsa compound
    const marble = "#e9edf2", blue = "#2f5f9e";
    R("#d8cfbd", x - 50, g - 4, 100, 4); R(dk("#d8cfbd", 0.15), x - 50, g - 1, 100, 1); for (let i = 0; i < 100; i += 6) R(dk("#d8cfbd", 0.2), x - 50 + i, g - 4, 1, 3);
    R(marble, x - 30, g - 14, 60, 10); R(blue, x - 30, g - 26, 60, 12); R(dk(blue, 0.2), x + 14, g - 26, 16, 22);
    for (let i = 0; i < 60; i += 3) R(hash(i) < 0.5 ? "#5b8fd0" : "#e3c46a", x - 30 + i, g - 25 + (i % 2), 1, 1);
    archRow("#14335c", x - 27, g - 22, 9, 6, 3, 6); arch("#7b5a2a", x - 3, g - 13, 6, 9);
    R(blue, x - 17, g - 34, 34, 8); archRow("#14335c", x - 14, g - 32, 7, 4, 2, 4); R(marble, x - 18, g - 35, 36, 1);
    finial(x, dome("#f2c230", x, g - 35, 17), "#f2c230");
    R(marble, x - 46, g - 12, 10, 8); finial(x - 41, dome("#8e9aa3", x - 41, g - 12, 5));
    for (const dx of [40, 46]) { R("#2f5a2c", dx + x, g - 20, 3, 16); R("#3d6e38", dx + x - 1, g - 16, 5, 10); }
  } },
  greendome: { hw: 66, draw(x, g, t = 0) { // Masjid an-Nabawi: green dome, glowing arches, minarets
    for (let r = 60; r > 0; r -= 6) { ctx.globalAlpha = 0.04 + 0.015 * Math.sin(t / 500); disc("#ffe9a8", x, g - 10, r); }
    ctx.globalAlpha = 1;
    const c = "#efe6d2";
    R(c, x - 56, g - 24, 112, 24); R(dk(c, 0.08), x + 30, g - 24, 26, 24); R("#c9b98e", x - 57, g - 26, 114, 2);
    for (let i = 0; i < 14; i++) arch(i % 2 ? "#ffe39a" : "#ffd36b", x - 53 + i * 8, g - 19, 4, 11);
    arch("#8a6a3a", x - 5, g - 20, 10, 20); arch("#ffe9a8", x - 3, g - 17, 6, 17);
    R(c, x - 26, g - 32, 14, 8); finial(x - 19, dome("#2f9e5b", x - 19, g - 32, 10));
    R(c, x + 6, g - 30, 14, 6); finial(x + 13, dome("#b8c0c6", x + 13, g - 30, 8));
    for (const [dx, h] of [[-64, 76], [-38, 84], [34, 84], [60, 76]]) minaret(c, x + dx, g, h, { w: 5, cap: "bulb", capC: "#2f9e5b", balc: [0.55, 0.78] });
    for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 300 + i); R("#fff3c4", x - 50 + i * 20, g - 27, 1, 1); } ctx.globalAlpha = 1;
  } },
  building: { hw: 26, draw(x, g) {
    R("#c7b9a0", x - 24, g - 34, 48, 34); R(dk("#c7b9a0", 0.1), x + 10, g - 34, 14, 34); R("#b0a185", x - 25, g - 36, 50, 2);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) R("#6f8fb0", x - 21 + i * 8, g - 31 + j * 7, 5, 4);
    R("#5a4a3a", x - 3, g - 9, 6, 9);
  } },
  spire: { hw: 12, draw(x, g) {
    R("#9aa3ad", x - 4, g - 70, 8, 70); R(dk("#9aa3ad", 0.15), x + 1, g - 70, 3, 70); R("#b8c0c9", x - 3, g - 80, 6, 10); R("#ffe9a8", x - 1, g - 85, 2, 5);
  } },
};
LANDMARKS.bigmasjid = LANDMARKS.ottoman;
const SPRITE_FOR = { "Al-Azhar Mosque": "azhar", "Umayyad Mosque": "umayyad", "Süleymaniye Mosque": "ottoman" };
const lmOf = (s) => LANDMARKS[SPRITE_FOR[s.name] || s.sprite] || LANDMARKS.masjid;

function gate(x, g, open) {
  const stone = "#b9a27a";
  R(stone, x - 26, g - 44, 10, 44); R(stone, x + 16, g - 44, 10, 44); R(dk(stone, 0.15), x + 22, g - 44, 4, 44);
  R(stone, x - 28, g - 50, 56, 6); crenel(stone, x - 28, g - 50, 56);
  for (let i = 0; i < 14; i++) { const w = Math.round(Math.sqrt(196 - i * i)) * 2 + 2; R(stone, x - w / 2, g - 44 - i * 0.4, w, 1); }
  R(dk(stone, 0.3), x - 16, g - 44, 32, 1);
  if (!open) { R("#6b4a2b", x - 16, g - 42, 32, 42); R("#4e351e", x - 1, g - 42, 2, 42); for (let i = 0; i < 4; i++) for (const dx of [-12, -6, 4, 10]) R("#d6b25a", x + dx, g - 36 + i * 9, 1, 1); }
  for (const dx of [-30, 28]) { R("#3b3f48", x + dx, g - 30, 1, 6); R("#ffd36b", x + dx - 1, g - 33, 3, 3); }
}

// ---------- props ----------
function prop(kind, x, g, t, seed) {
  const sway = Math.round(Math.sin(t / 1100 + seed * 9) * 0.6);
  switch (kind) {
    case "tree": { const h = 9 + Math.floor(seed * 5), r = 6 + Math.floor(seed * 3); R("#6b4a2b", x, g - h, 2, h); disc("#3e7f3a", x + 1 + sway, g - h - r + 2, r); disc("#4f9346", x - 1 + sway, g - h - r, Math.max(2, r - 3)); R("#6db35e", x - 3 + sway, g - h - r * 2 + 3, 2, 1); break; }
    case "palm": { const h = 18 + Math.floor(seed * 8); for (let i = 0; i < h; i++) R(i % 3 ? "#8a6236" : "#73502b", x + Math.round(Math.sin(i / 7) * 2), g - i, 2, 1); const tx = x + 2 + Math.round(Math.sin(h / 7) * 2), ty = g - h - 1;
      for (const [dx, dy] of [[-7, 2], [-5, 1], [-3, 0], [-1, -1], [1, -1], [3, 0], [5, 1], [7, 2], [-8, 3], [8, 3]]) R("#3f8a3a", tx + dx + sway, ty + dy, 2, 1);
      R("#2f6e2c", tx - 2 + sway, ty - 1, 4, 2); R("#6b4a22", tx - 1, ty + 1, 3, 2); break; }
    case "cypress": { R("#5a4630", x + 1, g - 3, 1, 3); for (let i = 0; i < 20; i++) { const w = Math.max(1, Math.round(3 * Math.sin(((i + 2) / 22) * Math.PI))); R(i % 4 ? "#2f5a2c" : "#3d6e38", x + 1 - Math.floor(w / 2) + (i > 12 ? sway : 0), g - 3 - i, w + 1, 1); } break; }
    case "olive": { R("#6b5238", x, g - 7, 2, 7); R("#6b5238", x + 2, g - 9, 1, 2); disc("#7f9a5b", x + 1 + sway, g - 11, 5); disc("#93ad6c", x - 1 + sway, g - 13, 2); break; }
    case "lamp": { R("#3b3f48", x, g - 22, 1, 22); R("#3b3f48", x, g - 22, 4, 1); R("#ffe9a8", x + 3, g - 21, 2, 2); R("#3b3f48", x - 1, g - 1, 3, 1); break; }
    case "bench": { R("#7a5230", x - 4, g - 4, 9, 1); R("#7a5230", x - 4, g - 6, 9, 1); R("#3b3f48", x - 4, g - 3, 1, 3); R("#3b3f48", x + 4, g - 3, 1, 3); break; }
    case "bike": { const c = "#2f6db3"; for (const wx of [x - 4, x + 3]) { R("#222", wx - 1, g - 3, 3, 1); R("#222", wx - 1, g - 1, 3, 1); R("#222", wx - 2, g - 2, 1, 1); R("#222", wx + 2, g - 2, 1, 1); } R(c, x - 3, g - 4, 6, 1); R(c, x - 1, g - 5, 1, 2); R("#222", x + 2, g - 6, 2, 1); break; }
    case "cart": { R("#b3263a", x - 5, g - 9, 11, 2); R("#f4f1ea", x - 4, g - 11, 9, 1); R("#b3263a", x - 3, g - 12, 7, 1); R("#3b3f48", x, g - 9, 1, 3); R("#c9a96b", x - 4, g - 7, 9, 5); R("#222", x - 3, g - 2, 2, 2); R("#222", x + 2, g - 2, 2, 2); break; }
    case "stall": { const aw = pick(["#b3263a", "#2f6db3", "#3f7d5c", "#e3b23c"], seed); for (let i = 0; i < 15; i++) R(i % 4 < 2 ? aw : "#f4efe4", x - 7 + i, g - 15, 1, 3); R(aw, x - 8, g - 12, 17, 1);
      R("#6b4a2b", x - 7, g - 12, 1, 12); R("#6b4a2b", x + 7, g - 12, 1, 12); R("#8a6236", x - 6, g - 6, 13, 2); for (let i = 0; i < 6; i++) R(pick(["#e07a3a", "#f2c94c", "#7bb661", "#c0392b", "#8e5aa8"], hash(seed * 10 + i)), x - 5 + i * 2, g - 7, 1, 1); break; }
    case "fence": { R("#e8e0cc", x - 7, g - 4, 15, 1); R("#e8e0cc", x - 7, g - 2, 15, 1); for (let i = 0; i < 15; i += 3) R("#f4efe4", x - 7 + i, g - 5, 1, 5); break; }
    case "umbrella": { const c = pick(["#e3483b", "#2f6db3", "#e3b23c"], seed); R("#6b4a2b", x, g - 10, 1, 10); for (let i = 0; i < 4; i++) R(i % 2 ? c : "#f4f1ea", x - 5 + i * 3 - i, g - 11 + i, 11 - i * 2 + i * 2 - i * 2, 1); R(c, x - 5, g - 11, 11, 1); break; }
    case "rock": { R("#8b8178", x - 2, g - 3, 6, 3); R("#a59a8f", x - 1, g - 4, 4, 1); R(dk("#8b8178", 0.2), x + 2, g - 3, 2, 3); break; }
    case "bush": { disc("#3f7a38", x + 1, g - 2, 3); R("#5c9a4f", x, g - 5, 2, 1); break; }
    case "flowers": { for (let i = 0; i < 7; i++) { R("#3f7a38", x - 3 + i, g - 2, 1, 2); R(pick(["#f2c94c", "#e889b5", "#ffffff", "#b9a3f0", "#e3483b"], hash(seed * 7 + i)), x - 3 + i, g - 3 - (i % 2), 1, 1); } break; }
  }
}

// ---------- people and animals ----------
const SKIN = ["#f1c9a5", "#e0b08a", "#c68e62", "#9c6b45", "#6e4a30", "#4f3424"];
const HAIR = ["#2a2019", "#3b2a1a", "#1c1c1c", "#5a3b22", "#8a6a3a"];
const CLOTH = ["#2f6db3", "#b3263a", "#3f7d5c", "#e3b23c", "#6b4fa0", "#e07a3a", "#3b3b46", "#2b9aa0", "#c46b8c", "#5d6b7a"];
// 5x11 person (kid 4x8). kind: 0 student w/ backpack, 1 thobe + kufi, 2 hijab + long dress, 3 kid, 4 casual w/ cap
function person(x, g, p, frame, dir) {
  x = Math.round(x);
  const kid = p.kind === 3, top = g - (kid ? 8 : 11), leg = "#2d3140";
  const face = dir > 0 ? 1 : 0;
  if (p.kind === 2) { // hijab
    R(p.c2, x, top - 1, 5, 4); R(p.skin, x + 1 + face, top, 2, 2); R("#1c1c1c", x + 2 + face, top, 1, 1);
    R(p.c1, x, top + 3, 5, 7); R(dk(p.c1, 0.2), x + (frame ? 0 : 4), top + 4, 1, 3); R(dk(p.c1, 0.25), x, top + 9, 5, 1);
    R("#2a2019", x + (frame ? 0 : 1), g - 1, frame ? 5 : 3, 1); return;
  }
  if (kid) {
    R(p.skin, x + 1, top, 2, 2); R(p.hair, x + 1, top, 2, 1); R(p.c1, x, top + 2, 4, 3);
    if (frame) { R(leg, x, top + 5, 1, 3); R(leg, x + 3, top + 5, 1, 3); } else R(leg, x + 1, top + 5, 2, 3); return;
  }
  R(p.skin, x + 1, top, 3, 3); R("#1c1c1c", x + 2 + face, top + 1, 1, 1);
  if (p.kind === 1) { R("#ffffff", x + 1, top - 1, 3, 1); R("#f4f1ea", x, top + 3, 5, 7); R("#ddd6c6", x + (frame ? 0 : 4), top + 4, 1, 3); R("#ddd6c6", x, top + 9, 5, 1); R("#2a2019", x + (frame ? 0 : 1), g - 1, frame ? 5 : 3, 1); return; }
  R(p.hair, x + 1, top, 3, 1); R(p.hair, dir > 0 ? x + 1 : x + 3, top + 1, 1, 1);
  if (p.kind === 4) { R(p.c2, x + 1, top - 1, 3, 1); R(p.c2, dir > 0 ? x + 4 : x, top, 1, 1); }
  R(p.c1, x, top + 3, 5, 4); R(dk(p.c1, 0.2), x + (frame ? 0 : 4), top + 4, 1, 2);
  if (p.kind === 0) R(p.c2, dir > 0 ? x - 1 : x + 5, top + 3, 1, 4);
  if (frame) { R(leg, x, top + 7, 2, 4); R(leg, x + 3, top + 7, 2, 4); } else R(leg, x + 1, top + 7, 3, 4);
}
function animal(a, x, g, t, dir) {
  x = Math.round(x);
  const f = Math.floor(t / 300 + a.ph * 10) % 2;
  switch (a.type) {
    case "cat": { const c = a.c; if (!a.moving) { R(c, x, g - 4, 4, 4); R(c, x + (dir > 0 ? 3 : -1), g - 6, 3, 3); R(c, x + (dir > 0 ? 3 : -1), g - 7, 1, 1); R(c, x + (dir > 0 ? 5 : 1), g - 7, 1, 1); const tw = Math.round(Math.sin(t / 400 + a.ph * 20)); R(c, x + (dir > 0 ? -1 : 4), g - 2 + tw, 1, 2 - tw); }
      else { R(c, x, g - 4, 6, 2); R(c, x + (dir > 0 ? 5 : -2), g - 6, 3, 3); R(c, x + (dir > 0 ? 7 : -2), g - 7, 1, 1); R(c, x + (dir > 0 ? -1 : 6), g - 6, 1, 2); R(dk(c, 0.3), x + (f ? 0 : 1), g - 2, 1, 2); R(dk(c, 0.3), x + (f ? 4 : 5), g - 2, 1, 2); } break; }
    case "pigeon": { const peck = !a.moving && Math.sin(t / 250 + a.ph * 30) > 0.6; R("#8d93a0", x, g - 3, 3, 2); R("#6d7380", x + (dir > 0 ? 2 : 0) + (peck ? dir : 0), g - (peck ? 3 : 4), 1, 1); R("#e07a3a", x + 1, g - 1, 1, 1); break; }
    case "squirrel": { const hop = a.moving && f ? 1 : 0; R("#8a5a32", x, g - 3 - hop, 3, 2); R("#8a5a32", x + (dir > 0 ? 2 : 0), g - 4 - hop, 1, 1); R("#a8743f", x + (dir > 0 ? -1 : 3), g - 6 - hop, 1, 4); R("#a8743f", x + (dir > 0 ? -2 : 4), g - 7 - hop, 1, 2); break; }
    case "dog": { const c = a.c; R(c, x, g - 5, 6, 3); R(c, x + (dir > 0 ? 5 : -1), g - 7, 2, 3); R(dk(c, 0.3), x + (dir > 0 ? 6 : -1), g - 7, 1, 1); R(c, x + (f ? 0 : 1), g - 2, 1, 2); R(c, x + (f ? 4 : 5), g - 2, 1, 2); R(c, x + (dir > 0 ? -1 : 6), g - 6 - f, 1, 2); break; }
    case "sheep": { const graze = !a.moving && f; R("#f0ede4", x, g - 6, 7, 4); R("#e2ddd0", x + 1, g - 7, 5, 1); R("#3b3530", x + (dir > 0 ? 6 : -1), g - (graze ? 4 : 6), 2, 2); R("#3b3530", x + 1, g - 2, 1, 2); R("#3b3530", x + 5, g - 2, 1, 2); break; }
    case "goat": { R("#c9b08a", x, g - 5, 6, 3); R("#c9b08a", x + (dir > 0 ? 5 : -1), g - 7, 2, 2); R("#6b5238", x + (dir > 0 ? 5 : 0), g - 8, 1, 1); R("#6b5238", x + 1, g - 2, 1, 2); R("#6b5238", x + 4, g - 2, 1, 2); break; }
  }
}
function cloud(x, y, w, a = 1) { ctx.globalAlpha = 0.9 * a; R("#ffffff", x, y, w, 3); R("#ffffff", x + 3, y - 2, Math.max(3, w - 8), 2); R("#ffffff", x + 6, y - 3, Math.max(2, w - 14), 1); R("#e4eef6", x + 1, y + 3, w - 2, 1); ctx.globalAlpha = 1; }
function bird(x, y, f, c) { x = Math.round(x); y = Math.round(y); R(c, x, y, 1, 1); if (f) { R(c, x - 2, y - 1, 2, 1); R(c, x + 1, y - 1, 2, 1); } else { R(c, x - 1, y, 1, 1); R(c, x + 1, y, 1, 1); R(c, x - 2, y + 1, 1, 1); R(c, x + 2, y + 1, 1, 1); } }

// background buildings (a parallax layer), tinted toward the sky for depth
function townBuilding(b, x, base, tint) {
  const T = (c) => mix(c, tint, 0.35);
  const { w, h, s } = b;
  switch (b.style) {
    case "campus": { R(T("#9c5a3c"), x, base - h, w, h); R(T("#e8dcc6"), x, base - h, w, 1); for (let yy = base - h + 3; yy < base - 3; yy += 5) for (let xx = x + 2; xx < x + w - 2; xx += 4) R(T("#f6e3a3"), xx, yy, 2, 3); if (s < 0.3) for (let i = 0; i < 4; i++) R(T("#7a3f2a"), x + i, base - h - 1 - i, w - i * 2, 1); break; }
    case "city": { const c = pick(["#7f93aa", "#93a3b8", "#6c7f96", "#a7b4c4"], s); R(T(c), x, base - h, w, h); R(T(dk(c, 0.15)), x + w - 3, base - h, 3, h); for (let yy = base - h + 3; yy < base - 2; yy += 4) for (let xx = x + 2; xx < x + w - 3; xx += 3) R(T(hash(xx * 7 + yy) < 0.25 ? "#fff3c4" : dk(c, 0.25)), xx, yy, 1, 2); if (s > 0.7) R(T("#c9ced6"), x + Math.floor(w / 2), base - h - 6, 1, 6); break; }
    case "usa": { const c = pick(["#e8d8b8", "#b9cfe0", "#f0e6d6", "#c94f3c"], s), roof = s > 0.75 ? "#7a2f25" : "#6b5a4e"; R(T(c), x, base - h, w, h); for (let i = 0; i <= w / 2; i++) R(T(roof), x - 1 + i, base - h - i, w + 2 - i * 2, 1); R(T("#5a4a3a"), x + 2, base - 4, 2, 4); R(T("#bfe0f5"), x + w - 5, base - h + 3, 2, 2); break; }
    case "ottoman": { if (s < 0.18) { R(T("#ddd3c0"), x, base - 8, w, 8); dome(T("#9aa2a8"), x + w / 2, base - 8, Math.floor(w / 3)); R(T("#ddd3c0"), x + w + 1, base - 30, 2, 30); for (let i = 0; i < 5; i++) R(T("#9aa2a8"), x + w + 1 + (i > 2 ? 1 : 0), base - 31 - i, i > 2 ? 1 : 2, 1); }
      else { const c = pick(["#e8d6b8", "#d9b99a", "#efe3cf", "#c9a07a"], s); R(T(c), x, base - h, w, h); R(T("#b5523b"), x - 1, base - h - 1, w + 2, 1); for (let i = 1; i < 3; i++) R(T("#b5523b"), x + i, base - h - 1 - i, w - i * 2, 1); for (let xx = x + 2; xx < x + w - 1; xx += 3) R(T("#5a4a3a"), xx, base - h + 2, 1, 2); } break; }
    case "cairo": { if (s < 0.15) { R(T("#d9c39a"), x + 2, base - 34, 3, 34); R(T("#d9c39a"), x + 1, base - 22, 5, 1); dome(T("#e2cfa6"), x + 3, base - 34, 2, { onion: true }); }
      else { const c = pick(["#d9b98a", "#cfa877", "#e2c99c", "#c09062"], s); R(T(c), x, base - h, w, h); R(T(dk(c, 0.1)), x, base - h - 1, w, 1); for (let xx = x + 2; xx < x + w - 1; xx += 4) R(T("#5a4632"), xx, base - h + 3, 1, 2); } break; }
    case "levant": { const c = pick(["#e3d5b8", "#d6c4a0", "#cbb894"], s); R(T(c), x, base - h, w, h); if (s < 0.35) dome(T(lt(c, 0.1)), x + w / 2, base - h, Math.floor(w / 3)); for (let xx = x + 2; xx < x + w - 1; xx += 4) arch(T("#5a4a3a"), xx, base - h + 3, 2, 3); if (s > 0.8) { R(T("#2f5a2c"), x + w + 2, base - 14, 2, 14); } break; }
    case "holy": { R(T("#efe6d2"), x, base - h, w, h); for (let xx = x + 2; xx < x + w - 1; xx += 3) R("#ffe39a", xx, base - h + 3, 1, 2); if (s < 0.25) R(T("#efe6d2"), x + 1, base - h - 18, 2, 18); break; }
  }
}

// ---------- the scene ----------
export function createScene(canvas, hud) {
  ctx = canvas.getContext("2d");
  fit(canvas);
  window.addEventListener("resize", () => { fit(canvas); ctx.imageSmoothingEnabled = false; build(); });
  ctx.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let maxScore = 500, pxPerKm = 1, km = 0, odo = 0, special = false, walking = false, raf = 0;
  let dust = [], sparks = [], stepPx = 0, shakeUntil = 0, hopAt = -1e9, alt = 0;
  const regular = ROUTE.filter((s) => !s.special);
  const sp = ROUTE.find((s) => s.special);
  const kmOf = (s) => (s.special ? maxScore * KM_PER_POINT : s.at * maxScore * KM_PER_POINT);
  const gateKm = () => (kmOf(regular[regular.length - 1]) + kmOf(sp)) / 2 + maxScore * KM_PER_POINT * 0.06;

  // ---------- world layout (world pixels) ----------
  let segs = [], lands = [], props = [], people = [], animals = [], town = [], boats = [];
  const landX = (s) => { const hw = lmOf(s).hw; return kmOf(s) * pxPerKm + (s === regular[0] ? -hw - 14 : s.special ? 0 : hw + 18); };
  function segAt(wx) { let i = 0; while (i < segs.length - 1 && wx >= segs[i + 1].x0) i++; return i; }
  // zone blend at a world x: {A, B, t}
  function zoneMix(wx, band) {
    for (let j = 1; j < segs.length; j++) { const d = wx - segs[j].x0; if (Math.abs(d) < band) return { A: ZONES[segs[j - 1].zone], B: ZONES[segs[j].zone], t: (d + band) / (2 * band) }; }
    const z = ZONES[segs[segAt(wx)].zone]; return { A: z, B: z, t: 0 };
  }
  // the sea sits in the middle of an ocean stretch, with beaches at both ends
  function seaDepth(wx) {
    const i = segAt(wx), s = segs[i]; if (s.zone !== "ocean") return -1e9;
    const end = segs[i + 1] ? segs[i + 1].x0 : 1e9; return Math.min(wx - s.x0, end - wx) - 150;
  }
  function build() {
    if (!regular.length) return;
    segs = regular.map((s) => ({ x0: kmOf(s) * pxPerKm, zone: s.zone, label: s.zoneLabel }));
    segs[0].x0 = -1e9;
    if (sp) segs.push({ x0: gateKm() * pxPerKm, zone: sp.zone, label: sp.zoneLabel });
    lands = [...regular.map((s) => ({ s, x: landX(s) })), ...(sp ? [{ s: sp, x: landX(sp) }] : [])];
    const end = WORLD + 400, near = (x, r) => lands.some((l) => Math.abs(x - l.x) < lmOf(l.s).hw + r) || Math.abs(x - gateKm() * pxPerKm) < 30 + r;
    const zoneOf = (x) => ZONES[segs[segAt(x)].zone];
    props = []; people = []; animals = []; town = []; boats = [];
    for (let x = -300, i = 0; x < end; x += 16 + Math.floor(hash(i) * 34), i++) {
      if (near(x, 6) || seaDepth(x) > -8) continue;
      props.push({ x, kind: pick(zoneOf(x).props, hash(i + 50)), seed: hash(i + 77) });
    }
    let n = 0;
    const addPerson = (x, group) => { const z = segs[segAt(x)].zone; if (seaDepth(x) > -6) return; const r = (k) => hash(n * 13 + k);
      const kind = z === "campus" || z === "city" || z === "usa" ? pick([0, 0, 4, 2, 1, 3], r(1)) : pick([1, 1, 2, 2, 3, 4, 0], r(1));
      people.push({ x, kind, range: 12 + r(2) * 40, speed: group || r(3) < 0.45 ? 0 : 0.004 + r(4) * 0.004, ph: r(5) * 2, c1: pick(CLOTH, r(6)), c2: pick(CLOTH, r(7)), skin: pick(SKIN, r(8)), hair: pick(HAIR, r(9)), face: r(10) < 0.5 ? 1 : -1 }); n++; };
    for (let x = -200; x < end; x += 22 + Math.floor(hash(n + 900) * 46)) addPerson(x, false);
    for (const l of lands.slice(0, regular.length)) for (let k = 0; k < 7; k++) addPerson(l.x - lmOf(l.s).hw + k * (lmOf(l.s).hw / 3.2) + hash(n) * 4, k % 3 !== 0);
    let m = 0;
    for (let x = -200; x < end; x += 40 + Math.floor(hash(m + 300) * 70)) { if (seaDepth(x) > -6) { m++; continue; } const z = zoneOf(x); const type = pick(z.animals, hash(m + 301));
      const count = type === "pigeon" ? 3 + Math.floor(hash(m + 302) * 3) : type === "sheep" ? 2 + Math.floor(hash(m + 303) * 3) : 1;
      for (let k = 0; k < count; k++) animals.push({ type, x: x + k * (type === "sheep" ? 9 : 5), c: pick(["#e08a3a", "#8d8d8d", "#2b2b2b", "#f2efe6", "#c9a06a"], hash(m * 7 + k)), moving: hash(m * 3 + k + 5) < 0.4, range: 8 + hash(m + k) * 20, speed: 0.003 + hash(m + k + 9) * 0.003, ph: hash(m * 5 + k) }); m++; }
    for (const l of lands) if (!l.s.special) for (let k = 0; k < 4; k++) animals.push({ type: "pigeon", x: l.x - 10 + k * 5, moving: false, ph: hash(k + l.x), range: 0, speed: 0 });
    // parallax town: placed so each building shows near the region it belongs to
    const P = 0.55;
    for (let L = -200, i = 0; L < (end + W) * P + W; i++) { const wz = (L - HERO_X) / P + HERO_X, z = zoneOf(wz); const w = 10 + Math.floor(hash(i + 600) * 18);
      if (z.town !== "none" && seaDepth(wz) < -40) town.push({ L, style: z.town, w, h: (z.town === "city" ? 26 : 9) + Math.floor(hash(i + 601) * (z.town === "city" ? 50 : 16)), s: hash(i + 602) }); L += w + 2 + Math.floor(hash(i + 603) * 14); }
    for (let x = 0, i = 0; x < end; x += 60 + hash(i) * 80, i++) if (seaDepth(x) > 30) boats.push({ x, c: pick(["#b3263a", "#2f6db3", "#f4f1ea"], hash(i + 1)), ph: hash(i + 2) * 6 });
  }
  // gentle rolling ground; flat around landmarks and the gate
  function bump(wx) {
    let h = Math.sin(wx * 0.014) * 3 + Math.sin(wx * 0.033 + 1.3) * 1.3;
    for (const l of lands) { const hw = lmOf(l.s).hw, d = Math.abs(wx - l.x); if (d < hw + 40) h *= Math.max(0, (d - hw - 8) / 32); }
    const gd = Math.abs(wx - gateKm() * pxPerKm); if (gd < 70) h *= Math.max(0, (gd - 35) / 35);
    return Math.round(h);
  }

  function draw(time) {
    const camX = Math.round(km * pxPerKm - HERO_X);
    const heroWX = camX + HERO_X;
    const sky = zoneMix(heroWX + 200, 220); // look ahead so a region's sky is in place on arrival
    const C = (key, zm) => mix(zm.A[key], zm.B[key], zm.t);
    const night = (sky.A.night ? 1 - sky.t : 0) + (sky.B.night ? sky.t : 0);
    const s0 = mix(sky.A.sky[0], sky.B.sky[0], sky.t), s1 = mix(sky.A.sky[1], sky.B.sky[1], sky.t);
    // sky in bands
    for (let i = 0; i < 10; i++) R(mix(s0, s1, i / 9), 0, Math.floor(i * GROUND / 10), W, Math.ceil(GROUND / 10) + 1);
    if (night > 0) { ctx.globalAlpha = night; for (let i = 0; i < 140; i++) { const sx = ((i * 97 - camX * 0.04) % W + W) % W, sy = (i * 53) % Math.round(GROUND * 0.7); ctx.globalAlpha = night * (0.5 + 0.5 * Math.sin(time / 500 + i)); R("#fff7d6", sx, sy + 4, 1, 1); }
      ctx.globalAlpha = night; disc("#fff3c4", Math.round(W * 0.74), Math.round(GROUND * 0.3), 7); disc(s0, Math.round(W * 0.74) + 3, Math.round(GROUND * 0.3) - 2, 7);
      const ss = (time / 4000) % 3; if (ss < 0.25) { const p = ss / 0.25; for (let k = 0; k < 6; k++) R("#ffffff", W * 0.2 + p * 90 - k, 20 + p * 30 - k * 0.4, 1, 1); } ctx.globalAlpha = 1; }
    if (night < 1) { ctx.globalAlpha = 1 - night; disc("#fff4c2", Math.round(W * 0.74), Math.round(GROUND * 0.32), 9); ctx.globalAlpha = 1;
      for (let i = 0; i < 9; i++) { const w = 14 + Math.floor(hash(i + 70) * 20), span = W + 80; const cx = ((hash(i + 60) * span - camX * 0.06 + time * 0.003 * (1 + (i % 3))) % span + span) % span - 50; cloud(Math.round(cx), Math.round(8 + hash(i + 80) * GROUND * 0.38), w, 1 - night); }
      ctx.globalAlpha = 1 - night; for (let i = 0; i < 7; i++) { const span = W + 40; const bx = ((hash(i + 90) * span + time * 0.01 * (1 + hash(i + 91)) - camX * 0.2) % span + span) % span - 20; bird(bx, 12 + hash(i + 92) * GROUND * 0.35 + Math.sin(time / 700 + i) * 2, Math.floor(time / 200 + i) % 2, mix(s0, "#1c2433", 0.6)); } ctx.globalAlpha = 1; }
    // far mountains (and pyramids in Egypt)
    for (let x = 0; x < W; x++) {
      const zm = zoneMix(x + camX, 120), fx = x + camX * 0.25;
      const top = GROUND - H * 0.2 + noise(fx * 0.6) * H * 0.045;
      R(mix(C("far", zm), s1, 0.25), x, top, 1, GROUND - top);
    }
    for (let k = 0; k < 3; k++) { const px = Math.round(3200 * 0.25 + k * 34 - camX * 0.25 + 40 * pxPerKm * 0); const wz = (px - HERO_X) / 0.25 + HERO_X + camX * 0;
      const zr = zoneMix(px + camX, 10); if (px > -60 && px < W + 60 && (zr.A.town === "cairo" || zr.B.town === "cairo")) { const ph = 18 + k * 7 - (k === 2 ? 12 : 0); for (let i = 0; i < ph; i++) { R(mix("#d9b07a", s1, 0.3), px - ph + i, GROUND - H * 0.08 - i, (ph - i) * 2, 1); R(mix("#b88c5a", s1, 0.3), px, GROUND - H * 0.08 - i, ph - i, 1); } } void wz; }
    // town layer
    const P = 0.55, tint = s1;
    for (const b of town) { const sx = Math.round(b.L - camX * P); if (sx < -40 || sx > W + 40) continue; townBuilding(b, sx, Math.round(GROUND - H * 0.045), tint); }
    // near hills + ground line
    const ys = new Array(W), sea = new Array(W);
    for (let x = 0; x < W; x++) {
      const wx = x + camX, zm = zoneMix(wx, 90), depth = seaDepth(wx);
      sea[x] = depth;
      ys[x] = depth > 0 ? GROUND + 2 : GROUND + bump(wx);
      const dunes = (zm.A.dunes ? 1 - zm.t : 0) + (zm.B.dunes ? zm.t : 0);
      const mid = GROUND - H * 0.05 + (dunes > 0.5 ? Math.sin(wx * 0.6 * 0.025) * 5 : noise(wx * 0.6 + 300) * 4);
      R(C("mid", zm), x, mid, 1, ys[x] - mid + 1);
    }
    const toScreen = (wx) => Math.round(wx - camX);
    const groundAt = (sx) => ys[Math.max(0, Math.min(W - 1, Math.round(sx)))];
    const onLand = (sx) => sea[Math.max(0, Math.min(W - 1, Math.round(sx)))] <= 0;
    // props, landmarks, people, animals (standing on the far edge of the path)
    for (const p of props) { const sx = toScreen(p.x); if (sx < -20 || sx > W + 20 || Math.abs(sx - HERO_X) < 10) continue; prop(p.kind, sx, groundAt(sx), time, p.seed); }
    for (const l of lands) { const sx = toScreen(l.x), hw = lmOf(l.s).hw; if (sx < -hw - 70 || sx > W + hw + 70) continue; lmOf(l.s).draw(sx, GROUND, time); }
    if (sp) { const gx = toScreen(gateKm() * pxPerKm); if (gx > -40 && gx < W + 40) gate(gx, GROUND, special); }
    for (const a of animals) {
      const tri = a.moving ? (time * a.speed / Math.max(1, a.range) + a.ph * 2) % 2 : 0.5, pos = tri < 1 ? tri : 2 - tri;
      const sx = toScreen(Math.round(a.x + pos * a.range)); if (sx < -10 || sx > W + 10 || !onLand(sx)) continue;
      animal(a, sx, groundAt(sx) + 1, time, a.moving ? (tri < 1 ? 1 : -1) : (a.ph < 0.5 ? 1 : -1));
    }
    for (const q of people) {
      const tri = q.speed ? (time * q.speed / q.range + q.ph) % 2 : 0.5, pos = tri < 1 ? tri : 2 - tri;
      const sx = toScreen(Math.round(q.x + pos * q.range)); if (sx < -8 || sx > W + 8 || !onLand(sx)) continue;
      person(sx, groundAt(sx) + 1, q, q.speed ? Math.floor(time / 330 + q.ph * 3) % 2 : 0, q.speed ? (tri < 1 ? 1 : -1) : q.face);
    }
    // ground, sea, beach and path
    for (let x = 0; x < W; x++) {
      const wx = x + camX, zm = zoneMix(wx, 90), y = ys[x], depth = sea[x];
      if (depth > 0) {
        const wc = "#2f78ad"; R(wc, x, y, 1, H - y);
        const wave = Math.sin(wx * 0.09 + time / 450);
        R(lt(wc, 0.35), x, y + Math.round(wave), 1, 1);
        for (let row = 1; y + row * 7 < H; row++) if ((Math.floor(wx * (1 + row * 0.04)) + row * 11 + Math.floor(time / 600)) % 29 < 3) R(lt(wc, 0.15), x, y + row * 7 + Math.round(Math.sin(wx * 0.15 + time / 300 + row)), 1, 1);
        if (depth < 6) R("#ffffff", x, y, 1, 1);
        continue;
      }
      const g = C("ground", zm), path = C("path", zm), edge = mix(path, g, 0.45);
      R(g, x, y, 1, H - y);
      R(edge, x, y + 1, 1, 1); R(path, x, y + 2, 1, 4); R(edge, x, y + 6, 1, 1);
      if (hash(wx + 13) < 0.03) R(dk(path, 0.18), x, y + 3 + Math.floor(hash(wx + 3) * 2), 1, 1);
      if (depth > -70 && depth <= 0) { // the shore runs diagonally: closer to the sea, water reaches higher up the beach
        const wy = Math.round(y + 8 + (-depth) * 1.6 + Math.sin(wx * 0.2 + time / 600) * 1.5);
        if (wy < H) { R(mix(g, "#8fa9b5", 0.35), x, wy - 3, 1, 3); R("#2f78ad", x, wy, 1, H - wy); R("#ffffff", x, wy, 1, 1); if ((Math.floor(wx) + Math.floor(time / 600)) % 23 < 3) R(lt("#2f78ad", 0.15), x, wy + 6, 1, 1); }
      }
    }
    // foreground grass, flowers, pebbles (lower rows scroll a bit faster for depth)
    for (let row = 0; GROUND + 14 + row * 5 < H; row++) {
      const y = GROUND + 14 + row * 5, spd = 1 + row * 0.03;
      for (let x = 0; x < W; x++) {
        if (sea[x] > -2 || (sea[x] > -70 && y >= ys[x] + 5 + -sea[x] * 1.6)) continue;
        const wx = Math.floor(x + camX * spd) * 3 + row * 1013, r = hash(wx);
        if (r > 0.016) continue;
        const zm = zoneMix(x + camX, 90), g2 = C("ground2", zm), dry = (zm.A.dunes || zm.A.night) && (zm.B.dunes || zm.B.night);
        if (r < 0.01) { R(g2, x, y, 3, 1); R(g2, x + 1, y - 1, 1, 1); if (r < 0.004) R(g2, x - 1, y - 2, 1, 2); }
        else if (!dry) { R(dk(g2, 0.1), x, y, 1, 2); R(pick(["#f2c94c", "#ffffff", "#e889b5", "#b9a3f0"], hash(wx + 5)), x, y - 1, 1, 1); }
        else { R(dk(C("ground", zm), 0.2), x, y, 2, 1); R(lt(C("ground", zm), 0.2), x, y - 1, 1, 1); }
      }
    }
    // boats and jumping fish at sea
    for (const b of boats) { const sx = toScreen(b.x + Math.sin(time / 3000 + b.ph) * 10); if (sx < -20 || sx > W + 20 || sea[Math.max(0, Math.min(W - 1, sx))] < 10) continue;
      const by = GROUND + 2 + Math.round(Math.sin(time / 500 + b.ph)); R("#6d4522", sx - 6, by - 2, 13, 2); R("#8a5a2e", sx - 5, by, 11, 1); R("#4a3018", sx, by - 14, 1, 12);
      for (let i = 0; i < 10; i++) R(b.c === "#f4f1ea" ? "#f4f1ea" : lt(b.c, 0.6), sx + 1, by - 13 + i, Math.ceil(i * 0.6), 1); R(b.c, sx - 1, by - 15, 3, 1); }
    if (sea[HERO_X] > 0 || sea[Math.min(W - 1, HERO_X + 60)] > 0) { const ft = (time % 2600) / 900; if (ft < 1) { const fx = W * 0.62 + Math.floor(time / 2600) % 5 * 17, fy = GROUND + 2 - Math.sin(ft * Math.PI) * 10; if (sea[Math.min(W - 1, Math.round(fx))] > 0) { R("#e07a3a", fx + ft * 12, fy, 2, 1); R("#f2a35c", fx + ft * 12 + 2, fy - 1, 1, 1); } } }
    // dust
    dust = dust.filter((d) => (d.life -= 1) > 0);
    for (const d of dust) { d.x -= d.vx; d.y -= d.vy; ctx.globalAlpha = d.life / 30; R("#f3ead2", d.x, d.y, d.s, d.s); }
    ctx.globalAlpha = 1;
    // the traveler: walks the path, rises smoothly to fly over the sea
    const over = sea[HERO_X] > -10 || sea[Math.max(0, HERO_X - 8)] > -10;
    alt += ((over ? 14 : 0) - alt) * 0.06;
    const hopT = (time - hopAt) / 450, hop = hopT >= 0 && hopT < 1 ? Math.round(Math.sin(hopT * Math.PI) * 9) : 0;
    const flying = alt > 2;
    const gy = flying ? GROUND + 2 : groundAt(HERO_X) + 3;
    const stepping = walking && !flying && Math.floor(stepPx / 4) % 2;
    const blink = !walking && (time % 3800) < 140;
    const frame = stepping ? HERO_B : blink ? HERO_BLINK : HERO_A;
    const shook = time < shakeUntil ? Math.round(Math.sin(time / 25) * 2) : 0;
    const bob = flying ? Math.round(Math.sin(time / 280) * 1.5) : 0;
    const hx = HERO_X - 9 + shook, hy = Math.round(gy - HERO_H - alt - hop + bob + (stepping ? -1 : 0));
    const wing = Math.floor(time / (flying || walking || hop ? 60 : 280)) % 2 ? WING_B : WING_A;
    if (flying) { ctx.globalAlpha = 0.25; R("#0b2a44", HERO_X - 7, GROUND + 3, 14, 1); ctx.globalAlpha = 1; }
    hero(hx, hy, frame, wing);
    // sparkles
    sparks = sparks.filter((p) => (p.life -= 1) > 0);
    for (const p of sparks) { p.x += p.vx; p.y += p.vy; p.vy += 0.06; ctx.globalAlpha = Math.min(1, p.life / 25); R(p.c, p.x, p.y, p.s, p.s); if (p.s > 1 && (p.life % 8) < 4) R("#ffffff", p.x, p.y, 1, 1); }
    ctx.globalAlpha = 1;
    if (special && night > 0.5) { ctx.globalAlpha = 0.08 + 0.03 * Math.sin(time / 700); R("#ffe08a", 0, 0, W, H); ctx.globalAlpha = 1; }
    if (hud) {
      hud.km.textContent = Math.round(odo).toLocaleString() + " km";
      const label = segs.length ? segs[segAt(heroWX)].label : "";
      if (hud.zone.textContent !== label) hud.zone.textContent = label || "";
    }
  }

  function burst(color, n, x, y) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.8; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.2, life: 35 + Math.random() * 30, c: Math.random() < 0.25 ? "#ffffff" : color, s: Math.random() < 0.4 ? 2 : 1 }); } }

  function loop(t) { draw(t); raf = requestAnimationFrame(loop); }
  function nextStopAfter(k) { return regular.find((s) => kmOf(s) > k + 1) || (special && sp && kmOf(sp) - 60 / pxPerKm > k ? sp : null); }

  return {
    setMax(m) { maxScore = Math.max(1, m); pxPerKm = WORLD / (maxScore * KM_PER_POINT); build(); },
    shake() { shakeUntil = performance.now() + 350; },
    // a happy hop and sparkles in the rank's color
    cheer(rank) { if (reduce) return; hopAt = performance.now(); const big = rank === "noor" || rank === "hidden_gem"; burst(RANK_COLOR[rank] || "#ffffff", big ? 46 : 18, HERO_X, GROUND - 16); if (rank === "noor") burst("#fff3c4", 20, HERO_X, GROUND - 22); },
    celebrate() { if (reduce) return; burst("#f2c94c", 30, HERO_X + 40, GROUND - 40); burst("#3fcf8e", 16, HERO_X + 60, GROUND - 46); },
    reset() { km = 0; odo = 0; special = false; dust = []; sparks = []; },
    start() { if (!raf) raf = requestAnimationFrame(loop); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    // Travel to a score. Calls onArrive(stop) for each stop passed. Resolves when done.
    travelTo(score, isSpecial, onArrive) {
      special = !!isSpecial;
      let target = score * KM_PER_POINT;
      if (!special && sp) target = Math.min(target, gateKm() - 34 / pxPerKm); // the gate stays shut
      if (special && sp) target = kmOf(sp) - (lmOf(sp).hw + 16) / pxPerKm; // stop in front of it
      const from = km, dist = target - from, odoFrom = odo, odoTo = score * KM_PER_POINT;
      if (reduce || dist <= 0.5) {
        for (const s of regular) if (kmOf(s) > from && kmOf(s) <= target) onArrive?.(s);
        if (special && sp && target > from) onArrive?.(sp);
        km = Math.max(km, target); odo = odoTo; return Promise.resolve();
      }
      const dur = Math.min(5200, 1000 + dist * pxPerKm * 4);
      const t0 = performance.now(), passed = new Set();
      walking = true;
      return new Promise((done) => {
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur), prev = km;
          km = from + dist * ease(p);
          odo = odoFrom + (odoTo - odoFrom) * ease(p);
          stepPx += (km - prev) * pxPerKm;
          if (seaDepth(km * pxPerKm) < -10 && Math.random() < 0.35) dust.push({ x: HERO_X - 6, y: GROUND + 3 + bump(km * pxPerKm), vx: 0.6 + Math.random(), vy: Math.random() * 0.4, s: 1 + (Math.random() < 0.3), life: 30 });
          for (const s of [...regular, ...(special && sp ? [sp] : [])]) {
            const at = s.special ? target : kmOf(s);
            if (!passed.has(s) && kmOf(s) > from && at <= target && km >= at - 0.5) { passed.add(s); onArrive?.(s); }
          }
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
  const prev = ctx;
  ctx = canvas.getContext("2d");
  canvas.width = 20; canvas.height = 24;
  hero(1, 1, HERO_A, WING_A, 1);
  ctx = prev;
}
