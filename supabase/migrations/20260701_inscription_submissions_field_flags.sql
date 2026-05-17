-- Marquage question par question : absence de clé = validé implicitement pour la direction.
-- Le portail lit ce JSON pour expliquer ce qui doit être complété ou corrigé.

alter table public.inscription_submissions
  add column if not exists admin_field_flags jsonb not null default '{}'::jsonb;

comment on column public.inscription_submissions.admin_field_flags is
  'Clés = id de champ ; valeur = objet { message } si la direction demande correction (absence de clé = vu OK).';
