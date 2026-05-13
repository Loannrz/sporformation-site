-- Teinte visuelle optionnelle pour les cartes annonces.

alter table public.announcements
  add column if not exists accent text default 'slate';
