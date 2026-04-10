-- ════════════════════════════════════════════════════════════════
--  APUESTAVALUE — Row Level Security
-- ════════════════════════════════════════════════════════════════

-- Helper: ¿el usuario tiene subscripción activa?
create or replace function public.is_premium(uid uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = uid
      and status in ('active', 'trialing')
      and tier in ('premium', 'pro')
  );
$$;

-- ─── Activar RLS en todas las tablas ───────────────────────────
alter table public.profiles                enable row level security;
alter table public.leagues                 enable row level security;
alter table public.teams                   enable row level security;
alter table public.matches                 enable row level security;
alter table public.bookmakers              enable row level security;
alter table public.odds                    enable row level security;
alter table public.value_bets              enable row level security;
alter table public.injuries                enable row level security;
alter table public.news                    enable row level security;
alter table public.parlays                 enable row level security;
alter table public.parlay_legs             enable row level security;
alter table public.user_parlays            enable row level security;
alter table public.user_parlay_legs        enable row level security;
alter table public.subscriptions           enable row level security;
alter table public.affiliate_clicks        enable row level security;
alter table public.blog_posts              enable row level security;
alter table public.favorites               enable row level security;
alter table public.notification_subscriptions enable row level security;

-- ─── PROFILES ───────────────────────────────────────────────────
create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ─── Datos públicos read-only ───────────────────────────────────
create policy "leagues_public" on public.leagues for select using (true);
create policy "teams_public" on public.teams for select using (true);
create policy "matches_public" on public.matches for select using (true);
create policy "bookmakers_public" on public.bookmakers for select using (true);
create policy "odds_public" on public.odds for select using (true);
create policy "injuries_public" on public.injuries for select using (true);
create policy "news_public" on public.news for select using (true);

-- ─── VALUE BETS: los premium solo para suscriptores ────────────
create policy "value_bets_free_for_all" on public.value_bets
  for select using (is_premium = false);

create policy "value_bets_premium_for_subs" on public.value_bets
  for select using (is_premium = true and public.is_premium(auth.uid()));

-- ─── PARLAYS: igual que value bets ─────────────────────────────
create policy "parlays_free_for_all" on public.parlays
  for select using (tier = 'free');

create policy "parlays_premium_for_subs" on public.parlays
  for select using (tier in ('premium', 'pro') and public.is_premium(auth.uid()));

create policy "parlay_legs_follow_parlay" on public.parlay_legs
  for select using (
    exists (
      select 1 from public.parlays p
      where p.id = parlay_legs.parlay_id
        and (p.tier = 'free' or public.is_premium(auth.uid()))
    )
  );

-- ─── USER PARLAYS ───────────────────────────────────────────────
create policy "user_parlays_own" on public.user_parlays
  for all using (auth.uid() = user_id);

create policy "user_parlays_public_read" on public.user_parlays
  for select using (is_public = true);

create policy "user_parlay_legs_follow" on public.user_parlay_legs
  for all using (
    exists (select 1 from public.user_parlays up where up.id = user_parlay_legs.user_parlay_id and up.user_id = auth.uid())
  );

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────────
create policy "subs_own_read" on public.subscriptions
  for select using (auth.uid() = user_id);

-- ─── AFFILIATE CLICKS ───────────────────────────────────────────
create policy "clicks_insert_anyone" on public.affiliate_clicks
  for insert with check (true);

-- ─── BLOG ───────────────────────────────────────────────────────
create policy "blog_published_public" on public.blog_posts
  for select using (is_published = true and (is_premium = false or public.is_premium(auth.uid())));

-- ─── FAVORITES ──────────────────────────────────────────────────
create policy "favorites_own" on public.favorites
  for all using (auth.uid() = user_id);

-- ─── NOTIFICATIONS ──────────────────────────────────────────────
create policy "notif_own" on public.notification_subscriptions
  for all using (auth.uid() = user_id);
