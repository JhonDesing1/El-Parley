-- Actualizar bookmakers a los nombres reales de API-Football.
-- Primero limpiamos slugs para evitar conflictos de unique constraint,
-- luego los reasignamos todos juntos.
UPDATE public.bookmakers SET slug = 'tmp_' || id::text;

UPDATE public.bookmakers SET name = 'Bet365',      slug = 'bet365',      affiliate_url = 'https://www.bet365.com'          WHERE id = 1;
UPDATE public.bookmakers SET name = 'Pinnacle',    slug = 'pinnacle',    affiliate_url = 'https://www.pinnacle.com/es/'     WHERE id = 2;
UPDATE public.bookmakers SET name = '1xBet',       slug = '1xbet',       affiliate_url = 'https://1xbet.com/es'             WHERE id = 3;
UPDATE public.bookmakers SET name = 'Marathonbet', slug = 'marathonbet', affiliate_url = 'https://www.marathonbet.com/es/'  WHERE id = 4;
UPDATE public.bookmakers SET name = 'Betfair',     slug = 'betfair',     affiliate_url = 'https://www.betfair.com/sport/'   WHERE id = 5;

-- Activar Europa League como featured
INSERT INTO public.leagues (id, name, slug, country, logo_url, season, is_featured)
VALUES (3, 'UEFA Europa League', 'uefa-europa-league', 'World', 'https://media.api-sports.io/football/leagues/3.png', 2025, true)
ON CONFLICT (id) DO UPDATE SET is_featured = true, season = 2025;
