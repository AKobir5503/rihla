// Shared UI bits: escaping, sign-in dialog, journey track.
import { api, DEMO } from "./data.js";
import { ROUTES, ROUTE_NAME, RANKS, RANK_ORDER, SPECIAL_MIN_RANK } from "./config.js";

export const $ = (s, el = document) => el.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const ROUTE = ROUTES[ROUTE_NAME] || ROUTES.masjids;

export function rankChip(rank) {
  const r = RANKS[rank] || RANKS.lost;
  return `<span class="chip rank-${rank}">${esc(r.label)}</span>`;
}

export function isSpecialRun(ranks) {
  const cut = RANK_ORDER.indexOf(SPECIAL_MIN_RANK);
  return ranks.length > 0 && ranks.every((r) => RANK_ORDER.indexOf(r) <= cut && r !== "lost");
}

// Which stop a score reaches. `special` only when every answer qualifies.
export function stopFor(score, max, special) {
  const regular = ROUTE.filter((s) => !s.special);
  if (special) return ROUTE.find((s) => s.special) || regular[regular.length - 1];
  const frac = max ? score / max : 0;
  let cur = regular[0];
  for (const s of regular) if (frac >= s.at) cur = s;
  return cur;
}

// Draw the horizontal route once; stops evenly spaced so labels stay readable.
export function drawTrack() {
  const track = $("#track");
  track.querySelectorAll(".stop").forEach((n) => n.remove());
  ROUTE.forEach((s, i) => {
    const x = (i / (ROUTE.length - 1)) * 100;
    const el = document.createElement("div");
    el.className = "stop" + (s.special ? " special" : "") + (i % 2 ? " below" : " above");
    el.style.left = x + "%";
    el.dataset.i = i;
    el.innerHTML = `<span class="dot"></span><span class="label"><b>${esc(s.name)}</b>${s.place ? `<small>${esc(s.place)}</small>` : ""}</span>`;
    track.appendChild(el);
  });
  moveTraveler(0, 1, false);
}

// Position the traveler between stops according to score.
export function moveTraveler(score, max, special) {
  const regular = ROUTE.filter((s) => !s.special);
  const idxOf = (s) => ROUTE.indexOf(s);
  const xOf = (i) => (i / (ROUTE.length - 1)) * 100;
  let x;
  if (special) x = xOf(ROUTE.findIndex((s) => s.special));
  else {
    const frac = max ? score / max : 0;
    let i = 0;
    while (i < regular.length - 1 && frac >= regular[i + 1].at) i++;
    const a = regular[i], b = regular[i + 1];
    const t = b ? Math.min(1, (frac - a.at) / (b.at - a.at)) * 0.6 : 0; // creep toward next stop
    x = xOf(idxOf(a)) + (b ? (xOf(idxOf(b)) - xOf(idxOf(a))) * t : 0);
  }
  $("#traveler").style.left = x + "%";
  $("#track-fill").style.width = x + "%";
  const reached = stopFor(score, max, special);
  document.querySelectorAll(".stop").forEach((n) => n.classList.toggle("reached", Number(n.dataset.i) <= ROUTE.indexOf(reached) && (!ROUTE[n.dataset.i].special || special)));
  $("#journey-caption").innerHTML = `Now at <b>${esc(reached.name)}</b>${reached.place && !reached.special ? `, ${esc(reached.place)}` : ""}`;
}

// ---------- sign in / sign up ----------
export function setupAuth(onChange) {
  const dlg = $("#auth-dialog"), form = $("#auth-form");
  let signup = false;
  const setMode = (s) => {
    signup = s;
    $("#auth-title").textContent = s ? "Create an account" : "Sign in to play";
    $("#auth-submit").textContent = s ? "Create account" : "Sign in";
    $("#auth-toggle").textContent = s ? "Have an account? Sign in" : "New here? Create an account";
    $("#name-row").classList.toggle("hidden", !s);
    $("#auth-error").textContent = "";
  };
  if (DEMO) $("#auth-hint").textContent = "Demo mode: any email and password, saved only in this browser.";
  $("#auth-toggle").onclick = () => setMode(!signup);
  $("#auth-close").onclick = () => dlg.close();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    $("#auth-error").textContent = "";
    $("#auth-submit").disabled = true;
    try {
      const u = signup
        ? await api.signUp(f.get("email"), f.get("password"), (f.get("name") || "").trim() || String(f.get("email")).split("@")[0])
        : await api.signIn(f.get("email"), f.get("password"));
      if (!u) throw new Error("Check your email to confirm your account, then sign in.");
      dlg.close(); form.reset(); onChange(u);
    } catch (err) {
      $("#auth-error").textContent = err.message || "Something went wrong.";
    } finally { $("#auth-submit").disabled = false; }
  };
  return {
    open(s = false) { setMode(s); dlg.showModal(); },
  };
}
