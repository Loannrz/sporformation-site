-- Demandes formulaires vitrine (étudiants / employeurs) — suivi direction dans Sporformation.

CREATE TABLE IF NOT EXISTS public.formulaires_etudiants (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prenom VARCHAR(120) NOT NULL,
  nom VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  telephone VARCHAR(40) NOT NULL,
  ville_residence VARCHAR(200),
  formation_souhaitee VARCHAR(200) NOT NULL,
  ville_formation VARCHAR(200),
  situation VARCHAR(160) NOT NULL,
  employeur_structure VARCHAR(200) NOT NULL,
  source_connaissance VARCHAR(160) NOT NULL,
  motivation TEXT NOT NULL,
  consentement_recontact BOOLEAN NOT NULL DEFAULT FALSE,
  consentement_politique BOOLEAN NOT NULL DEFAULT FALSE,
  origine VARCHAR(80) NOT NULL DEFAULT 'site-vitrine',
  statut TEXT NOT NULL DEFAULT 'nouveau',
  contacte_at TIMESTAMPTZ,
  approuve_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_formulaires_etudiants_created
  ON public.formulaires_etudiants (created_at DESC);

CREATE TABLE IF NOT EXISTS public.formulaires_employeurs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prenom VARCHAR(120) NOT NULL,
  nom VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  telephone VARCHAR(40) NOT NULL,
  formation_recherchee VARCHAR(200) NOT NULL,
  recherche_alternants BOOLEAN NOT NULL DEFAULT FALSE,
  consentement_recontact BOOLEAN NOT NULL DEFAULT FALSE,
  consentement_politique BOOLEAN NOT NULL DEFAULT FALSE,
  origine VARCHAR(80) NOT NULL DEFAULT 'site-vitrine',
  statut TEXT NOT NULL DEFAULT 'nouveau',
  contacte_at TIMESTAMPTZ,
  approuve_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_formulaires_employeurs_created
  ON public.formulaires_employeurs (created_at DESC);

ALTER TABLE public.formulaires_etudiants
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'nouveau',
  ADD COLUMN IF NOT EXISTS contacte_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approuve_at TIMESTAMPTZ;

ALTER TABLE public.formulaires_employeurs
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'nouveau',
  ADD COLUMN IF NOT EXISTS contacte_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approuve_at TIMESTAMPTZ;

-- Vitrine : INSERT anonyme uniquement (lecture = service_role côté app admin).
ALTER TABLE public.formulaires_etudiants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulaires_employeurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formulaires_etudiants_anon_insert" ON public.formulaires_etudiants;
CREATE POLICY "formulaires_etudiants_anon_insert"
  ON public.formulaires_etudiants
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "formulaires_employeurs_anon_insert" ON public.formulaires_employeurs;
CREATE POLICY "formulaires_employeurs_anon_insert"
  ON public.formulaires_employeurs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- RPC comptage vitrine (inchangé si fonction déjà créée ailleurs).
CREATE OR REPLACE FUNCTION public.count_formulaires_etudiants()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint FROM public.formulaires_etudiants;
$$;

COMMENT ON FUNCTION public.count_formulaires_etudiants() IS
  'Nombre total de lignes formulaires_etudiants pour affichage vitrine';

REVOKE ALL ON FUNCTION public.count_formulaires_etudiants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_formulaires_etudiants() TO anon;
GRANT EXECUTE ON FUNCTION public.count_formulaires_etudiants() TO authenticated;
