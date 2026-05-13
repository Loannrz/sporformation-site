-- Lecture des versions de fichiers pour le personnel connecté (explorateur Cloud).
alter table public.file_versions enable row level security;

drop policy if exists "staff select file_versions" on public.file_versions;
create policy "staff select file_versions" on public.file_versions
  for select using (auth.uid() is not null);
