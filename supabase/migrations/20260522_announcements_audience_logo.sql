-- Audience ciblée + logo prédéfini pour les annonces (dashboard / page Annonces).

do $$ begin
  create type public.announcement_audience as enum (
    'ALL_STAFF',
    'DIRECTION_ONLY',
    'HEAD_TEACHERS_ONLY',
    'CLASSROOM_TEACHERS'
  );
exception when duplicate_object then null;
end $$;

alter table public.announcements
  add column if not exists audience public.announcement_audience not null default 'ALL_STAFF';

alter table public.announcements
  add column if not exists logo_key text default 'megaphone';
