// Shared helpers for the edge functions: CORS, Supabase clients, and one Claude call.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Service-role client (bypasses row rules) for reading questions and saving judged answers.
export const adminDb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Client acting as the caller, to check who they are.
export const callerDb = (req: Request) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

export const RANKS = ["noor", "hidden_gem", "scholar", "pathfinder", "traveler", "footstep", "lost"] as const;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets
const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5-5";

// One structured-output call: Claude must reply with JSON matching `schema`.
export async function askClaude<T>(opts: {
  system: string; user: string; schema: Record<string, unknown>; effort: "low" | "medium" | "high"; maxTokens: number;
}): Promise<T> {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // if the model declines, the API retries on a fallback model automatically
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { effort: opts.effort, format: { type: "json_schema", schema: opts.schema } },
  } as any);
  if (res.stop_reason === "refusal") throw new Error("The AI declined this request.");
  if (res.stop_reason === "max_tokens") throw new Error("The AI's reply was cut off. Try again.");
  const text = res.content.find((b: any) => b.type === "text") as any;
  if (!text) throw new Error("The AI returned no answer.");
  return JSON.parse(text.text) as T;
}
