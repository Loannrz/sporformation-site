-- Lien optionnel d’un fichier Cloud vers un élève (dossier « par élève »).
alter table public.files
  add column if not exists student_id uuid references public.students (id) on delete set null;

create index if not exists files_student_id_idx on public.files (student_id);

comment on column public.files.student_id is
  'Élève concerné par le document ; null si le document ne cible pas un élève en particulier.';
