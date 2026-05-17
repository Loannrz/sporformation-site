-- Message global affichable côté portail quand la direction demande des corrections + brouillon forcé.

alter table public.inscription_submissions
  add column if not exists candidate_revision_notice text;

comment on column public.inscription_submissions.candidate_revision_notice is
  'Texte libre direction pour le candidat (ex. synthèse après « Demander les modifications ») ; complète admin_field_flags.';
