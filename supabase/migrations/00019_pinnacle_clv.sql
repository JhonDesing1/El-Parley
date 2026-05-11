-- ════════════════════════════════════════════════════════════════
--  00019 — Pinnacle fair odds + CLV (Closing Line Value) tracking
--
--  Pinnacle es la casa con menor margen del mercado (~2%). Usar su
--  línea como "precio justo" (sin vig) permite:
--   1) Detectar value real: cuotas soft que pagan por encima de Pinnacle.
--   2) Medir CLV: ¿la cuota que apostamos venció a la línea de cierre?
--      Es el único KPI que correlaciona con rentabilidad a largo plazo.
--
--  Cambios:
--   - value_bets gana pinnacle_fair_prob y edge_pinnacle (calculados en
--     el momento de la detección por el cron detect-value-bets).
--   - Nueva tabla clv_snapshots: una fila por value_bet con el precio
--     y la prob de cierre de Pinnacle. Poblada por cron snapshot-clv.
-- ════════════════════════════════════════════════════════════════

-- ── value_bets: Pinnacle fair en el momento de detección ────────
alter table public.value_bets
  add column if not exists pinnacle_fair_prob numeric(5,4),
  add column if not exists edge_pinnacle      numeric(6,4);

comment on column public.value_bets.pinnacle_fair_prob is
  'Probabilidad fair (de-vigada) de Pinnacle al momento de detectar el bet';
comment on column public.value_bets.edge_pinnacle is
  'Edge real vs Pinnacle: price * pinnacle_fair_prob - 1. Positivo = value real.';

create index if not exists idx_value_bets_edge_pinnacle
  on public.value_bets(edge_pinnacle desc nulls last)
  where result = 'pending';

-- ── clv_snapshots: precio de cierre de Pinnacle por bet ─────────
create table if not exists public.clv_snapshots (
  id                bigserial primary key,
  value_bet_id      bigint not null references public.value_bets(id) on delete cascade,
  match_id          bigint not null references public.matches(id) on delete cascade,
  market            text   not null,
  selection         text   not null,
  line              numeric(4,2),
  bet_price         numeric(6,3) not null,  -- cuota que apostamos
  bet_fair_prob     numeric(5,4),           -- pinnacle fair en el momento del bet
  closing_fair_prob numeric(5,4) not null,  -- pinnacle fair al cierre
  clv               numeric(7,4) not null,  -- bet_price * closing_fair_prob - 1
  snapshot_at       timestamptz  not null default now(),
  unique (value_bet_id)
);

create index if not exists idx_clv_snapshots_match
  on public.clv_snapshots(match_id);
create index if not exists idx_clv_snapshots_clv
  on public.clv_snapshots(clv desc);

-- ── RLS: lectura pública (es información agregada, no sensible) ─
alter table public.clv_snapshots enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'clv_snapshots'
      and policyname = 'clv_snapshots public read'
  ) then
    execute $policy$
      create policy "clv_snapshots public read"
        on public.clv_snapshots
        for select
        using (true)
    $policy$;
  end if;
end $$;
