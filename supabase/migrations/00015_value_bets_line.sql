-- ════════════════════════════════════════════════════════════════
--  00015 — Añadir columna line a value_bets
--
--  La home page y otros componentes usan vb.line para mostrar la
--  línea específica de mercados over/under y handicap asiático
--  (ej: "Córners 9.5", "Over 2.5", "Hándicap +1.5").
--  Sin esta columna, la query de betSelect falla con error 42703
--  y ningún pick se muestra en la interfaz.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.value_bets
  ADD COLUMN IF NOT EXISTS line numeric(4,2);
