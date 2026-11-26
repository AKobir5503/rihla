// Data layer. Two interchangeable backends with the same functions:
//  - DEMO: everything in this browser's localStorage, sample game, no AI.
//  - LIVE: Supabase (accounts, games, leaderboard) + edge functions (Claude).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { SAMPLE_GAME } from "./sample.js";

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// ---------- tiny localStorage helpers (never throw) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("rihla:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("rihla:" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// =====================================================================
// DEMO backend
// =====================================================================
const demo = {
  async getUser() { return store.get("demoUser", null); },
  async signUp(email, _pw, name) { const u = { id: "local:" + email.toLowerCase(), email, display_name: name || email.split("@")[0], is_admin: true }; store.set("demoUser", u); return u; },
  async signIn(email, pw) { const u = store.get("demoUser", null); if (u && u.email.toLowerCase() === email.toLowerCase()) return u; return demo.signUp(email, pw); },
  async signOut() { store.set("demoUser", null); },
  async updateName(name) { const u = store.get("demoUser", null); if (u) { u.display_name = name; store.set("demoUser", u); } return u; },

  games() { return store.get("demoGames", [SAMPLE_GAME]); },
  async getCurrentGame(id) {
    const gs = demo.games().filter((g) => g.published);
    return (id ? gs.find((g) => g.id === id) : gs[gs.length - 1]) || null;
  },
  async judge() { return { rank: "lost", answer: null }; }, // no AI in demo mode
  async saveAttempt(game, user, results, score) {
    const all = store.get("demoAttempts", []);
    const mine = all.filter((a) => a.game_id === game.id && a.user_id === user.id);
    const row = { game_id: game.id, user_id: user.id, display_name: user.display_name, attempt_no: mine.length + 1, score, results, finished_at: new Date().toISOString() };
    all.push(row); store.set("demoAttempts", all);
    return row;
  },
  async myAttempts(game, user) { return store.get("demoAttempts", []).filter((a) => a.game_id === game.id && a.user_id === user.id); },
  async leaderboard(game) { return leaderboardFrom(store.get("demoAttempts", []).filter((a) => a.game_id === game.id)); },

  // admin
  async listGames() { return demo.games(); },
  async saveGame(game) {
    const gs = demo.games();
    if (!game.id) game.id = "g" + Date.now();
    const i = gs.findIndex((g) => g.id === game.id);
    if (i >= 0) gs[i] = game; else gs.push(game);
    store.set("demoGames", gs); return game;
  },
  async deleteGame(id) { store.set("demoGames", demo.games().filter((g) => g.id !== id)); },
  async generateAnswers() { throw new Error("AI answer generation needs the live setup (Supabase + Claude key). In demo mode, type answers by hand."); },
};

function leaderboardFrom(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = r.user_id;
    const cur = by.get(k) || { user_id: k, display_name: r.display_name, attempts: 0, first: null };
    cur.attempts++;
    if (!cur.first || r.attempt_no < cur.first.attempt_no) cur.first = r;
    by.set(k, cur);
  }
  return [...by.values()]
    .map((x) => ({ display_name: x.display_name, score: x.first.score, attempts: x.attempts, finished_at: x.first.finished_at }))
    .sort((a, b) => b.score - a.score || a.finished_at.localeCompare(b.finished_at));
}

// =====================================================================
// LIVE backend (Supabase)
// =====================================================================
let sb = null;
async function client() {
  if (!sb) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sb;
}
function check({ data, error }) { if (error) throw new Error(error.message); return data; }

async function loadGameFull(c, game) {
  const qs = check(await c.from("questions").select("id, position, prompt, noor_source, answers(id, text, aliases, rank)").eq("game_id", game.id).order("position"));
  return { ...game, questions: qs.map((q) => ({ ...q, answers: q.answers || [] })) };
}

const live = {
  async getUser() {
    const c = await client();
    const { data } = await c.auth.getUser();
    if (!data?.user) return null;
    const p = check(await c.from("profiles").select("display_name, is_admin").eq("id", data.user.id).maybeSingle()) || {};
    return { id: data.user.id, email: data.user.email, display_name: p.display_name || data.user.email.split("@")[0], is_admin: !!p.is_admin };
  },
  async signUp(email, pw, name) {
    const c = await client();
    check(await c.auth.signUp({ email, password: pw, options: { data: { display_name: name } } }));
    return live.getUser();
  },
  async signIn(email, pw) { const c = await client(); check(await c.auth.signInWithPassword({ email, password: pw })); return live.getUser(); },
  async signOut() { const c = await client(); await c.auth.signOut(); },
  async updateName(name) { const c = await client(); const u = await live.getUser(); check(await c.from("profiles").update({ display_name: name }).eq("id", u.id)); return live.getUser(); },

  async getCurrentGame(id) {
    const c = await client();
    let q = c.from("games").select("*").eq("published", true);
    q = id ? q.eq("id", id) : q.lte("play_date", new Date().toLocaleDateString("en-CA")).order("play_date", { ascending: false }).order("created_at", { ascending: false });
    const g = check(await q.limit(1).maybeSingle());
    return g ? loadGameFull(c, g) : null;
  },
  async judge(question, text) {
    const c = await client();
    const { data, error } = await c.functions.invoke("judge", { body: { question_id: question.id, text } });
    if (error || !data) return { rank: "lost", answer: null };
    return data; // { rank, answer: {id,text,aliases,rank} | null }
  },
  async saveAttempt(game, user, results, score) {
    const c = await client();
    return check(await c.from("attempts").insert({ game_id: game.id, user_id: user.id, score, results }).select().single());
  },
  async myAttempts(game, user) {
    const c = await client();
    return check(await c.from("attempts").select("attempt_no, score, finished_at").eq("game_id", game.id).eq("user_id", user.id));
  },
  async leaderboard(game) {
    const c = await client();
    return check(await c.from("leaderboard").select("display_name, score, attempts, finished_at").eq("game_id", game.id).order("score", { ascending: false }).order("finished_at").limit(100));
  },

  // admin
  async listGames() {
    const c = await client();
    const gs = check(await c.from("games").select("*").order("play_date", { ascending: false, nullsFirst: true }));
    return Promise.all(gs.map((g) => loadGameFull(c, g)));
  },
  async saveGame(game) {
    const c = await client();
    const { questions, ...g } = game;
    const row = { title: g.title, play_date: g.play_date || null, timer_seconds: g.timer_seconds, published: !!g.published };
    const saved = g.id && !String(g.id).startsWith("new")
      ? check(await c.from("games").update(row).eq("id", g.id).select().single())
      : check(await c.from("games").insert(row).select().single());
    // Replace questions + answers wholesale: simple and safe for small games.
    check(await c.from("questions").delete().eq("game_id", saved.id));
    for (const [i, q] of questions.entries()) {
      const sq = check(await c.from("questions").insert({ game_id: saved.id, position: i + 1, prompt: q.prompt, noor_source: q.noor_source || null }).select().single());
      const rows = (q.answers || []).filter((a) => a.text.trim()).map((a) => ({ question_id: sq.id, text: a.text.trim(), aliases: a.aliases || [], rank: a.rank }));
      if (rows.length) check(await c.from("answers").insert(rows));
    }
    return saved;
  },
  async deleteGame(id) { const c = await client(); check(await c.from("games").delete().eq("id", id)); },
  async generateAnswers(prompt, notes) {
    const c = await client();
    const { data, error } = await c.functions.invoke("generate", { body: { prompt, notes } });
    if (error) throw new Error(error.message);
    return data.answers;
  },
};

export const api = DEMO ? demo : live;
