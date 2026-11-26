-- Rihla database. Paste this whole file into Supabase -> SQL Editor -> Run (once).

-- Profiles: one per account. Display name shows on the leaderboard.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Traveler' check (char_length(display_name) between 1 and 30),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Make a profile automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  play_date date,
  timer_seconds int not null default 20 check (timer_seconds between 5 and 120),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games on delete cascade,
  position int not null,
  prompt text not null,
  noor_source text
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions on delete cascade,
  text text not null,
  aliases text[] not null default '{}',
  rank text not null check (rank in ('noor','hidden_gem','scholar','pathfinder','traveler','footstep','lost')),
  added_by_ai boolean not null default false  -- true = added live by the AI judge; worth a glance
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  attempt_no int not null default 1,
  score int not null check (score >= 0 and score <= 1000),
  results jsonb not null default '[]',
  finished_at timestamptz not null default now()
);
create index if not exists attempts_game_user on public.attempts (game_id, user_id);

-- Number each player's runs per game: 1 = the one that counts.
create or replace function public.number_attempt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.attempt_no := 1 + (select count(*) from public.attempts where game_id = new.game_id and user_id = new.user_id);
  new.finished_at := now();
  return new;
end $$;
drop trigger if exists attempts_number on public.attempts;
create trigger attempts_number before insert on public.attempts for each row execute function public.number_attempt();

-- Leaderboard: each player's FIRST score + how many times they've played.
create or replace view public.leaderboard with (security_invoker = true) as
select a.game_id, p.display_name, a.score, a.finished_at,
       (select count(*) from public.attempts x where x.game_id = a.game_id and x.user_id = a.user_id) as attempts
from public.attempts a join public.profiles p on p.id = a.user_id
where a.attempt_no = 1;

-- ---------- security rules ----------
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.attempts enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "edit own name" on public.profiles;
create policy "edit own name" on public.profiles for update using (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;  -- players can't make themselves admin

drop policy if exists "games readable" on public.games;
create policy "games readable" on public.games for select using (published or public.is_admin());
drop policy if exists "admins write games" on public.games;
create policy "admins write games" on public.games for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "questions readable" on public.questions;
create policy "questions readable" on public.questions for select using (exists (select 1 from public.games g where g.id = game_id and (g.published or public.is_admin())));
drop policy if exists "admins write questions" on public.questions;
create policy "admins write questions" on public.questions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "answers readable" on public.answers;
create policy "answers readable" on public.answers for select using (exists (select 1 from public.questions q join public.games g on g.id = q.game_id where q.id = question_id and (g.published or public.is_admin())));
drop policy if exists "admins write answers" on public.answers;
create policy "admins write answers" on public.answers for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "attempts readable" on public.attempts;
create policy "attempts readable" on public.attempts for select using (true);
drop policy if exists "insert own attempt" on public.attempts;
create policy "insert own attempt" on public.attempts for insert with check (user_id = auth.uid());

grant select on public.leaderboard to anon, authenticated;
