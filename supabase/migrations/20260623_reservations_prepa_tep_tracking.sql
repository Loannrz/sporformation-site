-- Suivi direction des réservations Prépa TEP (vitrine) — même workflow que
-- formulaires_etudiants / formulaires_employeurs : 'nouveau' → 'contacte' → 'approuve'.

ALTER TABLE public.reservations_prepa_tep
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'nouveau',
  ADD COLUMN IF NOT EXISTS contacte_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approuve_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reservations_prepa_tep_statut
  ON public.reservations_prepa_tep (statut);

-- RLS reste activée et sans policy : seul le service_role (côté serveur Node)
-- peut lire/écrire — l'app admin Sporformation l'utilise via createAdminSupabase().
