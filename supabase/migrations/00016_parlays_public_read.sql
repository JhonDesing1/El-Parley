-- ════════════════════════════════════════════════════════════════
--  00016 — Parlays: lectura pública total
--
--  Consistente con 00013 (value_bets). El control de acceso
--  premium se hace en la UI (isLocked prop, blurred cards),
--  no en la base de datos.
--
--  Política anterior: parlays_free_for_all devuelve solo tier='free'
--  y parlays_premium_for_subs requiere public.is_premium() → frágil,
--  deja la página de combinadas vacía para usuarios premium si la
--  función no evalúa correctamente en contexto RLS.
-- ════════════════════════════════════════════════════════════════

-- Eliminar políticas restrictivas
DROP POLICY IF EXISTS "parlays_free_for_all"       ON public.parlays;
DROP POLICY IF EXISTS "parlays_premium_for_subs"   ON public.parlays;
DROP POLICY IF EXISTS "parlay_legs_follow_parlay"  ON public.parlay_legs;

-- Todos los parlays son legibles públicamente
CREATE POLICY "parlays_public_read" ON public.parlays
  FOR SELECT USING (true);

-- Todas las piernas son legibles públicamente
CREATE POLICY "parlay_legs_public_read" ON public.parlay_legs
  FOR SELECT USING (true);
