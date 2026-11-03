ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS controla_estoque boolean NOT NULL DEFAULT TRUE;
