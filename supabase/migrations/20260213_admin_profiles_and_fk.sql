-- À exécuter dans Supabase SQL Editor (une fois).
-- Statut enseignant + départ sans supprimer les métadonnées fichiers.

alter table public.profiles
  add column if not exists active_at_establishment boolean not null default true;
alter table public.profiles
  add column if not exists left_establishment_on date;

create policy "director update any profile" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.base_role = 'DIRECTEUR'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.base_role = 'DIRECTEUR'
    )
  );

-- Permettre la suppression d’un profil (via auth) sans bloquer sur les FK métier
alter table public.files drop constraint if exists files_owner_id_fkey;
alter table public.files
  add constraint files_owner_id_fkey
  foreign key (owner_id) references public.profiles (id) on delete set null;

alter table public.classes drop constraint if exists classes_principal_id_fkey;
alter table public.classes
  add constraint classes_principal_id_fkey
  foreign key (principal_id) references public.profiles (id) on delete set null;

alter table public.sanctions drop constraint if exists sanctions_author_id_fkey;
alter table public.sanctions
  add constraint sanctions_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

alter table public.sanctions drop constraint if exists sanctions_retired_by_fkey;
alter table public.sanctions
  add constraint sanctions_retired_by_fkey
  foreign key (retired_by) references public.profiles (id) on delete set null;

alter table public.announcements drop constraint if exists announcements_author_id_fkey;
alter table public.announcements
  add constraint announcements_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

alter table public.calendar_events drop constraint if exists calendar_events_teacher_id_fkey;
alter table public.calendar_events
  add constraint calendar_events_teacher_id_fkey
  foreign key (teacher_id) references public.profiles (id) on delete set null;

alter table public.calendar_events drop constraint if exists calendar_events_created_by_fkey;
alter table public.calendar_events
  add constraint calendar_events_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.conversations drop constraint if exists conversations_created_by_fkey;
alter table public.conversations
  add constraint conversations_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles (id) on delete set null;

alter table public.file_versions drop constraint if exists file_versions_uploaded_by_fkey;
alter table public.file_versions
  add constraint file_versions_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles (id) on delete set null;
