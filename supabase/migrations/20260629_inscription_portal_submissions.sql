-- Portail inscription (hors Supabase Auth candidats) + gestion admin dans le Cloud

create table if not exists public.portal_accounts (
  id uuid primary key default gen_random_uuid (),
  email text not null,
  first_name text,
  last_name text,
  password_hash text,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portal_accounts_email_lower_idx
  on public.portal_accounts (lower (trim (email)));

create table if not exists public.inscription_templates (
  id uuid primary key default gen_random_uuid (),
  title text not null,
  slug text not null,
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inscription_templates_slug_lower_idx
  on public.inscription_templates (lower (trim (slug)));

create table if not exists public.inscription_submissions (
  id uuid primary key default gen_random_uuid (),
  portal_account_id uuid not null references public.portal_accounts (id) on delete cascade,
  template_id uuid not null references public.inscription_templates (id) on delete restrict,
  formation_slug text not null default '',
  ville_slug text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  answers jsonb not null default '{}'::jsonb,
  files jsonb not null default '{}'::jsonb,
  current_step_index integer not null default 0,
  progress_percent integer not null default 0,
  submitted_at timestamptz,
  admin_review_status text check (
    admin_review_status is null
    or admin_review_status in ('pending', 'accepted', 'rejected', 'needs_completion')
  ),
  reviewed_at timestamptz,
  reviewer_note text,
  reviewer_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inscription_submissions_portal_account_idx
  on public.inscription_submissions (portal_account_id);
create index if not exists inscription_submissions_template_idx
  on public.inscription_submissions (template_id);
create index if not exists inscription_submissions_status_idx
  on public.inscription_submissions (status);
create index if not exists inscription_submissions_formation_idx
  on public.inscription_submissions (formation_slug);
create index if not exists inscription_submissions_ville_idx
  on public.inscription_submissions (ville_slug);
create index if not exists inscription_submissions_updated_idx
  on public.inscription_submissions (updated_at desc);

comment on table public.portal_accounts is
  'Comptes portail candidature (auth applicative hors Supabase Auth).';
comment on table public.inscription_templates is
  'Modèles de formulaire d''inscription (définition JSON).';
comment on table public.inscription_submissions is
  'Dossiers d''inscription liés au portail ; pièges Storage : files[fieldId].path dans bucket public-uploads.';

alter table public.portal_accounts enable row level security;
alter table public.inscription_templates enable row level security;
alter table public.inscription_submissions enable row level security;

-- Accès applicatif via service_role / serveur uniquement
create policy "portal_accounts no direct access"
  on public.portal_accounts for all using (false);
create policy "inscription_templates no direct access"
  on public.inscription_templates for all using (false);
create policy "inscription_submissions no direct access"
  on public.inscription_submissions for all using (false);

insert into
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'public-uploads',
    'public-uploads',
    true,
    52428800,
    null
  )
on conflict (id) do nothing;
