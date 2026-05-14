-- Sous-dossiers de l’espace cloud par classe (arborescence + ordre).
create table if not exists public.class_cloud_folders (
  id uuid primary key default gen_random_uuid (),
  class_id uuid not null references public.classes (id) on delete cascade,
  parent_id uuid references public.class_cloud_folders (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now (),
  constraint class_cloud_folders_name_nonempty check (char_length (trim(name)) > 0)
);

create index if not exists class_cloud_folders_class_id_idx on public.class_cloud_folders (class_id);

create index if not exists class_cloud_folders_parent_id_idx on public.class_cloud_folders (parent_id);

alter table public.files
add column if not exists class_folder_id uuid references public.class_cloud_folders (id) on delete set null;

create index if not exists files_class_folder_id_idx on public.files (class_folder_id);

comment on table public.class_cloud_folders is
'Hiérarchie de sous-dossiers dans l’espace cloud d’une classe (ordre = sort_order parmi les frères).';

comment on column public.files.class_folder_id is
'Dossier classe (null = racine de l’espace cloud de la classe).';

alter table public.class_cloud_folders enable row level security;

create policy "staff select class_cloud_folders" on public.class_cloud_folders for
select
  using (auth.uid () is not null);

create policy "staff write class_cloud_folders" on public.class_cloud_folders for all using (auth.uid () is not null)
with
  check (auth.uid () is not null);
