-- Rôle ADMINISTRATEUR + table des journaux d'activité (directeur).

alter type school_role add value if not exists 'ADMINISTRATEUR';

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

create index if not exists activity_logs_actor_id_idx
  on public.activity_logs (actor_id);

comment on table public.activity_logs is 'Journal des actions sensibles (consultation directeur). Renseigné côté serveur.';
