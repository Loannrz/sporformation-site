-- Comptes « pédago » : personnel vitrine avec droits configurables par la direction.

ALTER TYPE public.school_role ADD VALUE IF NOT EXISTS 'PEDAGO';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pedago_nav_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pedago_admin_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.pedago_nav_flags IS
  'Accès navigation quotidienne : clés partielles ; valeur absente ou true = autorisé (défaut tout oui).';
COMMENT ON COLUMN public.profiles.pedago_admin_flags IS
  'Accès tuiles administration : clés partielles ; valeur absente ou true = autorisé (défaut tout oui).';
