-- ════════════════════════════════════════════════════════════════
--  APUESTAVALUE — Schema inicial
--  Postgres 15+ / Supabase
-- ════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";

-- ─── ENUMS ──────────────────────────────────────────────────────
create type subscription_tier as enum ('free', 'premium', 'pro');
create type subscription_status as enum ('active', 'canceled', 'past_due', 'trialing', 'incomplete');
create type match_status as enum ('scheduled', 'live', 'finished', 'postponed', 'canceled');
create type parlay_status as enum ('pending', 'won', 'lost', 'void', 'partial');
create type market_type as enum (
  '1x2', 'double_chance', 'over_under_2_5', 'over_under_1_5',
  'btts', 'correct_score', 'asian_handicap', 'draw_no_bet'
);

-- ─── PROFILES (extiende auth.users) ────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  country text default 'CO',
  timezone text default 'America/Bogota',
  tier subscription_tier not null default 'free',
  onboarded boolean not null default false,
  -- Stats del usuario como tipster
  roi_7d numeric(5,2) default 0,
  roi_30d numeric(5,2) default 0,
  total_picks int default 0,
  win_rate numeric(5,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── LEAGUES ────────────────────────────────────────────────────
create table public.leagues (
  id bigint primary key,                    -- ID de API-Football
  name text not null,
  slug text unique not null,
  country text not null,
  country_code text,
  logo_url text,
  flag_url text,
  season int not null,
  type text default 'league',                -- league | cup
  priority int default 100,                  -- orden de display (menor = más arriba)
  is_featured boolean default false,
  created_at timestamptz default now()
);
create index idx_leagues_country on public.leagues(country);
create index idx_leagues_featured on public.leagues(is_featured) where is_featured = true;

-- ─── TEAMS ──────────────────────────────────────────────────────
create table public.teams (
  id bigint primary key,
  name text not null,
  short_name text,
  slug text unique not null,
  country text,
  logo_url text,
  venue text,
  founded int,
  created_at timestamptz default now()
);
create index idx_teams_name_trgm on public.teams using gin (name gin_trgm_ops);

-- ─── MATCHES ────────────────────────────────────────────────────
create table public.matches (
  id bigint primary key,                     -- ID de API-Football (fixture)
  league_id bigint not null references public.leagues(id),
  season int not null,
  round text,
  home_team_id bigint not null references public.teams(id),
  away_team_id bigint not null references public.teams(id),
  kickoff timestamptz not null,
  status match_status not null default 'scheduled',
  minute int,                                -- minuto actual si está en vivo
  home_score int,
  away_score int,
  home_score_ht int,
  away_score_ht int,
  venue text,
  referee text,
  -- Estadísticas agregadas (se llenan post-partido)
  stats jsonb default '{}'::jsonb,
  -- Predicciones del modelo interno
  model_home_prob numeric(5,4),
  model_draw_prob numeric(5,4),
  model_away_prob numeric(5,4),
  model_expected_goals_home numeric(4,2),
  model_expected_goals_away numeric(4,2),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
create index idx_matches_kickoff on public.matches(kickoff);
create index idx_matches_status on public.matches(status);
create index idx_matches_league on public.matches(league_id, kickoff);
create index idx_matches_live on public.matches(status) where status = 'live';

-- ─── BOOKMAKERS ─────────────────────────────────────────────────
create table public.bookmakers (
  id serial primary key,
  slug text unique not null,                 -- 'betplay', 'wplay', ...
  name text not null,
  logo_url text,
  country text default 'CO',
  affiliate_url text not null,               -- URL base con placeholders {tag}
  affiliate_tag text,
  priority int default 100,
  is_active boolean default true,
  commission_model text,                     -- 'cpa', 'revshare', 'hybrid'
  commission_value numeric(10,2),            -- $ por FTD o %
  created_at timestamptz default now()
);

-- ─── ODDS ───────────────────────────────────────────────────────
-- Cada fila = una cuota de un mercado de una casa para un partido
create table public.odds (
  id bigserial primary key,
  match_id bigint not null references public.matches(id) on delete cascade,
  bookmaker_id int not null references public.bookmakers(id),
  market market_type not null,
  selection text not null,                   -- 'home', 'draw', 'away', 'over', 'under', 'yes', 'no', etc.
  price numeric(6,3) not null check (price > 1),
  -- Probabilidad implícita SIN margen (se calcula en trigger)
  implied_prob numeric(5,4),
  line numeric(4,2),                         -- para over/under y handicap
  is_live boolean default false,
  updated_at timestamptz not null default now(),
  constraint uniq_odd unique (match_id, bookmaker_id, market, selection, line)
);
create index idx_odds_match on public.odds(match_id);
create index idx_odds_updated on public.odds(updated_at desc);

-- ─── VALUE BETS ─────────────────────────────────────────────────
-- Detectadas por el edge function cada 15 min
create table public.value_bets (
  id bigserial primary key,
  match_id bigint not null references public.matches(id) on delete cascade,
  bookmaker_id int not null references public.bookmakers(id),
  market market_type not null,
  selection text not null,
  price numeric(6,3) not null,
  implied_prob numeric(5,4) not null,        -- prob según cuota
  model_prob numeric(5,4) not null,          -- prob según modelo
  edge numeric(5,4) not null,                -- (model - implied) / implied
  kelly_fraction numeric(5,4),               -- staking sugerido
  confidence text,                           -- 'low' | 'medium' | 'high'
  reasoning text,                            -- explicación generada
  is_premium boolean default false,          -- si es premium-only
  result text,                               -- 'pending' | 'won' | 'lost'
  detected_at timestamptz default now()
);
create index idx_value_bets_match on public.value_bets(match_id);
create index idx_value_bets_edge on public.value_bets(edge desc);
create index idx_value_bets_pending on public.value_bets(detected_at desc) where result = 'pending';

-- ─── INJURIES ───────────────────────────────────────────────────
create table public.injuries (
  id bigserial primary key,
  match_id bigint references public.matches(id) on delete cascade,
  team_id bigint not null references public.teams(id),
  player_name text not null,
  player_photo text,
  reason text,                               -- 'injury' | 'suspension' | 'other'
  type text,                                 -- 'muscle', 'knee', red card, etc
  detail text,
  updated_at timestamptz default now()
);
create index idx_injuries_match on public.injuries(match_id);

-- ─── NEWS ───────────────────────────────────────────────────────
create table public.news (
  id bigserial primary key,
  title text not null,
  summary text,
  content text,
  source text,                               -- 'marca', 'as', 'newsapi', etc
  source_url text,
  image_url text,
  author text,
  related_match_id bigint references public.matches(id) on delete set null,
  related_team_ids bigint[],
  language text default 'es',
  published_at timestamptz not null,
  created_at timestamptz default now()
);
create index idx_news_published on public.news(published_at desc);
create index idx_news_match on public.news(related_match_id);

-- ─── PARLAYS (sugeridos por sistema) ────────────────────────────
create table public.parlays (
  id uuid primary key default uuid_generate_v4(),
  title text not null,                       -- 'Combinada del día — Champions'
  description text,
  total_odds numeric(8,3) not null,
  total_probability numeric(5,4) not null,   -- prob combinada
  expected_value numeric(6,3),               -- EV esperado
  confidence text,                           -- 'low' | 'medium' | 'high'
  tier subscription_tier not null default 'free',
  status parlay_status not null default 'pending',
  is_featured boolean default false,
  result_updated_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz default now()
);
create index idx_parlays_created on public.parlays(created_at desc);
create index idx_parlays_tier on public.parlays(tier, created_at desc);

create table public.parlay_legs (
  id bigserial primary key,
  parlay_id uuid not null references public.parlays(id) on delete cascade,
  match_id bigint not null references public.matches(id),
  bookmaker_id int references public.bookmakers(id),
  market market_type not null,
  selection text not null,
  line numeric(4,2),
  price numeric(6,3) not null,
  model_prob numeric(5,4),
  result text default 'pending',             -- 'pending' | 'won' | 'lost' | 'void'
  leg_order int not null
);
create index idx_parlay_legs on public.parlay_legs(parlay_id);

-- ─── USER PARLAYS (builder manual / favoritos) ──────────────────
create table public.user_parlays (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text,
  total_odds numeric(8,3) not null,
  stake numeric(10,2),
  potential_return numeric(10,2),
  status parlay_status default 'pending',
  is_public boolean default false,
  created_at timestamptz default now()
);
create index idx_user_parlays_user on public.user_parlays(user_id, created_at desc);

create table public.user_parlay_legs (
  id bigserial primary key,
  user_parlay_id uuid not null references public.user_parlays(id) on delete cascade,
  match_id bigint not null references public.matches(id),
  bookmaker_id int references public.bookmakers(id),
  market market_type not null,
  selection text not null,
  line numeric(4,2),
  price numeric(6,3) not null,
  result text default 'pending',
  leg_order int not null
);

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────────
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,                    -- 'stripe' | 'payu'
  provider_customer_id text,
  provider_subscription_id text unique,
  tier subscription_tier not null default 'premium',
  status subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  canceled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_subs_user on public.subscriptions(user_id);
create index idx_subs_status on public.subscriptions(status);

-- ─── AFFILIATE CLICKS (tracking) ────────────────────────────────
create table public.affiliate_clicks (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  bookmaker_id int not null references public.bookmakers(id),
  match_id bigint references public.matches(id) on delete set null,
  source text,                               -- 'match_detail', 'parlay', 'blog', etc
  ip_hash text,                              -- hash SHA256, nunca la IP real
  user_agent text,
  country text,
  clicked_at timestamptz default now()
);
create index idx_clicks_bookmaker on public.affiliate_clicks(bookmaker_id, clicked_at desc);
create index idx_clicks_user on public.affiliate_clicks(user_id);

-- ─── BLOG POSTS ─────────────────────────────────────────────────
create table public.blog_posts (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  excerpt text,
  content text not null,                     -- markdown
  cover_image text,
  category text,                             -- 'liga-betplay', 'europa', etc
  tags text[],
  related_match_id bigint references public.matches(id) on delete set null,
  author text default 'ApuestaValue',
  is_premium boolean default false,
  is_published boolean default false,
  views int default 0,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_blog_published on public.blog_posts(is_published, published_at desc);
create index idx_blog_slug on public.blog_posts(slug);
create index idx_blog_category on public.blog_posts(category);

-- ─── FAVORITES ──────────────────────────────────────────────────
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, match_id)
);

-- ─── NOTIFICATIONS (para push) ──────────────────────────────────
create table public.notification_subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  onesignal_player_id text unique,
  push_value_bets boolean default true,
  push_live_scores boolean default false,
  push_parlays boolean default true,
  created_at timestamptz default now()
);

-- ─── LEADERBOARD (materializada) ────────────────────────────────
create materialized view public.leaderboard as
select
  p.id,
  p.username,
  p.avatar_url,
  p.roi_30d,
  p.total_picks,
  p.win_rate,
  rank() over (order by p.roi_30d desc, p.total_picks desc) as rank
from public.profiles p
where p.total_picks >= 10
order by p.roi_30d desc
limit 100;

-- ═══ TRIGGERS ═══════════════════════════════════════════════════

-- Auto-calcular implied_prob al insertar/actualizar odds
create or replace function public.calc_implied_prob()
returns trigger language plpgsql as $$
begin
  new.implied_prob := 1.0 / new.price;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_odds_implied
before insert or update on public.odds
for each row execute function public.calc_implied_prob();

-- Crear profile automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.notification_subscriptions (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_matches_updated before update on public.matches
for each row execute function public.set_updated_at();
