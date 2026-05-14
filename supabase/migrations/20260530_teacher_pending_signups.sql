-- Invitations enseignant : email pré-enregistré par la direction, compte Auth créé uniquement à la première inscription sur la page connexion.

create table if not exists public.teacher_pending_signups (
  email text primary key check (length(trim(email)) > 3),
  first_name text not null,
  last_name text not null,
  base_role public.school_role not null,
  teacher_employment_status text not null
    check (
      teacher_employment_status in (
        'ACTIVE_AT_SCHOOL',
        'NEW_TO_SCHOOL',
        'FORMER_INACTIVE'
      )
    ),
  joined_at date,
  left_establishment_on date,
  bio text,
  subjects text[] not null default '{}',
  principal_class_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

comment on table public.teacher_pending_signups is
  'Enseignant pré-créé sans utilisateur Auth : inscription réservée à cet e-mail sur la page de connexion.';

alter table public.teacher_pending_signups enable row level security;
