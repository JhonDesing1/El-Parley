-- ════════════════════════════════════════════════════════════════
--  APUESTAVALUE — Leaderboard v2
--  Reemplaza la vista materializada anterior por una versión que:
--    · Computa las métricas directamente desde user_picks
--      (fuente de verdad, sin depender de los campos denormalizados
--      de profiles que pueden quedar desincronizados)
--    · Añade la columna `picks_30d` y `streak` (racha actual)
--    · Añade GRANT SELECT para anon y authenticated
--      (las vistas materializadas no heredan RLS de las tablas base)
-- ════════════════════════════════════════════════════════════════

-- ─── Eliminar versión anterior ───────────────────────────────────
drop materialized view if exists public.leaderboard cascade;

-- ─── VISTA MATERIALIZADA ─────────────────────────────────────────
create materialized view public.leaderboard as
with resolved as (
  -- Todos los picks resueltos con stake registrado
  select
    up.user_id,
    up.result,
    up.stake,
    up.profit_loss,
    up.resolved_at
  from public.user_picks up
  where up.result in ('won', 'lost')
),
stats as (
  select
    user_id,
    -- Volumen total de picks resueltos
    count(*)                                                         as total_picks,
    -- Win rate global
    round(
      100.0 * sum(case when result = 'won' then 1 else 0 end)::numeric
            / nullif(count(*), 0),
      2
    )                                                                as win_rate,
    -- ROI últimos 30 días (solo con stake)
    round(
      100.0 * sum(case when resolved_at >= now() - interval '30 days'
                       then profit_loss else 0 end)
            / nullif(
                sum(case when resolved_at >= now() - interval '30 days'
                         and stake is not null then stake else null end),
              0),
      2
    )                                                                as roi_30d,
    -- ROI últimos 7 días
    round(
      100.0 * sum(case when resolved_at >= now() - interval '7 days'
                       then profit_loss else 0 end)
            / nullif(
                sum(case when resolved_at >= now() - interval '7 days'
                         and stake is not null then stake else null end),
              0),
      2
    )                                                                as roi_7d,
    -- Picks resueltos en los últimos 30 días (indicador de actividad reciente)
    count(*) filter (where resolved_at >= now() - interval '30 days') as picks_30d
  from resolved
  group by user_id
),
streak_base as (
  -- Calcular racha actual (consecutivos desde el último pick hacia atrás)
  select
    up.user_id,
    up.result,
    up.resolved_at,
    row_number() over (partition by up.user_id order by up.resolved_at desc) as rn
  from public.user_picks up
  where up.result in ('won', 'lost')
),
streak as (
  select
    user_id,
    -- Contar cuántos picks consecutivos del mismo resultado desde el más reciente
    count(*) filter (
      where result = (select result from streak_base sb2
                      where sb2.user_id = streak_base.user_id
                        and sb2.rn = 1
                      limit 1)
        and rn <= (
          -- Detectar la primera ruptura de racha
          select coalesce(min(sb3.rn), count(*) + 1)
          from streak_base sb3
          where sb3.user_id = streak_base.user_id
            and sb3.result <> (select result from streak_base sb2
                               where sb2.user_id = streak_base.user_id
                                 and sb2.rn = 1
                               limit 1)
        )
    ) as streak_count,
    -- Tipo de la racha: 'W' o 'L'
    (select result from streak_base sb2
     where sb2.user_id = streak_base.user_id and sb2.rn = 1
     limit 1) as streak_type
  from streak_base
  group by user_id
)
select
  p.id,
  p.username,
  p.avatar_url,
  p.country,
  p.tier,
  -- Métricas computadas desde user_picks
  s.total_picks,
  s.win_rate,
  s.roi_30d,
  s.roi_7d,
  s.picks_30d,
  -- Racha actual ("W3" = 3 ganados seguidos, "L2" = 2 perdidos)
  case
    when st.streak_count > 0 then st.streak_type || st.streak_count::text
    else null
  end as streak,
  -- Score ponderado: prioriza ROI pero requiere volumen
  round(
    (coalesce(s.roi_30d, 0) * 0.6 + coalesce(s.win_rate, 0) * 0.4)::numeric,
    2
  ) as score,
  rank() over (
    order by s.roi_30d desc nulls last,
             s.win_rate   desc nulls last,
             s.total_picks desc
  ) as rank,
  now() as refreshed_at
from public.profiles p
join stats s on s.user_id = p.id
left join streak st on st.user_id = p.id
where
  s.total_picks >= 10          -- volumen mínimo para aparecer en el ranking
  and s.roi_30d  is not null
  and s.win_rate is not null
order by s.roi_30d desc nulls last, s.win_rate desc nulls last, s.total_picks desc
limit 100;

-- ─── ÍNDICE ÚNICO (obligatorio para REFRESH CONCURRENTLY) ────────
create unique index idx_leaderboard_v2_id   on public.leaderboard(id);

-- ─── ÍNDICES DE ORDENACIÓN ───────────────────────────────────────
create index idx_leaderboard_v2_rank  on public.leaderboard(rank);
create index idx_leaderboard_v2_score on public.leaderboard(score desc);

-- ─── GRANTS ──────────────────────────────────────────────────────
-- Las vistas materializadas NO heredan RLS de las tablas base.
-- Hay que conceder SELECT explícitamente para que el frontend pueda leerlas.
grant select on public.leaderboard to anon, authenticated;

-- ─── FUNCIÓN DE REFRESCO ─────────────────────────────────────────
create or replace function public.refresh_leaderboard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.leaderboard;
end $$;

-- Solo el rol service_role puede invocar el refresco.
revoke all    on function public.refresh_leaderboard() from public, anon, authenticated;
grant  execute on function public.refresh_leaderboard() to service_role;

comment on materialized view public.leaderboard is
  'Top-100 tipsters ordenados por ROI a 30 días, calculado desde user_picks. '
  'Se refresca vía pg_cron (cada hora) o manualmente con refresh_leaderboard(). '
  'v2: métricas directas desde user_picks + columna streak + GRANT SELECT.';
