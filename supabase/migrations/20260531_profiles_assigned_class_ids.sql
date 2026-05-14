-- Classes où l’enseignant intervient en tant que professeur (hors titre de PP / principal_id).

alter table public.profiles
add column if not exists assigned_class_ids uuid[] not null default '{}';

comment on column public.profiles.assigned_class_ids is
'Classes assignées pour un professeur de classe (PROFESSEUR). Distinct de principal_class_ids (titulaire PP). Vide pour les autres rôles.';
