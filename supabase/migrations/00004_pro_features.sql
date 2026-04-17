-- ════════════════════════════════════════════════════════════════
--  APUESTAVALUE — Migración 00004: Infraestructura Plan Pro
-- ════════════════════════════════════════════════════════════════

-- ─── API Keys personales ──────────────────────────────────────
-- Almacenamos la clave en texto plano (prefijo av_pro_) ya que el
-- usuario necesita verla una sola vez y la rota si la compromete.
alter table public.profiles
  add column if not exists api_key text unique,
  add column if not exists telegram_chat_id text;

-- ─── Webhooks personalizados ─────────────────────────────────
create table if not exists public.user_webhooks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  -- Secreto HMAC-SHA256 para firmar el payload (generado al crear)
  secret text not null,
  -- Eventos suscritos: 'value_bet' | 'parlay' | 'result'
  events text[] not null default array['value_bet'],
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  failure_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_webhooks_user
  on public.user_webhooks(user_id);

create index if not exists idx_user_webhooks_active
  on public.user_webhooks(is_active)
  where is_active = true;

-- ─── RLS para user_webhooks ──────────────────────────────────
alter table public.user_webhooks enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'user_webhooks'
      and policyname = 'Users manage own webhooks'
  ) then
    execute $policy$
      create policy "Users manage own webhooks"
        on public.user_webhooks
        for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $policy$;
  end if;
end $$;
