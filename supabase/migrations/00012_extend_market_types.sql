-- Extiende el enum market_type para soportar los nuevos mercados:
--   over_under_3_5  — goles más/menos 3.5
--   corners_over_under — córners totales más/menos
--   cards_over_under   — tarjetas amarillas totales más/menos
--
-- ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de una transacción
-- en PostgreSQL < 12. Supabase usa PG 15+, así que es seguro hacerlo inline.

alter type market_type add value if not exists 'over_under_3_5';
alter type market_type add value if not exists 'corners_over_under';
alter type market_type add value if not exists 'cards_over_under';
