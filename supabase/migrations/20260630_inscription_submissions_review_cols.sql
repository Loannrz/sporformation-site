-- Répare les bases où `inscription_submissions` existe déjà sans colonnes « avis direction ».
-- (CREATE TABLE IF NOT EXISTS ne modifie pas une table créée lors d’un essai précédent.)

alter table public.inscription_submissions
  add column if not exists submitted_at timestamptz,
  add column if not exists admin_review_status text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewer_note text,
  add column if not exists reviewer_profile_id uuid references public.profiles (id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'inscription_submissions'
      and c.conname = 'inscription_submissions_admin_review_status_check'
  ) then
    alter table public.inscription_submissions
      add constraint inscription_submissions_admin_review_status_check check (
        admin_review_status is null
        or admin_review_status in ('pending', 'accepted', 'rejected', 'needs_completion')
      );
  end if;
end $$;

comment on column public.inscription_submissions.admin_review_status is
  'Décision admin : null si brouillon non examiné en ce sens ; submitted → pending par défaut côté app.';
