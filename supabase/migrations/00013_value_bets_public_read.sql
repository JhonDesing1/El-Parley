-- ════════════════════════════════════════════════════════════════
--  00013 — Value bets: lectura pública total
--
--  El modelo de negocio controla el acceso premium en la UI,
--  no en la base de datos. Exponer las value bets públicamente
--  permite que la página de inicio siempre muestre picks
--  (condición necesaria para conversión a premium).
--
--  Política anterior: solo is_premium=false (edge >= 6%) visible
--  para todos → dejaba la página vacía la mayoría del tiempo
--  porque la mayoría de picks tienen edge 3-6%.
-- ════════════════════════════════════════════════════════════════

-- Eliminar la política restrictiva original
DROP POLICY IF EXISTS "value_bets_free_for_all" ON public.value_bets;

-- Nueva política: todas las value_bets son legibles públicamente.
-- El control de acceso premium se hace en la UI (blurred cards, etc.)
CREATE POLICY "value_bets_public_read" ON public.value_bets
  FOR SELECT USING (true);
