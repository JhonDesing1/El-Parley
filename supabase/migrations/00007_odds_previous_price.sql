-- Agrega columna previous_price a la tabla odds para rastrear movimientos de cuotas
ALTER TABLE public.odds ADD COLUMN IF NOT EXISTS previous_price numeric(6,3);

-- Función: captura el precio anterior antes de cada actualización
CREATE OR REPLACE FUNCTION public.capture_previous_odds_price()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    NEW.previous_price := OLD.price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: se ejecuta antes de cada UPDATE en odds
DROP TRIGGER IF EXISTS odds_capture_previous_price ON public.odds;
CREATE TRIGGER odds_capture_previous_price
  BEFORE UPDATE ON public.odds
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_previous_odds_price();
