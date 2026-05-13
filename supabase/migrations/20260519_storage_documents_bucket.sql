-- Bucket Storage pour les dépôts Cloud (50 Mo max par objet).
-- Corrige l’erreur API « Bucket not found » si le bucket n’avait pas été créé à la main.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  null
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  public = excluded.public;
