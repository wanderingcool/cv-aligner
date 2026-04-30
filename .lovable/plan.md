## Goal

Turn Positioned into a SaaS with login, per-user generation tracking, watermark on free tier, and two paid options through Lovable's built-in Stripe payments.

## 1. Authentication

- Enable Lovable Cloud auth with **Email/Password + Google** (managed Google OAuth, no extra setup).
- New routes:
  - `src/routes/login.tsx` — minimalist split-screen login/signup with tabs (Sign in / Create account), Google button, email + password form. Uses `lovable.auth.signInWithOAuth("google", ...)` for Google and `supabase.auth.signInWithPassword` / `signUp` for email. Email signup uses `emailRedirectTo: window.location.origin`.
  - `src/routes/_authenticated.tsx` — pathless layout route. `beforeLoad` checks session via `supabase.auth.getSession()` and redirects to `/login?redirect=...` when missing. Renders `<Outlet />`.
- Move the existing CV optimizer page from `src/routes/index.tsx` → `src/routes/_authenticated/dashboard.tsx`.
- Replace `src/routes/index.tsx` with a public marketing landing page (hero, value props, Pricing CTA, Login CTA). Logged-in users get redirected to `/dashboard`.
- Add a small top bar inside the authenticated layout with the user email, current tier badge, "Upgrade" button, and "Sign out".

## 2. Database (migration)

Create three tables + a roles enum (separate roles table per security rules) and a trigger to auto-create a profile on signup.

```sql
-- Tier enum
create type public.subscription_tier as enum ('free', 'active_hunter', 'passive_leap');

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  subscription_tier public.subscription_tier not null default 'free',
  free_generations_this_month int not null default 0,
  passive_leap_credits int not null default 0,         -- one-time pack credits
  active_hunter_until timestamptz,                     -- subscription end
  period_start date not null default date_trunc('month', now())::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create function public.handle_new_user() returns trigger language plpgsql
  security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Generation log (audit + idempotency)
create table public.cv_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier_at_use public.subscription_tier not null,
  watermarked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.cv_generations enable row level security;
create policy "own generations read" on public.cv_generations for select using (auth.uid() = user_id);

-- Stripe events log (webhook idempotency)
create table public.stripe_events (
  event_id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);
```

A scheduled monthly reset is out of scope; instead, on every entitlement check the server function rolls `period_start` forward and resets `free_generations_this_month` if a new month has started.

## 3. Server entitlement + freemium logic

New file `src/server/entitlements.functions.ts`:

- `getEntitlements()` (auth middleware) — returns `{ tier, canGenerate, watermark, reason }` after rolling the monthly counter.
  - `active_hunter` (and `active_hunter_until > now()`): unlimited, no watermark.
  - `passive_leap_credits > 0`: allowed, no watermark, decrement on consume.
  - else free: allowed iff `free_generations_this_month < 1`, watermark = true.
- `consumeGeneration()` (auth middleware, called by `optimizeCv` on success) — atomically increments / decrements, inserts a `cv_generations` row, returns `{ watermark }`.

Update `src/server/optimize-cv.functions.ts`:
- Add `requireSupabaseAuth` middleware.
- Before AI call: check entitlements; if blocked, throw a typed error `{ code: "UPGRADE_REQUIRED" }`.
- After AI call: call `consumeGeneration` and include `watermark: boolean` in the response.

Frontend (`dashboard.tsx`):
- Catch `UPGRADE_REQUIRED` → open the Upgrade modal instead of toast.
- Pass `watermark` into `renderCvHtml` so the renderer paints "Optimized by Positioned.com" diagonally at low opacity in the preview, the printed PDF, and the downloaded HTML.

## 4. Stripe (Lovable built-in payments)

- Use `payments--enable_stripe_payments` to enable seamless Stripe (no user keys needed). Sandbox is created immediately.
- Create two products via the Lovable batch product tool:
  - **Active Hunter** — $19/month recurring.
  - **Passive Leap** — $4.99 one-time.
- New page `src/routes/pricing.tsx` (public) and an `<UpgradeModal />` component reused on the dashboard. Both render the same monochrome pricing table with the $19/mo card highlighted ("Best value", subtle ring + dark fill). Each CTA calls a server function `createCheckout({ plan })` that returns a Stripe Checkout URL and we `window.location.assign(...)` to it.
- Webhook route `src/routes/api/public/stripe-webhook.ts`:
  - Verify signature, dedupe via `stripe_events.event_id`.
  - `checkout.session.completed` (mode `subscription`, plan = active_hunter) → set `subscription_tier='active_hunter'`, set `active_hunter_until = current_period_end`.
  - `checkout.session.completed` (mode `payment`, plan = passive_leap) → `passive_leap_credits = passive_leap_credits + 1`, and set tier to `'passive_leap'` if currently free.
  - `customer.subscription.deleted` / `invoice.payment_failed` past grace → revert to `'free'`.
- Success/cancel routes: `/billing/success` and `/billing/cancelled` (simple confirmation, then redirect to `/dashboard`).

## 5. UI / UX

- Monochrome system: keep current neutral palette, refine to a strict black/white/grey scale with a single accent for highlighted plan.
- Login page: centered card, brand on top, Google button (with logo) above an email/password form; tabs for Sign in / Create account.
- Pricing table: two cards side by side; Active Hunter has dark background, white text, "Best value" pill, and a check-list of features; Passive Leap is light with outlined CTA.
- Upgrade modal: same two cards, condensed; opens whenever the free quota is exhausted.
- Dashboard top bar: tier badge ("Free 0/1 this month", "Active Hunter", or "Passive Leap — N credits"), Upgrade button hidden for `active_hunter`.

## Technical details

- New deps: none required for auth (already on Supabase JS); will add `@lovable.dev/cloud-auth-js` automatically when the social-login tool runs.
- File map:
  - add: `src/routes/login.tsx`, `src/routes/pricing.tsx`, `src/routes/_authenticated.tsx`, `src/routes/_authenticated/dashboard.tsx`, `src/routes/billing.success.tsx`, `src/routes/billing.cancelled.tsx`, `src/routes/api/public/stripe-webhook.ts`, `src/server/entitlements.functions.ts`, `src/server/billing.functions.ts`, `src/components/upgrade-modal.tsx`, `src/components/pricing-table.tsx`, `src/components/auth-topbar.tsx`, `src/hooks/use-auth.ts`.
  - edit: `src/routes/index.tsx` (replace optimizer with marketing landing), `src/routes/__root.tsx` (no auth context needed — gate happens in `_authenticated`), `src/server/optimize-cv.functions.ts` (auth + entitlement + watermark flag), `src/lib/cv-renderer.ts` (render watermark when flag set).
- Auth flow uses redirect-based gate (`beforeLoad` + `redirect()`); session is hydrated via `supabase.auth.getSession()` before the loader runs.
- All entitlement decisions happen server-side; client only reflects them. Webhook is the only place that grants paid tiers.
- Tier downgrade and monthly reset are computed lazily on each entitlement check — no cron needed for v1.

## Open question

Default Stripe tax handling for the two products (we must pick one before products are created):
1. Full compliance handling (Stripe acts as merchant of record, +3.5% per txn, digital-only).
2. Tax calculation + collection only (+0.5%, you file).
3. No tax automation (you handle everything).

I'll ask you once after approval; the rest of the plan does not depend on the answer.
