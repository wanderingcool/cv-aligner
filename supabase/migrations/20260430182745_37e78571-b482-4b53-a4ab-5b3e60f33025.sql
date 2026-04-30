-- Tier enum
create type public.subscription_tier as enum ('free', 'active_hunter', 'passive_leap');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  subscription_tier public.subscription_tier not null default 'free',
  free_generations_this_month int not null default 0,
  passive_leap_credits int not null default 0,
  active_hunter_until timestamptz,
  period_start date not null default date_trunc('month', now())::date,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "own profile read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "own profile update"
  on public.profiles for update
  using (auth.uid() = id);

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Generation log
create table public.cv_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier_at_use public.subscription_tier not null,
  watermarked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.cv_generations enable row level security;

create policy "own generations read"
  on public.cv_generations for select
  using (auth.uid() = user_id);

-- Stripe events log (server-only writes via service role; no RLS policies needed)
create table public.stripe_events (
  event_id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
