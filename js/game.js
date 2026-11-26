// The player-facing game.
import { api, DEMO } from "./data.js";
import { RANKS, RANK_ORDER, DEFAULT_TIMER_SECONDS, KM_PER_POINT } from "./config.js";
import { matchAnswer } from "./match.js";
import { $, esc, rankChip, stopFor, isSpecialRun, setupAuth } from "./ui.js";
import { createScene, drawMascot } from "./scene.js";

const app = $("#app");
const S = { user: null, game: null, i: 0, results: [], score: 0, timer: null, deadline: 0, busy: false };
const maxScore = () => (S.game ? S.game.questions.length * RANKS.noor.points : 1);
const scene = createScene($("#scene"), { km: $("#hud-km"), zone: $("#hud-zone") });
const fmtKm = (pts) => (pts * KM_PER_POINT).toLocaleString() + " km";

function showNext() {
  const n = scene.nextStop();
  $("#hud-next").textContent = !n ? "" : n.locked ? `Ahead: ${n.stop.name}. The gate opens only when every answer is a Hidden Gem or better.` : `Next: ${n.stop.name} · ${n.km.toLocaleString()} km`;
}
let arriveTimer = 0;
function arrive(stop) {
  const el = $("#arrive");
  el.innerHTML = `<small>${stop.special ? "The gate opens" : "Arrived"}</small>${esc(stop.name)}${stop.place && !stop.special ? `<small>${esc(stop.place)}</small>` : ""}`;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  clearTimeout(arriveTimer); arriveTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

const auth = setupAuth((u) => { S.user = u; refreshNav(); home(); });

function refreshNav() {
  $("#nav-account").textContent = S.user ? S.user.display_name : "Sign in";
  $("#nav-admin").classList.toggle("hidden", !(S.user && S.user.is_admin));
}

$("#nav-account").onclick = () => (S.user ? accountView() : auth.open(false));
$("#nav-board").onclick = () => leaderboardView();

// ---------------- home ----------------
async function home() {
  stopTimer();
  scene.reset(); $("#arrive").classList.remove("show");
  if (!S.game) {
    app.innerHTML = `<p class="muted">Loading today's journey…</p>`;
    const id = new URLSearchParams(location.search).get("game");
    try { S.game = await api.getCurrentGame(id); } catch (e) { app.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
  }
  if (S.game) { scene.setMax(maxScore()); showNext(); }
  if (!S.game || !S.game.questions.length) {
    app.innerHTML = `<h1>No journey today</h1><p class="muted">Check back soon. New questions drop with the MSA newsletter.</p>`;
    return;
  }
  const past = S.user ? await api.myAttempts(S.game, S.user) : [];
  const first = past.length ? [...past].sort((a, b) => a.attempt_no - b.attempt_no)[0] : null;
  app.innerHTML = `
    <p class="eyebrow">${esc(S.game.title)}</p>
    <h1>Rarer answers take you farther.</h1>
    <p>${S.game.questions.length} questions, ${esc(S.game.timer_seconds || DEFAULT_TIMER_SECONDS)} seconds each. Every point is ${KM_PER_POINT} km of travel: common answers move your camel a few steps, rare ones carry it across oceans. Answer every question with a Hidden Gem or better and the final gate opens. The <b>Noor</b> answer to each question is hiding in the latest GT MSA newsletter.</p>
    <ul class="ranks">${RANK_ORDER.map((r) => `<li>${rankChip(r)} <span class="muted">${RANKS[r].points} pts · ${esc(RANKS[r].blurb)}</span></li>`).join("")}</ul>
    ${first ? `<p class="note">Your first run scored <b>${first.score}</b>. That's the score on the leaderboard. You've played ${past.length} time${past.length > 1 ? "s" : ""}; replays are just for fun.</p>` : ""}
    <div class="row"><button class="primary big" id="start">${first ? "Play again" : "Start the journey"}</button></div>`;
  $("#start").onclick = () => (S.user ? start() : auth.open(true));
}

// ---------------- play ----------------
function start() {
  S.i = 0; S.results = []; S.score = 0;
  scene.reset(); scene.setMax(maxScore()); showNext();
  ask();
}

function ask() {
  const q = S.game.questions[S.i];
  const secs = Number(S.game.timer_seconds) || DEFAULT_TIMER_SECONDS;
  app.innerHTML = `
    <div class="qhead"><span class="eyebrow">Question ${S.i + 1} of ${S.game.questions.length}</span><span class="score">${S.score} pts</span></div>
    <div class="timer"><div class="timer-fill" id="timer-fill"></div></div>
    <h2 class="prompt">${esc(q.prompt)}</h2>
    <form id="answer-form" autocomplete="off">
      <div class="combo">
        <input id="answer" maxlength="80" placeholder="Type your answer" aria-label="Your answer" autocapitalize="off" spellcheck="false" />
      </div>
      <button class="primary" id="submit">Submit</button>
    </form>
    <p class="muted small" id="time-left">${secs}s</p>`;
  const input = $("#answer");
  $("#answer-form").onsubmit = (e) => { e.preventDefault(); submit(input.value); };
  input.focus();
  startTimer(secs, () => submit(input.value, true));
}

function startTimer(secs, onEnd) {
  stopTimer();
  S.deadline = Date.now() + secs * 1000;
  const fill = $("#timer-fill"), label = $("#time-left");
  const tick = () => {
    const left = Math.max(0, S.deadline - Date.now());
    if (fill) fill.style.width = (left / (secs * 1000)) * 100 + "%";
    if (fill) fill.classList.toggle("low", left < 5000);
    if (label) label.textContent = Math.ceil(left / 1000) + "s";
    if (left <= 0) { stopTimer(); onEnd(); }
  };
  tick();
  S.timer = setInterval(tick, 100);
}
function stopTimer() { if (S.timer) clearInterval(S.timer); S.timer = null; }

async function submit(raw, timedOut = false) {
  if (S.busy) return;
  S.busy = true; stopTimer();
  const q = S.game.questions[S.i];
  const text = (raw || "").trim();
  let rank = "lost", matched = null;
  if (text) {
    const m = matchAnswer(text, q.answers);
    if (m) { rank = m.answer.rank; matched = m.answer; }
    else if (!DEMO) {
      $("#submit").disabled = true; $("#submit").textContent = "Checking…";
      const j = await api.judge(q, text);
      rank = j.rank || "lost"; matched = j.answer || null;
      if (matched && !q.answers.some((a) => a.id === matched.id)) q.answers.push(matched); // remember for reveal + next time
    }
  }
  const pts = RANKS[rank]?.points ?? 0;
  S.score += pts;
  S.results.push({ question_id: q.id, input: text, matched: matched ? matched.text : null, rank, points: pts, timed_out: timedOut && !text });
  flash(rank, pts, text, matched, timedOut);
  const nextBtn = $("#next");
  nextBtn.disabled = true;
  const last = S.i === S.game.questions.length - 1;
  // On the last answer of an all-Hidden-Gem run, the camel goes through the gate.
  const special = last && isSpecialRun(S.results.map((r) => r.rank));
  await scene.travelTo(S.score, special, arrive);
  showNext();
  nextBtn.disabled = false; nextBtn.focus();
  S.busy = false;
}

function flash(rank, pts, text, matched, timedOut) {
  const last = S.i === S.game.questions.length - 1;
  app.innerHTML = `
    <div class="flash rank-${rank}">
      <div class="flash-rank">${esc(RANKS[rank].label)}</div>
      <div class="flash-pts">+${pts}<small> pts · ${fmtKm(pts)}</small></div>
      <p class="muted">${!text ? (timedOut ? "Time's up." : "No answer.") : matched && matched.text.toLowerCase() !== text.toLowerCase() ? `Counted as <b>${esc(matched.text)}</b>` : `“${esc(text)}”`}</p>
      <button class="primary" id="next">${last ? "See where you landed" : "Next question"}</button>
    </div>`;
  const go = () => { S.i++; last ? finish() : ask(); };
  $("#next").onclick = go;
}

async function finish() {
  const special = isSpecialRun(S.results.map((r) => r.rank));
  const stop = stopFor(S.score, maxScore(), special);
  let saved = null, saveErr = "";
  try { saved = await api.saveAttempt(S.game, S.user, S.results, S.score); } catch (e) { saveErr = e.message; }
  app.innerHTML = `
    <div class="end ${special ? "special" : ""}">
      <p class="eyebrow">Journey complete</p>
      <h1>You reached ${esc(stop.name)}</h1>
      <p class="big-score">${fmtKm(S.score)}</p>
      <p class="muted">${S.score} / ${maxScore()} pts</p>
      ${special ? `<p>Every answer was a Hidden Gem or better. MashaAllah.</p>` : ""}
      ${saved ? `<p class="muted small">${saved.attempt_no === 1 ? "This is your leaderboard score." : `Replay #${saved.attempt_no}. The leaderboard keeps your first score.`}</p>` : ""}
      ${saveErr ? `<p class="error">Couldn't save this run: ${esc(saveErr)}</p>` : ""}
      <div class="row"><button class="primary" id="board">Leaderboard</button><button id="again">Play again</button><button id="share">Copy result</button></div>
    </div>
    <h2>All the answers</h2>
    ${S.game.questions.map((q, k) => reveal(q, S.results[k])).join("")}`;
  $("#board").onclick = () => leaderboardView();
  $("#again").onclick = () => start();
  $("#share").onclick = async () => {
    const line = S.results.map((r) => ({ noor: "🌟", hidden_gem: "💎", scholar: "📜", pathfinder: "🧭", traveler: "🐪", footstep: "👣", lost: "⬜" }[r.rank])).join("");
    const t = `Rihla · ${S.game.title}\nI traveled ${fmtKm(S.score)} and reached ${stop.name}\n${line}\n${location.href.split("?")[0]}`;
    try { await navigator.clipboard.writeText(t); $("#share").textContent = "Copied!"; } catch { $("#share").textContent = "Copy failed"; }
  };
}

function reveal(q, mine) {
  const groups = RANK_ORDER.filter((r) => r !== "lost").map((r) => ({ r, list: q.answers.filter((a) => a.rank === r) })).filter((g) => g.list.length);
  return `
    <details class="reveal" open>
      <summary><span>${esc(q.prompt)}</span> ${mine ? rankChip(mine.rank) : ""}</summary>
      ${mine ? `<p class="small">You said: <b>${esc(mine.input || "(nothing)")}</b>${mine.matched && mine.matched !== mine.input ? ` → ${esc(mine.matched)}` : ""} · +${mine.points}</p>` : ""}
      ${groups.map((g) => `<div class="group">${rankChip(g.r)} ${g.list.map((a) => `<span class="ans ${mine && mine.matched === a.text ? "mine" : ""}">${esc(a.text)}</span>`).join("")}</div>`).join("")}
      ${q.noor_source ? `<p class="noor-src"><b>Where the Noor answer came from:</b> ${esc(q.noor_source)}</p>` : ""}
    </details>`;
}

// ---------------- leaderboard ----------------
async function leaderboardView() {
  stopTimer();
  if (!S.game) await home();
  if (!S.game) return;
  app.innerHTML = `<p class="muted">Loading leaderboard…</p>`;
  let rows = [];
  try { rows = await api.leaderboard(S.game); } catch (e) { app.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
  app.innerHTML = `
    <p class="eyebrow">${esc(S.game.title)}</p>
    <h1>Leaderboard</h1>
    <p class="muted small">Ranked by each traveler's first run. Replays are counted but don't change the score.</p>
    ${rows.length ? `<table class="board"><thead><tr><th>#</th><th>Traveler</th><th>Score</th><th>Distance</th><th>Reached</th><th>Plays</th></tr></thead><tbody>
      ${rows.map((r, k) => `<tr><td>${k + 1}</td><td>${esc(r.display_name)}</td><td>${r.score}</td><td>${fmtKm(r.score)}</td><td class="muted">${esc(stopFor(r.score, maxScore(), false).name)}</td><td>${r.attempts}</td></tr>`).join("")}
    </tbody></table>` : `<p>No one has finished this journey yet. Be the first.</p>`}
    <div class="row"><button class="primary" id="back">Back</button></div>`;
  $("#back").onclick = () => home();
}

// ---------------- account ----------------
function accountView() {
  stopTimer();
  app.innerHTML = `
    <h1>Your account</h1>
    <p class="muted">${esc(S.user.email)}</p>
    <form id="name-form" class="row"><label>Display name <input name="n" maxlength="30" value="${esc(S.user.display_name)}" /></label><button class="primary">Save</button></form>
    <div class="row"><button id="out">Sign out</button><button id="back">Back</button></div>`;
  $("#name-form").onsubmit = async (e) => { e.preventDefault(); S.user = await api.updateName(new FormData(e.target).get("n").trim()); refreshNav(); home(); };
  $("#out").onclick = async () => { await api.signOut(); S.user = null; refreshNav(); home(); };
  $("#back").onclick = () => home();
}

// ---------------- boot ----------------
(async function boot() {
  if (DEMO) $("#demo-banner").classList.remove("hidden");
  drawMascot($("#mascot"));
  scene.start();
  try { S.user = await api.getUser(); } catch { S.user = null; }
  refreshNav();
  home();
})();
