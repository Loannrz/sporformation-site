-- Dossier système « Documents des élèves » par classe (dépôt élèves + sous-dossiers créés par enseignants).

do $$
begin
  alter type public.school_role add value if not exists 'ELEVE';
exception
  when undefined_object then
    raise notice 'school_role type missing — create via base schema migrations first.';
end $$;

alter table public.class_cloud_folders
add column if not exists is_system boolean not null default false;

alter table public.class_cloud_folders
add column if not exists system_kind text;

alter table public.class_cloud_folders
drop constraint if exists class_cloud_folders_system_kind_check;

alter table public.class_cloud_folders
add constraint class_cloud_folders_system_kind_check
check (system_kind is null or system_kind = 'STUDENT_INBOX');

create unique index if not exists class_cloud_folders_student_inbox_per_class_uidx on public.class_cloud_folders (
  class_id
)
where system_kind = 'STUDENT_INBOX';

comment on column public.class_cloud_folders.is_system is
'Dossiers gérés par l''app (pas de renommage / suppression par la direction depuis l''UI classe).';

comment on column public.class_cloud_folders.system_kind is
'STUDENT_INBOX : racine des dépôts élèves ; sous-dossiers restent system_kind NULL.';

-- Insérer le dossier pour chaque classe qui n'en a pas encore.
insert into public.class_cloud_folders (
  class_id,
  parent_id,
  name,
  sort_order,
  is_system,
  system_kind
)
select c.id,
  null,
  'Documents des élèves',
  -999,
  true,
  'STUDENT_INBOX'
from public.classes c
where not exists (
    select 1 from public.class_cloud_folders f
    where f.class_id = c.id and f.system_kind = 'STUDENT_INBOX'
  );
