-- ════════════════════════════════════════════════════════════════
--  Leaderboard — vista materializada completa
--  Reemplaza la definición inline de 00001_init.sql para poder
--  evolucionarla de forma independiente.
-- ════════════════════════════════════════════════════════════════

-- Eliminar la vista actual antes de recrearla con la definición
-- extendida. CASCADE también elimina el índice único asociado.
drop materialized view if exists public.leaderboard cascade;

-- ─── VISTA MATERIALIZADA ────────────────────────────────────────
create materialized view public.leaderboard as
select
  p.id,
  p.username,
  p.avatar_url,
  p.country,
  p.tier,
  p.roi_7d,
  p.roi_30d,
  p.total_picks,
  p.win_rate,
  -- Rendimiento ponderado: prioriza ROI pero requiere volumen
  round(
    (p.roi_30d * 0.6 + p.win_rate * 0.4)::numeric,
    2
  ) as score,
  rank() over (
    order by p.roi_30d desc, p.win_rate desc, p.total_picks desc
  ) as rank,
  now() as refreshed_at
from public.profiles p
where
  p.total_picks  >= 10          -- volumen mínimo para aparecer
  and p.roi_30d  is not null
  and p.win_rate is not null
order by p.roi_30d desc, p.win_rate desc, p.total_picks desc
limit 100;

-- ─── ÍNDICE ÚNICO ───────────────────────────────────────────────
-- Obligatorio para poder usar REFRESH MATERIALIZED VIEW CONCURRENTLY
-- sin bloquear lecturas.
create unique index idx_leaderboard_id on public.leaderboard(id);

-- ─── ÍNDICE DE ORDENACIÓN ───────────────────────────────────────
-- Acelera las consultas de la API que piden por rank o score.
create index idx_leaderboard_rank on public.leaderboard(rank);

-- ─── FUNCIÓN DE REFRESCO ────────────────────────────────────────
-- SECURITY DEFINER permite llamarla desde pg_cron o edge functions
-- sin privilegios de superusuario.
create or replace function public.refresh_leaderboard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.leaderboard;
end $$;

-- Solo el rol service_role puede invocarla.
revoke all on function public.refresh_leaderboard() from public, anon, authenticated;
grant  execute on function public.refresh_leaderboard() to service_role;

comment on materialized view public.leaderboard is
  'Top-100 tipsters ordenados por ROI a 30 días. Se refresca vía pg_cron (cada hora) o manualmente con refresh_leaderboard().';
