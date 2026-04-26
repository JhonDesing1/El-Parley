-- ════════════════════════════════════════════════════════════════
--  00018 — Estadísticas por partido y medias rodantes por equipo
--
--  Hasta ahora detect-value-bets usaba LEAGUE_AVG_CORNERS / CARDS
--  (un único promedio por liga). Esto hace que un equipo defensivo
--  tenga las mismas expectativas que uno ofensivo en córners.
--
--  Para mejorar precisión:
--   - match_stats: snapshot de córners y tarjetas al cierre de cada
--     partido (poblado por el cron sync-results cuando llama a
--     /fixtures/statistics).
--   - team_stats: medias rodantes por equipo, recalculadas cada día
--     por un cron dedicado (sync-team-stats) sobre los últimos N
--     partidos. Estos valores reemplazan los promedios estáticos en
--     el detector de value bets.
-- ════════════════════════════════════════════════════════════════

-- ── Snapshot por partido ─────────────────────────────────────────
create table if not exists public.match_stats (
  match_id           bigint primary key references public.matches(id) on delete cascade,
  home_corners       int,
  away_corners       int,
  home_yellow_cards  int,
  away_yellow_cards  int,
  home_red_cards     int,
  away_red_cards     int,
  fetched_at         timestamptz not null default now()
);

-- ── Medias rodantes por equipo ──────────────────────────────────
create table if not exists public.team_stats (
  team_id              bigint primary key references public.teams(id) on delete cascade,
  matches_sample       int     not null default 0,
  avg_corners_for      numeric(4,2),
  avg_corners_against  numeric(4,2),
  avg_yellow_cards     numeric(4,2),
  avg_red_cards        numeric(4,2),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_team_stats_updated_at
  on public.team_stats(updated_at);

-- ── RLS — lectura pública, escritura solo service role ──────────
alter table public.match_stats enable row level security;
alter table public.team_stats  enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'match_stats'
      and policyname = 'match_stats public read'
  ) then
    execute $policy$
      create policy "match_stats public read"
        on public.match_stats
        for select
        using (true)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'team_stats'
      and policyname = 'team_stats public read'
  ) then
    execute $policy$
      create policy "team_stats public read"
        on public.team_stats
        for select
        using (true)
    $policy$;
  end if;
end $$;
