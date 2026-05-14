-- Hub sanctions administration : repères « nouvelles » par utilisateur + titre court optionnel sur une sanction.

alter table public.profiles
  add column if not exists admin_sanctions_last_seen_at timestamptz default now();

comment on column public.profiles.admin_sanctions_last_seen_at is
  'Horodatage de dernière consultation de la liste sanctions admin ; les sanctions créées après sont comptées comme « nouvelles » jusqu''à la sortie de la page.';

update public.profiles
set admin_sanctions_last_seen_at = coalesce(admin_sanctions_last_seen_at, now());

alter table public.sanctions
  add column if not exists title text;

comment on column public.sanctions.title is
  'Titre ou libellé court (optionnel) ; à défaut l’interface affiche le type de sanction.';
