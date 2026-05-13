-- Description des classes + suppression en cascade propre (FK).

alter table public.classes add column if not exists description text;

alter table public.files drop constraint if exists files_class_id_fkey;
alter table public.files
  add constraint files_class_id_fkey
  foreign key (class_id) references public.classes (id) on delete set null;

alter table public.calendar_events drop constraint if exists calendar_events_class_id_fkey;
alter table public.calendar_events
  add constraint calendar_events_class_id_fkey
  foreign key (class_id) references public.classes (id) on delete set null;
