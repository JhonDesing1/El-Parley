-- ════════════════════════════════════════════════════════════════
--  EL PARLEY — Picks de tipster (gestionados por admin)
-- ════════════════════════════════════════════════════════════════

create table public.tipster_picks (
  id              bigserial primary key,
  tipster_name    text not null default 'El Parley',
  -- Partido (opcional — puede no estar en la BD)
  match_id        bigint references public.matches(id) on delete set null,
  match_label     text,      -- ej: "Real Madrid vs Barcelona"
  league_label    text,      -- ej: "La Liga"
  kickoff         timestamptz,
  -- Detalles de la apuesta
  market          text not null,     -- "1x2", "btts", etc.
  selection       text not null,     -- "home", "over", "sí", texto libre…
  odds            numeric(6,3) not null check (odds > 1),
  stake_units     smallint default 1 check (stake_units between 1 and 10),
  -- Resultado
  result          pick_result not null default 'pending',
  profit_units    numeric(6,2),      -- unidades ganadas/perdidas
  -- Contenido
  published       boolean not null default true,
  reasoning       text,              -- razonamiento del pick
  notes           text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index idx_tipster_picks_published on public.tipster_picks(published, created_at desc);
create index idx_tipster_picks_result    on public.tipster_picks(result)    where result = 'pending';
create index idx_tipster_picks_match     on public.tipster_picks(match_id)  where match_id is not null;

-- RLS: lectura pública de picks publicados; escritura solo vía service role (admin)
alter table public.tipster_picks enable row level security;

create policy "tipster_picks_public_read"
  on public.tipster_picks
  for select
  using (published = true);

-- ── TRIGGER: calcular profit_units y resolved_at al resolver ──
create or replace function public.handle_tipster_pick_resolved()
returns trigger language plpgsql as $$
begin
  if new.result = old.result then
    return new;
  end if;

  if new.result in ('won', 'lost', 'void') then
    new.resolved_at := now();
    new.profit_units := case new.result
      when 'won'  then round(new.stake_units * (new.odds - 1), 2)
      when 'lost' then -new.stake_units::numeric
      when 'void' then 0
    end;
  end if;

  if new.result = 'pending' then
    new.resolved_at  := null;
    new.profit_units := null;
  end if;

  return new;
end;
$$;

create trigger trg_tipster_pick_resolved
before update on public.tipster_picks
for each row execute function public.handle_tipster_pick_resolved();
