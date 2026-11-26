# Rihla

GT MSA's trivia journey game. Each question has many right answers; rarer answers score more. Every point is 10 km of travel: a pixel-art yellow jacket traveler walks (and flies) a side-scrolling world from the GT Reflection Room past Al Farooq, DC, Istanbul, Cairo, Damascus and al-Aqsa, with the scenery changing by region. Answer every question with a Hidden Gem or better and the final gate opens to Madinah & Makkah. The top answer to each question, the **Noor** answer, comes from the MSA newsletter.

- **Play page** (`index.html`): timer per question, silent autocorrect (typos snap to the closest answer), instant ranks, travel animation with arrivals at each landmark, full answer reveal after you finish, replays allowed.
- **Leaderboard**: each player's *first* score, plus how many times they've played.
- **Dashboard** (`admin.html`): anyone with dashboard access can create games, write questions, build answer lists, and have Claude suggest answers.
- **AI judging**: answers are matched instantly against the list (typos and spellings included). Only answers that aren't on the list go to Claude, and every new correct answer Claude finds is saved to the list, so the next person who types it gets an instant match.

Ranks: Noor 100 · Hidden Gem 80 · Scholar 55 · Pathfinder 35 · Traveler 20 · Footstep 10 · Lost 0. Change names, points, the route, or switch to the GT campus route in `js/config.js`.

## Try it right now (demo mode)

With `SUPABASE_URL` blank in `js/config.js`, the game runs with 5 sample questions, saves to your browser only, and has no AI. Open `index.html` through any static server, e.g. `python3 -m http.server` in this folder, then visit http://localhost:8000.

## Go live (free, about 20 minutes)

Costs: GitHub Pages and Supabase's free plan are $0. Claude is the only cost: at ~100 players a month it's well under $5/month.

1. **Supabase** (database + logins): create a free project at supabase.com.
   - SQL Editor → paste all of `supabase/schema.sql` → Run.
   - Authentication → Sign In / Providers → Email: turn **off** "Confirm email" (so sign-up is instant and no emails are sent).
   - Project Settings → API: copy the Project URL and the `anon` public key into `js/config.js`.
2. **Claude key**: create an API key at console.anthropic.com (set a monthly spend limit there, e.g. $10).
3. **Edge functions** (the AI part). Install the Supabase CLI, then from this folder:
   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy judge
   supabase functions deploy generate
   ```
   Optional: `supabase secrets set CLAUDE_MODEL=claude-haiku-5-5` for faster, cheaper judging (default is `claude-opus-5-5`).
4. **Host on GitHub Pages**: push this repo, then Settings → Pages → Deploy from branch → `main` / root. Your game is at `https://<user>.github.io/<repo>/`.
5. **Make yourself an admin**: sign up in the game, then in Supabase SQL Editor run:
   ```sql
   update profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');
   ```

### Give someone dashboard access
Same SQL as step 5 with their email. Remove access with `is_admin = false`.

## Making a game
Dashboard → New game → add questions. For each question, either type answers, paste a list (`answer | rank | spelling1, spelling2`), or press **Suggest answers with AI**, then fix ranks and mark one answer **Noor** (from the newsletter). Add a few **Lost** answers (common wrong guesses) so they're recognized instantly. Tick **Published** and set the date. Players always get the newest published game dated today or earlier; share a specific one with `?game=ID` (use the Preview link).

Answers Claude adds during play are flagged `added_by_ai` in the `answers` table if you want to review them.

## Files
```
index.html, admin.html    pages
css/style.css             look and feel (light + dark)
js/config.js              ranks, points, routes, Supabase keys  ← edit this
js/game.js, js/admin.js   play page and dashboard
js/match.js               instant typo-tolerant matching (autocorrect)
js/scene.js               the pixel-art travel scene (traveler, zones, landmarks)
js/data.js                demo backend (browser) and live backend (Supabase)
js/sample.js              sample questions for demo mode
supabase/schema.sql       tables + security rules
supabase/functions/       judge (live AI judging) and generate (AI answer lists)
```
