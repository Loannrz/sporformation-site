-- Photos de profil (max 10 Mo, images). Bucket public pour URLs stables côté UI.

drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "avatars_insert_own_folder" on storage.objects;
drop policy if exists "avatars_update_own_folder" on storage.objects;
drop policy if exists "avatars_delete_own_folder" on storage.objects;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  10485760,
  array[
    'image/jpeg'::text,
    'image/png'::text,
    'image/webp'::text,
    'image/gif'::text
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own_folder"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Permet à l’élève de mettre à jour sa propre ligne (ex. photo_url) sans rôle staff.
drop policy if exists "students_update_own_row" on public.students;
create policy "students_update_own_row" on public.students
  for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);
