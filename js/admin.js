// Dashboard for board/committee members: make games, write questions, build answer lists.
import { api, DEMO } from "./data.js";
import { RANKS, RANK_ORDER, DEFAULT_TIMER_SECONDS } from "./config.js";
import { $, esc, setupAuth } from "./ui.js";

const root = $("#admin");

// Small in-page messages and two-click confirms (pop-up dialogs are blocked in some embeds).
function toast(msg) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 4000);
}
function twoClick(btn, label, action) {
  btn.onclick = () => {
    if (btn.dataset.armed) return action();
    const orig = btn.textContent; btn.dataset.armed = "1"; btn.textContent = label;
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = orig; }, 3000);
  };
}
let user = null, games = [], draft = null, dirty = false;

const auth = setupAuth((u) => { user = u; boot(); });
$("#nav-account").onclick = () => (user ? (api.signOut(), (user = null), boot()) : auth.open(false));
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

const blankAnswer = () => ({ text: "", aliases: [], rank: "footstep" });
const blankQuestion = () => ({ prompt: "", noor_source: "", answers: [blankAnswer()] });

async function boot() {
  if (DEMO) $("#demo-banner").classList.remove("hidden");
  try { user = user || (await api.getUser()); } catch { user = null; }
  $("#nav-account").textContent = user ? `Sign out (${user.display_name})` : "Sign in";
  if (!user) { root.innerHTML = `<h1>Dashboard</h1><p>Sign in to manage games.</p><button class="primary" id="si">Sign in</button>`; $("#si").onclick = () => auth.open(false); return; }
  if (!user.is_admin) { root.innerHTML = `<h1>Dashboard</h1><p>Your account doesn't have dashboard access yet. Ask an admin to add you (see README: "Give someone dashboard access").</p>`; return; }
  list();
}

// ---------------- list of games ----------------
async function list() {
  root.innerHTML = `<p class="muted">Loading…</p>`;
  games = await api.listGames();
  root.innerHTML = `
    <div class="qhead"><h1>Games</h1><button class="primary" id="new">New game</button></div>
    <p class="muted small">Players get the newest <b>published</b> game whose date is today or earlier. Share a specific game with <code>?game=ID</code>.</p>
    ${games.length ? `<ul class="gamelist">${games.map((g) => `
      <li><b>${esc(g.title)}</b> <span class="muted">${esc(g.play_date || "no date")} · ${g.questions.length} questions</span>
        <span class="pill ${g.published ? "on" : ""}">${g.published ? "published" : "draft"}</span>
        <button class="link" data-edit="${esc(g.id)}">Edit</button>
        <a class="link" href="./?game=${encodeURIComponent(g.id)}" target="_blank">Preview</a>
        <button class="link" data-del="${esc(g.id)}">Delete</button></li>`).join("")}</ul>` : `<p>No games yet.</p>`}`;
  $("#new").onclick = () => edit({ id: "new", title: "", play_date: new Date().toLocaleDateString("en-CA"), timer_seconds: DEFAULT_TIMER_SECONDS, published: false, questions: [blankQuestion()] });
  root.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => edit(structuredClone(games.find((g) => String(g.id) === b.dataset.edit)))));
  root.querySelectorAll("[data-del]").forEach((b) => twoClick(b, "Click again to delete game + leaderboard", async () => {
    await api.deleteGame(b.dataset.del); list();
  }));
}

// ---------------- editor ----------------
function edit(game) {
  draft = game; dirty = false; render();
}

function render() {
  const g = draft;
  root.innerHTML = `
    <div class="qhead"><h1>${g.id === "new" ? "New game" : "Edit game"}</h1><button class="link" id="back">← All games</button></div>
    <div class="grid2">
      <label>Title <input id="g-title" value="${esc(g.title)}" placeholder="e.g. December Newsletter Journey" /></label>
      <label>Play date <input id="g-date" type="date" value="${esc(g.play_date || "")}" /></label>
      <label>Seconds per question <input id="g-timer" type="number" min="5" max="120" value="${esc(g.timer_seconds)}" /></label>
      <label style="align-self:end"><input id="g-pub" type="checkbox" style="width:auto" ${g.published ? "checked" : ""}/> Published (players can see it)</label>
    </div>
    ${g.questions.map(qCard).join("")}
    <div class="row"><button id="addq">+ Add question</button></div>
    <div class="row"><button class="primary big" id="save">Save game</button><span class="muted small" id="save-msg"></span></div>`;

  twoClick($("#back"), "Unsaved changes. Click again to discard", () => { dirty = false; list(); });
  const armBack = $("#back").onclick;
  $("#back").onclick = () => (dirty ? armBack() : list());
  $("#g-title").oninput = (e) => { g.title = e.target.value; dirty = true; };
  $("#g-date").oninput = (e) => { g.play_date = e.target.value; dirty = true; };
  $("#g-timer").oninput = (e) => { g.timer_seconds = Number(e.target.value) || DEFAULT_TIMER_SECONDS; dirty = true; };
  $("#g-pub").onchange = (e) => { g.published = e.target.checked; dirty = true; };
  $("#addq").onclick = () => { g.questions.push(blankQuestion()); dirty = true; render(); };
  $("#save").onclick = save;

  root.querySelectorAll(".qcard").forEach((card) => {
    const qi = Number(card.dataset.q), q = g.questions[qi];
    card.querySelector(".q-prompt").oninput = (e) => { q.prompt = e.target.value; dirty = true; };
    card.querySelector(".q-src").oninput = (e) => { q.noor_source = e.target.value; dirty = true; };
    twoClick(card.querySelector(".q-del"), "Click again to remove", () => { g.questions.splice(qi, 1); dirty = true; render(); });
    card.querySelector(".q-up").onclick = () => { if (qi > 0) { [g.questions[qi - 1], g.questions[qi]] = [g.questions[qi], g.questions[qi - 1]]; dirty = true; render(); } };
    card.querySelector(".a-add").onclick = () => { q.answers.push(blankAnswer()); dirty = true; render(); };
    card.querySelector(".a-paste").onclick = () => card.querySelector(".paste-box").classList.toggle("hidden");
    card.querySelector(".paste-go").onclick = () => pasteAnswers(q, card.querySelector(".paste-text").value);
    card.querySelector(".a-ai").onclick = (e) => aiAnswers(q, e.target);
    card.querySelectorAll("tr[data-a]").forEach((tr) => {
      const a = q.answers[Number(tr.dataset.a)];
      tr.querySelector(".a-text").oninput = (e) => { a.text = e.target.value; dirty = true; };
      tr.querySelector(".a-alias").oninput = (e) => { a.aliases = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); dirty = true; };
      tr.querySelector(".a-rank").onchange = (e) => { a.rank = e.target.value; dirty = true; };
      tr.querySelector(".a-del").onclick = () => { q.answers.splice(Number(tr.dataset.a), 1); dirty = true; render(); };
    });
  });
}

