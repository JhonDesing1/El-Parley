-- ════════════════════════════════════════════════════════════════
--  APUESTAVALUE — Registro de picks de usuarios
-- ════════════════════════════════════════════════════════════════

-- ─── ENUM ────────────────────────────────────────────────────────
create type pick_result as enum ('pending', 'won', 'lost', 'void');

-- ─── USER_PICKS ──────────────────────────────────────────────────
create table public.user_picks (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  match_id       bigint not null references public.matches(id) on delete cascade,
  -- Referencia opcional al value bet que originó el pick
  value_bet_id   bigint references public.value_bets(id) on delete set null,
  -- Detalles de la apuesta
  bookmaker_id   int references public.bookmakers(id) on delete set null,
  market         market_type not null,
  selection      text not null,
  line           numeric(4,2),                   -- para over/under y handicap
  odds           numeric(6,3) not null check (odds > 1),
  stake          numeric(10,2) check (stake > 0), -- importe apostado (opcional)
  -- Resultado
  result         pick_result not null default 'pending',
  profit_loss    numeric(10,2),                  -- calculado al resolver: stake*(odds-1) si ganó, -stake si perdió
  notes          text,
  -- Timestamps
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create index idx_user_picks_user     on public.user_picks(user_id, created_at desc);
create index idx_user_picks_match    on public.user_picks(match_id);
create index idx_user_picks_pending  on public.user_picks(user_id) where result = 'pending';
create index idx_user_picks_vbet     on public.user_picks(value_bet_id) where value_bet_id is not null;

-- ─── RLS ─────────────────────────────────────────────────────────
alter table public.user_picks enable row level security;

-- Cada usuario solo ve y opera sus propios picks
create policy "user_picks_own"
  on public.user_picks
  for all
  using (auth.uid() = user_id);

-- ─── FUNCIÓN: recalcular stats del tipster ───────────────────────
-- Se llama tras cada INSERT/UPDATE en user_picks
create or replace function public.recalc_tipster_stats(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_total_picks  int;
  v_win_rate     numeric(5,2);
  v_roi_7d       numeric(5,2);
  v_roi_30d      numeric(5,2);
begin
  -- Picks resueltos (excluye void y pending)
  select count(*)
  into v_total_picks
  from public.user_picks
  where user_id = p_user_id
    and result in ('won', 'lost');

  -- Win rate (% de ganados sobre resueltos)
  select coalesce(
    round(
      100.0 * sum(case when result = 'won' then 1 else 0 end)::numeric
           / nullif(count(*), 0),
      2
    ), 0)
  into v_win_rate
  from public.user_picks
  where user_id = p_user_id
    and result in ('won', 'lost');

  -- ROI 7 días (solo picks con stake registrado, resueltos en los últimos 7d)
  select coalesce(
    round(
      100.0 * sum(profit_loss) / nullif(sum(stake), 0),
      2
    ), 0)
  into v_roi_7d
  from public.user_picks
  where user_id = p_user_id
    and result in ('won', 'lost')
    and stake is not null
    and resolved_at >= now() - interval '7 days';

  -- ROI 30 días
  select coalesce(
    round(
      100.0 * sum(profit_loss) / nullif(sum(stake), 0),
      2
    ), 0)
  into v_roi_30d
  from public.user_picks
  where user_id = p_user_id
    and result in ('won', 'lost')
    and stake is not null
    and resolved_at >= now() - interval '30 days';

  update public.profiles
  set
    total_picks = v_total_picks,
    win_rate    = v_win_rate,
    roi_7d      = v_roi_7d,
    roi_30d     = v_roi_30d,
    updated_at  = now()
  where id = p_user_id;
end;
$$;

-- ─── FUNCIÓN: calcular profit_loss y resolved_at al resolver ─────
create or replace function public.handle_pick_resolved()
returns trigger language plpgsql as $$
begin
  -- Solo actuar cuando el resultado cambia de/hacia un estado resuelto
  if new.result = old.result then
    return new;
  end if;

  if new.result in ('won', 'lost', 'void') then
    new.resolved_at := now();

    -- Calcular profit_loss si hay stake
    if new.stake is not null then
      new.profit_loss := case new.result
        when 'won'  then round(new.stake * (new.odds - 1), 2)
        when 'lost' then -new.stake
        when 'void' then 0
      end;
    end if;
  end if;

  -- Si vuelve a pending (corrección), limpiar
  if new.result = 'pending' then
    new.resolved_at  := null;
    new.profit_loss  := null;
  end if;

  return new;
end;
$$;

create trigger trg_pick_resolved
before update on public.user_picks
for each row execute function public.handle_pick_resolved();

-- ─── FUNCIÓN: trigger post-cambio para recalcular stats ──────────
create or replace function public.trg_recalc_stats()
returns trigger language plpgsql as $$
begin
  -- En INSERT solo si ya viene resuelto (raro, pero posible en imports)
  if (tg_op = 'INSERT' and new.result in ('won', 'lost')) or
     (tg_op = 'UPDATE' and new.result <> old.result) or
     (tg_op = 'DELETE') then
    perform public.recalc_tipster_stats(coalesce(new.user_id, old.user_id));
  end if;
  return null;
end;
$$;

create trigger trg_user_picks_stats
after insert or update or delete on public.user_picks
for each row execute function public.trg_recalc_stats();

-- ─── FUNCIÓN RPC: registrar pick desde el cliente ────────────────
-- Llamada con supabase.rpc('register_pick', {...})
create or replace function public.register_pick(
  p_match_id     bigint,
  p_market       market_type,
  p_selection    text,
  p_odds         numeric,
  p_bookmaker_id int     default null,
  p_value_bet_id bigint  default null,
  p_stake        numeric default null,
  p_line         numeric default null,
  p_notes        text    default null
)
returns uuid language plpgsql security definer as $$
declare
  v_pick_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Verificar que el partido no ha terminado
  if not exists (
    select 1 from public.matches
    where id = p_match_id
      and status in ('scheduled', 'live')
  ) then
    raise exception 'match_not_available';
  end if;

  insert into public.user_picks (
    user_id, match_id, value_bet_id, bookmaker_id,
    market, selection, line, odds, stake, notes
  ) values (
    v_user_id, p_match_id, p_value_bet_id, p_bookmaker_id,
    p_market, p_selection, p_line, p_odds, p_stake, p_notes
  )
  returning id into v_pick_id;

  return v_pick_id;
end;
$$;
