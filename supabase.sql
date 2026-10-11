-- supabase.sql: run this ONCE in Supabase > SQL Editor > New query > Run.
-- It creates TerraTrack's tables and the security rules (Row Level Security).
-- The rules mean: you can only read and change your own data; people in your college can see
-- each other's daily totals (for the leaderboard) but never each other's entries; only the
-- college account can post updates, run challenges, give rewards and approve tree photos.

-- ---------- tables ----------
create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  role text not null check (role in ('student', 'college')),
  college_id uuid references public.colleges (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Each person's full TerraTrack data (entries, trees, settings, quests) as one JSON document
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Small daily totals each student shares with their college, for leaderboards and challenges
create table if not exists public.daily_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  college_id uuid references public.colleges (id) on delete cascade,
  day date not null,
  net numeric not null default 0,
  gross numeric not null default 0,
  saved numeric not null default 0,
  eco_actions integer not null default 0,
  primary key (user_id, day)
);

create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  title text not null,
  metric text not null check (metric in ('low_net', 'saved', 'eco_actions', 'trees')),
  reward text not null,
  winners integer not null default 1 check (winners between 1 and 3),
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  reward text not null,
  rank integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.proofs (
  id uuid primary key default gen_random_uuid(),
  college_id uuid references public.colleges (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  activity_id text not null,
  day date not null,
  photo text not null check (char_length(photo) < 400000), -- small JPEG as a data URL
  ai jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------- helpers (security definer so the rules below don't loop) ----------
create or replace function public.my_college() returns uuid
language sql stable security definer set search_path = public as $$
  select college_id from public.profiles where id = auth.uid()
$$;

create or replace function public.owns_college(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.colleges where id = cid and owner_id = auth.uid())
$$;

-- ---------- Row Level Security ----------
alter table public.colleges enable row level security;
alter table public.profiles enable row level security;
alter table public.user_data enable row level security;
alter table public.daily_stats enable row level security;
alter table public.updates enable row level security;
alter table public.challenges enable row level security;
alter table public.rewards enable row level security;
alter table public.proofs enable row level security;

-- colleges: you see your own college only (the join code stays private); create and join go through the functions below
drop policy if exists "colleges read" on public.colleges;
create policy "colleges read" on public.colleges for select to authenticated
  using (owner_id = auth.uid() or id = public.my_college());
drop policy if exists "colleges update" on public.colleges;
create policy "colleges update" on public.colleges for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- profiles: you see yourself and people in your college; you can only change your name.
-- Your college is set by create_college() or join_college(), never directly.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or (college_id is not null and college_id = public.my_college()));
drop policy if exists "profiles create" on public.profiles;
create policy "profiles create" on public.profiles for insert to authenticated
  with check (id = auth.uid() and college_id is null);
drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

-- A college account creates its college; the code students use to join is made here
create or replace function public.create_college(p_name text) returns public.colleges
language plpgsql security definer set search_path = public as $$
declare c public.colleges;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'college') then
    raise exception 'Only a college account can create a college';
  end if;
  if exists (select 1 from colleges where owner_id = auth.uid()) then
    raise exception 'You already have a college';
  end if;
  insert into colleges (name, code, owner_id)
  values (p_name, upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)), auth.uid())
  returning * into c;
  update profiles set college_id = c.id where id = auth.uid();
  return c;
end $$;

-- A student joins with the 6-character code from their college
create or replace function public.join_college(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.colleges;
begin
  select * into c from colleges where code = upper(trim(p_code));
  if c.id is null then raise exception 'No college has that code'; end if;
  update profiles set college_id = c.id where id = auth.uid() and role = 'student';
  update daily_stats set college_id = c.id where user_id = auth.uid();
  return c.name;
end $$;

revoke execute on function public.create_college(text) from anon;
revoke execute on function public.join_college(text) from anon;

-- user_data: only you
drop policy if exists "user_data own" on public.user_data;
create policy "user_data own" on public.user_data for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- daily_stats: you write your own; everyone in your college can read them
drop policy if exists "stats read" on public.daily_stats;
create policy "stats read" on public.daily_stats for select to authenticated
  using (user_id = auth.uid() or (college_id is not null and college_id = public.my_college()));
drop policy if exists "stats write" on public.daily_stats;
create policy "stats write" on public.daily_stats for insert to authenticated
  with check (user_id = auth.uid() and (college_id is null or college_id = public.my_college()));
drop policy if exists "stats update" on public.daily_stats;
create policy "stats update" on public.daily_stats for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and (college_id is null or college_id = public.my_college()));
drop policy if exists "stats delete" on public.daily_stats;
create policy "stats delete" on public.daily_stats for delete to authenticated using (user_id = auth.uid());

-- updates, challenges, rewards: your college reads; only the college account writes
drop policy if exists "updates read" on public.updates;
create policy "updates read" on public.updates for select to authenticated using (college_id = public.my_college());
drop policy if exists "updates write" on public.updates;
create policy "updates write" on public.updates for all to authenticated
  using (public.owns_college(college_id)) with check (public.owns_college(college_id));

drop policy if exists "challenges read" on public.challenges;
create policy "challenges read" on public.challenges for select to authenticated using (college_id = public.my_college());
drop policy if exists "challenges write" on public.challenges;
create policy "challenges write" on public.challenges for all to authenticated
  using (public.owns_college(college_id)) with check (public.owns_college(college_id));

drop policy if exists "rewards read" on public.rewards;
create policy "rewards read" on public.rewards for select to authenticated using (college_id = public.my_college());
drop policy if exists "rewards write" on public.rewards;
create policy "rewards write" on public.rewards for all to authenticated
  using (public.owns_college(college_id)) with check (public.owns_college(college_id));

-- proofs: the student adds their own (always "pending") and can see them; the college sees and reviews all of its students'
drop policy if exists "proofs read" on public.proofs;
create policy "proofs read" on public.proofs for select to authenticated
  using (student_id = auth.uid() or public.owns_college(college_id));
drop policy if exists "proofs create" on public.proofs;
create policy "proofs create" on public.proofs for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending' and (college_id is null or college_id = public.my_college()));
drop policy if exists "proofs ai note" on public.proofs;
create policy "proofs ai note" on public.proofs for update to authenticated
  using (student_id = auth.uid() and status = 'pending') with check (student_id = auth.uid() and status = 'pending');
drop policy if exists "proofs review" on public.proofs;
create policy "proofs review" on public.proofs for update to authenticated
  using (public.owns_college(college_id)) with check (public.owns_college(college_id));
