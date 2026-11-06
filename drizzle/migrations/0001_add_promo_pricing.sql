ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS price_normal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_promo integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_session_normal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_session_promo integer NOT NULL DEFAULT 0;
