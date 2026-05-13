-- Identité élève : naissance, sexe (pour fiches admin).

alter table public.students add column if not exists birth_date date;
alter table public.students add column if not exists sex text;
alter table public.students add column if not exists birth_place text;

comment on column public.students.sex is 'Valeurs usuelles : M, F, X (autre / non précisé).';
