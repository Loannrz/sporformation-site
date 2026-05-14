-- SPORFORMATION — schéma Postgres / Supabase (exemple de départ).
-- À exécuter dans l’éditeur SQL Supabase. Vérifiez les policies RLS avant prod.

create extension if not exists "uuid-ossp";

do $$ begin
  create type school_role as enum ('DIRECTEUR', 'PROF_PRINCIPAL', 'PROFESSEUR');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text unique,
  avatar_url text,
  bio text,
  joined_at date,
  base_role school_role not null default 'PROFESSEUR',
  principal_class_ids uuid[] default '{}',
  subjects text[] default '{}',
  locale text default 'fr',
  admin_sanctions_last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  principal_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  photo_url text,
  class_id uuid references public.classes(id) on delete set null,
  entry_date date,
  birth_date date,
  sex text,
  birth_place text,
  njs text,
  promo text,
  of_name text,
  formation_number text,
  diploma text,
  tep text,
  birth_country text,
  birth_department text,
  phone text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  address_city text,
  address_country text,
  employment_status text,
  parcoursup text,
  validation_status text,
  uc1_status text,
  uc2_status text,
  uc3_status text,
  uc4_status text,
  auth_user_id uuid references auth.users(id),
  activated boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.custom_roles(id),
  sort_order int default 0,
  name_fr text not null,
  name_en text not null,
  permissions jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.role_assignments (
  role_id uuid references public.custom_roles(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  primary key (role_id, profile_id)
);

do $$ begin
  create type sanction_status as enum ('active','retired');
exception when duplicate_object then null; end $$;
do $$ begin
  create type sanction_type as enum (
    'avertissement',
    'punition',
    'sanction',
    'retard',
    'absence',
    'comportement',
    'autre'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.sanctions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  type sanction_type not null default 'autre',
  occurred_at timestamptz not null default now(),
  description text not null,
  title text,
  author_id uuid references public.profiles(id),
  status sanction_status not null default 'active',
  retired_at timestamptz,
  retired_by uuid references public.profiles(id),
  pdf_path text,
  created_at timestamptz default now()
);

create table if not exists public.sanction_attachments (
  id uuid primary key default gen_random_uuid(),
  sanction_id uuid references public.sanctions(id) on delete cascade,
  file_path text not null,
  created_at timestamptz default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  logical_key text not null,
  bucket_id text default 'documents',
  current_path text not null,
  class_id uuid references public.classes(id) on delete set null,
  subject_slug text,
  owner_id uuid references public.profiles(id),
  mime text,
  created_at timestamptz default now()
);

create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references public.files(id) on delete cascade,
  storage_path text not null,
  version int not null,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean default false,
  name text,
  created_by uuid references auth.users(id) on delete set null,
  group_admin_profile_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  profile_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  kind text not null default 'user' check (kind in ('user','system')),
  body text not null default '',
  system_payload jsonb,
  sent_at timestamptz default now(),
  attachment_path text,
  attachment_filename text,
  attachment_mime text,
  attachment_size_bytes bigint
);

do $$ begin create type announcement_priority as enum ('normal','urgent');
exception when duplicate_object then null; end $$;

do $$ begin create type announcement_audience as enum (
  'ALL_STAFF',
  'DIRECTION_ONLY',
  'HEAD_TEACHERS_ONLY',
  'CLASSROOM_TEACHERS'
);
exception when duplicate_object then null; end $$;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  html text not null,
  importance announcement_priority default 'normal',
  author_id uuid references public.profiles(id),
  audience announcement_audience not null default 'ALL_STAFF',
  logo_key text default 'megaphone',
  accent text default 'slate',
  created_at timestamptz default now()
);

do $$ begin create type calendar_event_type as enum ('course','meeting','school_event','deadline');
exception when duplicate_object then null; end $$;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind calendar_event_type not null default 'school_event',
  class_id uuid references public.classes(id) on delete set null,
  teacher_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.connection_logs (
  id bigserial primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  logged_at timestamptz default now(),
  ip inet,
  user_agent text
);

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.sanctions enable row level security;
alter table public.files enable row level security;
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
alter table public.announcements enable row level security;
alter table public.calendar_events enable row level security;
alter table public.custom_roles enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "upsert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Bucket Storage « documents » à créer dans Supabase (max 50Mo, filtrage MIME dans l’application).

-- Politiques staff (intranet) : un utilisateur authentifié avec une ligne `profiles` peut lire/écrire.
-- Affinez par base_role en production (directeur seulement pour certaines tables).

create policy "staff select profiles" on public.profiles
  for select using (auth.uid() is not null);

create policy "staff update own profile row" on public.profiles
  for update using (auth.uid() = id);

create policy "staff select classes" on public.classes
  for select using (auth.uid() is not null);

create policy "staff write classes" on public.classes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "staff select students" on public.students
  for select using (auth.uid() is not null);

create policy "staff write students" on public.students
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "students_select_own" on public.students
  for select using (auth.uid() = auth_user_id);

create policy "staff select sanctions" on public.sanctions
  for select using (auth.uid() is not null);

create policy "staff insert sanctions" on public.sanctions
  for insert with check (auth.uid() is not null);

create policy "staff update sanctions" on public.sanctions
  for update using (auth.uid() is not null);

create policy "staff select announcements" on public.announcements
  for select using (auth.uid() is not null);

create policy "staff insert announcements" on public.announcements
  for insert with check (auth.uid() is not null);

create policy "staff select calendar_events" on public.calendar_events
  for select using (auth.uid() is not null);

create policy "staff write calendar_events" on public.calendar_events
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "staff select conversations" on public.conversations
  for select using (auth.uid() is not null);

create policy "staff write conversations" on public.conversations
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "staff select messages" on public.messages
  for select using (auth.uid() is not null);

create policy "staff write messages" on public.messages
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "staff select files" on public.files
  for select using (auth.uid() is not null);

create policy "staff write files" on public.files
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "staff select custom_roles" on public.custom_roles
  for select using (auth.uid() is not null);

create policy "staff write custom_roles" on public.custom_roles
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table public.role_assignments enable row level security;

create policy "staff read role_assignments" on public.role_assignments
  for select using (auth.uid() is not null);

create policy "staff write role_assignments" on public.role_assignments
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Évolutions admin (comptes enseignants, réordonnancement rôles, contraintes ON DELETE) :
-- exécuter le fichier supabase/migrations/20260213_admin_profiles_and_fk.sql dans le SQL Editor.

-- Première connexion enseignant + statut d’affectation :
-- supabase/migrations/20260214_teacher_onboarding.sql
