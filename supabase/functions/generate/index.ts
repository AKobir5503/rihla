// Dashboard helper: drafts an answer list with ranks for a question. Admins only.
import { cors, json, callerDb, askClaude } from "../_shared/claude.ts";

const SYSTEM = `You help the Georgia Tech Muslim Student Association write questions for Rihla, a trivia game where rarer correct answers score more.
Given a question, list every correct answer you can (aim for 20 to 80 when the answer space allows; fewer if the set is small and fixed).
For each, give the common spelling, other spellings/transliterations/nicknames players might type, and how rare it is among college students:
"footstep" (what most people say first), "traveler" (fairly common), "pathfinder" (uncommon), "scholar" (rare), "hidden_gem" (very few would think of it).
Also add 5 to 10 plausible WRONG answers people might guess, with rank "lost"; these appear in autocomplete so it doesn't give away the right ones.
Never use rank "noor"; the officer picks that from the newsletter. Only include answers you are confident are correct.
If the question is about a specific MSA event you can't know, list only what you can verify and keep the list short.`;

const schema = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          rank: { type: "string", enum: ["hidden_gem", "scholar", "pathfinder", "traveler", "footstep", "lost"] },
        },
        required: ["text", "aliases", "rank"],
        additionalProperties: false,
      },
    },
  },
  required: ["answers"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { data: isAdmin } = await callerDb(req).rpc("is_admin");
    if (!isAdmin) return json({ error: "Dashboard access required." }, 403);
    const { prompt, notes } = await req.json();
    if (!prompt) return json({ error: "Missing question." }, 400);
    const out = await askClaude<{ answers: { text: string; aliases: string[]; rank: string }[] }>({
      system: SYSTEM,
      user: `Question: ${String(prompt).slice(0, 500)}${notes ? `\n\nNotes from the officer:\n${String(notes).slice(0, 2000)}` : ""}`,
      schema, effort: "medium", maxTokens: 16000,
    });
    return json(out);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
