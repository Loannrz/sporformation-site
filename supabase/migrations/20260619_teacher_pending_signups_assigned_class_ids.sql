-- Stocke aussi les classes où l'enseignant pré-invité interviendra
-- (rôle PROFESSEUR ou PROF_PRINCIPAL en parallèle de principal_class_ids).
-- Reportées sur profiles.assigned_class_ids lors de la finalisation du compte.

alter table public.teacher_pending_signups
add column if not exists assigned_class_ids uuid[] not null default '{}';

comment on column public.teacher_pending_signups.assigned_class_ids is
'Classes où l''enseignant intervient (rôle PROFESSEUR/PROF_PRINCIPAL). Reportées sur profiles.assigned_class_ids à la finalisation.';
