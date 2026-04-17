-- ════════════════════════════════════════════════════════════════
--  El Parley — Migración 00009: Preferencias de alertas Telegram
-- ════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists tg_value_bets boolean not null default true,
  add column if not exists tg_results    boolean not null default true,
  add column if not exists tg_parlays    boolean not null default true;
