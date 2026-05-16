-- Catalogue et demandes de documents enseignants (nouvelle recrue) + colonnes de validation sur profiles.

-- Templates configurables par la direction
create table if not exists public.teacher_document_templates (
  id uuid primary key default gen_random_uuid (),
  label text not null,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  applies_to_new_teachers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_document_templates_active_idx
  on public.teacher_document_templates (active, applies_to_new_teachers);

comment on table public.teacher_document_templates is
  'Types de pièces demandées aux enseignants ; applies_to_new_teachers duplique des lignes à la création de profil recrue.';

-- Lignes demandées par enseignant (libellé figé à l’affectation)
create table if not exists public.teacher_document_requests (
  id uuid primary key default gen_random_uuid (),
  teacher_profile_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid references public.teacher_document_templates (id) on delete set null,
  label text not null,
  description text,
  sort_order int not null default 0,
  file_id uuid references public.files (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_document_requests_teacher_idx
  on public.teacher_document_requests (teacher_profile_id);

create index if not exists teacher_document_requests_file_idx
  on public.teacher_document_requests (file_id);

comment on table public.teacher_document_requests is
  'Une pièce à fournir pour un enseignant ; file_id renseigné après dépôt.';

alter table public.profiles
  add column if not exists teacher_documents_bundle_submitted_at timestamptz;

alter table public.profiles
  add column if not exists teacher_documents_approved_at timestamptz;

alter table public.profiles
  add column if not exists teacher_documents_approved_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.teacher_documents_bundle_submitted_at is
  'Dernier envoi du paquet de pièces par l’enseignant (bouton « Envoyer »).';
comment on column public.profiles.teacher_documents_approved_at is
  'Validation direction : accès complet à l’app pour ce compte.';
comment on column public.profiles.teacher_documents_approved_by is
  'Profil directeur ayant validé (traçabilité).';

-- Comptes déjà en poste ou non concernés : ne pas bloquer après migration
update public.profiles p
set
  teacher_documents_approved_at = coalesce(p.teacher_documents_approved_at, now())
where
  p.teacher_documents_approved_at is null
  and (
    p.base_role not in ('PROFESSEUR'::public.school_role, 'PROF_PRINCIPAL'::public.school_role)
    or coalesce(p.teacher_employment_status, 'ACTIVE_AT_SCHOOL') <> 'NEW_TO_SCHOOL'
  );

-- RPC pour le middleware (une requête, lecture cohérente)
create or replace function public.profile_needs_teacher_documents_gate (p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select
      1
    from
      public.profiles pr
    where
      pr.id = p_user_id
      and pr.base_role in (
        'PROFESSEUR'::public.school_role,
        'PROF_PRINCIPAL'::public.school_role
      )
      and pr.teacher_employment_status = 'NEW_TO_SCHOOL'
      and pr.teacher_documents_approved_at is null
      and exists (
        select
          1
        from
          public.teacher_document_requests r
        where
          r.teacher_profile_id = pr.id
      )
  );
$$;

revoke all on function public.profile_needs_teacher_documents_gate (uuid) from public;

grant execute on function public.profile_needs_teacher_documents_gate (uuid) to authenticated;

grant execute on function public.profile_needs_teacher_documents_gate (uuid) to service_role;

-- RLS : même esprit que le reste de l’intranet (personnel authentifié)
alter table public.teacher_document_templates enable row level security;
alter table public.teacher_document_requests enable row level security;

drop policy if exists "staff select teacher_document_templates" on public.teacher_document_templates;
create policy "staff select teacher_document_templates" on public.teacher_document_templates for
select
  using (auth.uid () is not null);

drop policy if exists "staff write teacher_document_templates" on public.teacher_document_templates;
create policy "staff write teacher_document_templates" on public.teacher_document_templates for all using (auth.uid () is not null)
with
  check (auth.uid () is not null);

drop policy if exists "staff select teacher_document_requests" on public.teacher_document_requests;
create policy "staff select teacher_document_requests" on public.teacher_document_requests for
select
  using (auth.uid () is not null);

drop policy if exists "staff insert teacher_document_requests" on public.teacher_document_requests;
create policy "staff insert teacher_document_requests" on public.teacher_document_requests for insert with check (auth.uid () is not null);

drop policy if exists "staff update teacher_document_requests" on public.teacher_document_requests;
create policy "staff update teacher_document_requests" on public.teacher_document_requests for
update using (auth.uid () is not null)
with
  check (auth.uid () is not null);

drop policy if exists "staff delete teacher_document_requests" on public.teacher_document_requests;
create policy "staff delete teacher_document_requests" on public.teacher_document_requests for delete using (auth.uid () is not null);
