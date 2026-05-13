-- Métadonnées affichées pour les documents Cloud.
alter table public.files add column if not exists title text not null default '';
alter table public.files add column if not exists description text not null default '';

comment on column public.files.title is 'Nom du document saisi par l''utilisateur.';
comment on column public.files.description is 'Description obligatoire à l''upload ; vide pour les enregistrements historiques.';
