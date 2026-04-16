-- ─── Función para refrescar la vista materializada del leaderboard ──
-- Necesita SECURITY DEFINER para poder ejecutar REFRESH MATERIALIZED VIEW
-- desde el rol anon/service_role sin privilegios de superusuario.

create or replace function public.refresh_leaderboard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.leaderboard;
end $$;

-- Solo el service role puede llamar esta función
revoke all on function public.refresh_leaderboard() from public, anon, authenticated;
grant execute on function public.refresh_leaderboard() to service_role;
