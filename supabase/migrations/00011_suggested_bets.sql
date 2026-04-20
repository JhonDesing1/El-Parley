-- ════════════════════════════════════════════════════════════════
--  00011 — Apuestas Sugeridas
--
--  Añade la columna is_suggested a value_bets para marcar automáticamente
--  las selecciones con probabilidad del modelo ≥ 80% y cuota ≥ 1.55
--  (cuota LATAM 0.55 de ganancia mínima). Estas apuestas se publican
--  en la página pública /picks sin necesidad de suscripción.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.value_bets
  ADD COLUMN IF NOT EXISTS is_suggested boolean NOT NULL DEFAULT false;

-- Índice parcial para consultas rápidas de apuestas sugeridas
CREATE INDEX IF NOT EXISTS value_bets_suggested_idx
  ON public.value_bets (result, detected_at DESC)
  WHERE is_suggested = true;

-- Política RLS: las apuestas sugeridas son públicas sin importar is_premium
CREATE POLICY "value_bets_suggested_public" ON public.value_bets
  FOR SELECT USING (is_suggested = true);
