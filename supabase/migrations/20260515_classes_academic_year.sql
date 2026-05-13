-- Années scolaires (début / fin) pour les classes.

alter table public.classes add column if not exists academic_year_start integer;
alter table public.classes add column if not exists academic_year_end integer;