function qCard(q, qi) {
  const counts = RANK_ORDER.map((r) => [r, q.answers.filter((a) => a.rank === r).length]).filter(([, n]) => n);
  const noorCount = q.answers.filter((a) => a.rank === "noor").length;
  return `
  <div class="qcard" data-q="${qi}">
    <div class="qhead"><b>Question ${qi + 1}</b><span><button class="link q-up" title="Move up">↑</button><button class="link q-del">Remove</button></span></div>
    <label>Question <textarea class="q-prompt" placeholder="Name a …">${esc(q.prompt)}</textarea></label>
    <label>Where the Noor answer comes from (shown after playing) <input class="q-src" value="${esc(q.noor_source || "")}" placeholder="e.g. November newsletter, Halaqa recap: …" /></label>
    <p class="small muted">${counts.map(([r, n]) => `${esc(RANKS[r].label)}: ${n}`).join(" · ") || "No answers yet"}${noorCount !== 1 ? ` · <span class="error">Tip: mark exactly one answer as Noor</span>` : ""}</p>
    <table><thead><tr><th>Answer</th><th>Other spellings (comma separated)</th><th>Rank</th><th></th></tr></thead><tbody>
      ${q.answers.map((a, ai) => `<tr data-a="${ai}">
        <td><input class="a-text" value="${esc(a.text)}" /></td>
        <td><input class="a-alias" value="${esc((a.aliases || []).join(", "))}" /></td>
        <td><select class="a-rank">${RANK_ORDER.map((r) => `<option value="${r}" ${a.rank === r ? "selected" : ""}>${esc(RANKS[r].label)}</option>`).join("")}</select></td>
        <td><button class="link a-del" title="Delete answer">×</button></td></tr>`).join("")}
    </tbody></table>
    <div class="row"><button class="a-add">+ Answer</button><button class="a-paste">Paste a list</button><button class="a-ai">Suggest answers with AI</button></div>
    <div class="paste-box hidden"><label>One answer per line. Optional: <code>answer | rank | spelling1, spelling2</code> (ranks: ${RANK_ORDER.join(", ")})<textarea class="paste-text" rows="6"></textarea></label><button class="primary paste-go">Add these answers</button></div>
    <p class="small muted">"Lost" rows are known wrong answers, so common wrong guesses are recognized instantly without asking the AI.</p>
  </div>`;
}

function pasteAnswers(q, txt) {
  if (!txt || !txt.trim()) return toast("Paste at least one answer.");
  for (const line of txt.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [text, rank, al] = line.split("|").map((s) => (s || "").trim());
    q.answers.push({ text, rank: RANK_ORDER.includes(rank) ? rank : "footstep", aliases: (al || "").split(",").map((s) => s.trim()).filter(Boolean) });
  }
  q.answers = q.answers.filter((a) => a.text);
  dirty = true; render();
}

async function aiAnswers(q, btn) {
  if (!q.prompt.trim()) return toast("Write the question first.");
  btn.disabled = true; btn.textContent = "Thinking… (up to a minute)";
  try {
    const noor = q.answers.find((a) => a.rank === "noor");
    const notes = [q.noor_source && `Newsletter context: ${q.noor_source}`, noor && `The Noor (newsletter) answer is: ${noor.text}`].filter(Boolean).join("\n");
    const got = await api.generateAnswers(q.prompt, notes);
    const have = new Set(q.answers.map((a) => a.text.trim().toLowerCase()));
    for (const a of got) if (!have.has(a.text.trim().toLowerCase())) q.answers.push({ text: a.text, aliases: a.aliases || [], rank: a.rank });
    q.answers = q.answers.filter((a) => a.text.trim());
    dirty = true; render();
  } catch (e) {
    toast(e.message); btn.disabled = false; btn.textContent = "Suggest answers with AI";
  }
}

async function save() {
  const g = draft;
  if (!g.title.trim()) return toast("Give the game a title.");
  g.questions = g.questions.filter((q) => q.prompt.trim());
  if (!g.questions.length) return toast("Add at least one question.");
  $("#save").disabled = true; $("#save-msg").textContent = "Saving…";
  try {
    const saved = await api.saveGame(g);
    dirty = false;
    $("#save-msg").textContent = "Saved.";
    draft.id = saved.id;
    setTimeout(list, 600);
  } catch (e) {
    $("#save-msg").textContent = ""; toast("Couldn't save: " + e.message);
  } finally { $("#save").disabled = false; }
}

boot();
