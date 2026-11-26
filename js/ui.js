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
