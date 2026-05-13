-- Première connexion enseignant invité + statut d’affectation
alter table public.profiles
  add column if not exists must_set_password boolean not null default false;
alter table public.profiles
  add column if not exists teacher_employment_status text not null default 'ACTIVE_AT_SCHOOL'
    check (
      teacher_employment_status in (
        'ACTIVE_AT_SCHOOL',
        'NEW_TO_SCHOOL',
        'FORMER_INACTIVE'
      )
    );

comment on column public.profiles.must_set_password is
  'true si le compte a été créé par la direction : connexion OTP puis choix du mot de passe obligatoire';
comment on column public.profiles.teacher_employment_status is
  'ACTIVE_AT_SCHOOL = en poste habituel, NEW_TO_SCHOOL = nouvelle recrue, FORMER_INACTIVE = ancien enseignant sans accès';
