-- ════════════════════════════════════════════════════════════════
--  00014 — Bookmakers internacionales
--
--  API-Football devuelve cuotas de Bet365, Pinnacle, 1xBet, etc.
--  Estos bookmakers deben existir en la tabla para que las cuotas
--  puedan insertarse con el bookmaker_id correcto (FK).
--
--  La migración previa solo tenía bookmakers colombianos (betplay, wplay,
--  codere, rivalo, 1xbet), pero el código SLUG_TO_ID asumía IDs 1-5 para
--  los internacionales, causando una asignación incorrecta.
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.bookmakers (slug, name, country, affiliate_url, priority)
VALUES
  ('bet365',      'Bet365',      'INT', 'https://www.bet365.com/',        20),
  ('pinnacle',    'Pinnacle',    'INT', 'https://www.pinnacle.com/',      21),
  ('marathonbet', 'Marathonbet', 'INT', 'https://www.marathonbet.com/',   22),
  ('betfair',     'Betfair',     'INT', 'https://www.betfair.com/',       23)
ON CONFLICT (slug) DO NOTHING;
