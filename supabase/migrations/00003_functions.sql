-- ════════════════════════════════════════════════════════════════
--  Funciones RPC + seeds
-- ════════════════════════════════════════════════════════════════

-- Obtener partidos del día con mejor cuota por mercado 1x2
create or replace function public.get_matches_today(p_date date default current_date)
returns table (
  match_id bigint,
  league_name text,
  league_logo text,
  home_team text,
  home_logo text,
  away_team text,
  away_logo text,
  kickoff timestamptz,
  status match_status,
  home_score int,
  away_score int,
  best_home_odd numeric,
  best_draw_odd numeric,
  best_away_odd numeric,
  best_home_book text,
  best_draw_book text,
  best_away_book text,
  has_value_bet boolean
) language sql stable as $$
  with o as (
    select
      m.id,
      max(case when o.selection = 'home' then o.price end) as best_home,
      max(case when o.selection = 'draw' then o.price end) as best_draw,
      max(case when o.selection = 'away' then o.price end) as best_away
    from public.matches m
    left join public.odds o on o.match_id = m.id and o.market = '1x2'
    where m.kickoff::date = p_date
    group by m.id
  )
  select
    m.id,
    l.name,
    l.logo_url,
    ht.name,
    ht.logo_url,
    at.name,
    at.logo_url,
    m.kickoff,
    m.status,
    m.home_score,
    m.away_score,
    o.best_home,
    o.best_draw,
    o.best_away,
    (select b.slug from public.odds od join public.bookmakers b on b.id = od.bookmaker_id
       where od.match_id = m.id and od.market = '1x2' and od.selection = 'home' and od.price = o.best_home limit 1),
    (select b.slug from public.odds od join public.bookmakers b on b.id = od.bookmaker_id
       where od.match_id = m.id and od.market = '1x2' and od.selection = 'draw' and od.price = o.best_draw limit 1),
    (select b.slug from public.odds od join public.bookmakers b on b.id = od.bookmaker_id
       where od.match_id = m.id and od.market = '1x2' and od.selection = 'away' and od.price = o.best_away limit 1),
    exists (select 1 from public.value_bets vb where vb.match_id = m.id and vb.result = 'pending')
  from public.matches m
  join public.leagues l on l.id = m.league_id
  join public.teams ht on ht.id = m.home_team_id
  join public.teams at on at.id = m.away_team_id
  left join o on o.id = m.id
  where m.kickoff::date = p_date
  order by l.priority, m.kickoff;
$$;

-- Refrescar leaderboard (llamar con pg_cron o edge function)
create or replace function public.refresh_leaderboard()
returns void language sql security definer as $$
  refresh materialized view concurrently public.leaderboard;
$$;

create unique index if not exists idx_leaderboard_id on public.leaderboard(id);

-- ═══ SEEDS ══════════════════════════════════════════════════════

insert into public.bookmakers (slug, name, country, affiliate_url, affiliate_tag, priority, commission_model, commission_value) values
  ('betplay', 'Betplay', 'CO', 'https://betplay.com.co/?aff={tag}', 'apuestavalue01', 1, 'cpa', 150.00),
  ('wplay',   'Wplay',   'CO', 'https://wplay.co/?ref={tag}',       'apuestavalue02', 2, 'cpa', 120.00),
  ('codere',  'Codere',  'CO', 'https://apuestas.codere.com.co/?tag={tag}', 'apuestavalue03', 3, 'revshare', 30.00),
  ('rivalo',  'Rivalo',  'CO', 'https://rivalo.com/co/?btag={tag}', 'apuestavalue04', 4, 'cpa', 100.00),
  ('1xbet',   '1xBet',   'LATAM', 'https://1xbet.com/es/?tag={tag}', 'apuestavalue05', 5, 'revshare', 40.00)
on conflict (slug) do nothing;

-- Ligas principales (los IDs corresponden a API-Football)
insert into public.leagues (id, name, slug, country, country_code, season, priority, is_featured) values
  (239, 'Liga BetPlay DIMAYOR', 'liga-betplay', 'Colombia', 'CO', 2024, 1, true),
  (2,   'UEFA Champions League', 'champions-league', 'Europe', 'EU', 2024, 2, true),
  (39,  'Premier League',       'premier-league', 'England', 'GB', 2024, 3, true),
  (140, 'La Liga',               'la-liga', 'Spain', 'ES', 2024, 4, true),
  (135, 'Serie A',                'serie-a', 'Italy', 'IT', 2024, 5, true),
  (78,  'Bundesliga',             'bundesliga', 'Germany', 'DE', 2024, 6, true),
  (61,  'Ligue 1',                'ligue-1', 'France', 'FR', 2024, 7, false),
  (253, 'MLS',                    'mls', 'USA', 'US', 2024, 8, false),
  (13,  'Copa Libertadores',     'copa-libertadores', 'South America', 'SA', 2024, 9, true),
  (11,  'Copa Sudamericana',     'copa-sudamericana', 'South America', 'SA', 2024, 10, false)
on conflict (id) do nothing;
