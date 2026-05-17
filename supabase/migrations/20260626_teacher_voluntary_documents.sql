-- Demandes de pièces optionnelles (sans blocage d'accès / hors gate onboarding).

create table if not exists public.teacher_voluntary_document_requests (
  id uuid primary key default gen_random_uuid (),
  label text not null,
  description text,
  scope_kind text not null check (scope_kind in ('all_staff_teachers', 'selected')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists teacher_voluntary_document_requests_status_idx
  on public.teacher_voluntary_document_requests (status);

create index if not exists teacher_voluntary_document_requests_created_at_idx
  on public.teacher_voluntary_document_requests (created_at desc);

comment on table public.teacher_voluntary_document_requests is
  'Campagne de demande de document pour enseignants ; ne participe pas au gate middleware onboarding.';

create table if not exists public.teacher_voluntary_document_recipients (
  id uuid primary key default gen_random_uuid (),
  request_id uuid not null references public.teacher_voluntary_document_requests (id) on delete cascade,
  teacher_profile_id uuid not null references public.profiles (id) on delete cascade,
  file_id uuid references public.files (id) on delete set null,
  uploaded_at timestamptz,
  unique (request_id, teacher_profile_id)
);

create index if not exists teacher_voluntary_document_recipients_teacher_idx
  on public.teacher_voluntary_document_recipients (teacher_profile_id);

create index if not exists teacher_voluntary_document_recipients_request_idx
  on public.teacher_voluntary_document_recipients (request_id);

create index if not exists teacher_voluntary_document_recipients_file_idx
  on public.teacher_voluntary_document_recipients (file_id)
  where file_id is not null;

comment on table public.teacher_voluntary_document_recipients is
  'Une ligne par enseignant ciblé par une campagne voluntary ; file_id renseigné après dépôt.';

alter table public.teacher_voluntary_document_requests enable row level security;
alter table public.teacher_voluntary_document_recipients enable row level security;

drop policy if exists "authenticated select teacher_voluntary_document_requests"
  on public.teacher_voluntary_document_requests;
create policy "authenticated select teacher_voluntary_document_requests"
  on public.teacher_voluntary_document_requests for select
  using (auth.uid () is not null);

drop policy if exists "authenticated write teacher_voluntary_document_requests"
  on public.teacher_voluntary_document_requests;
create policy "authenticated write teacher_voluntary_document_requests"
  on public.teacher_voluntary_document_requests for all
  using (auth.uid () is not null)
  with check (auth.uid () is not null);

drop policy if exists "authenticated select teacher_voluntary_document_recipients"
  on public.teacher_voluntary_document_recipients;
create policy "authenticated select teacher_voluntary_document_recipients"
  on public.teacher_voluntary_document_recipients for select
  using (auth.uid () is not null);

drop policy if exists "authenticated insert teacher_voluntary_document_recipients"
  on public.teacher_voluntary_document_recipients;
create policy "authenticated insert teacher_voluntary_document_recipients"
  on public.teacher_voluntary_document_recipients for insert
  with check (auth.uid () is not null);

drop policy if exists "authenticated update teacher_voluntary_document_recipients"
  on public.teacher_voluntary_document_recipients;
create policy "authenticated update teacher_voluntary_document_recipients"
  on public.teacher_voluntary_document_recipients for update
  using (auth.uid () is not null)
  with check (auth.uid () is not null);

drop policy if exists "authenticated delete teacher_voluntary_document_recipients"
  on public.teacher_voluntary_document_recipients;
create policy "authenticated delete teacher_voluntary_document_recipients"
  on public.teacher_voluntary_document_recipients for delete
  using (auth.uid () is not null);
