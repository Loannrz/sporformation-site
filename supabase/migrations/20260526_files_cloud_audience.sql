-- Audience cible des documents Cloud (élèves, équipe/administration uniquement, ou les deux).

alter table public.files
  add column if not exists cloud_audience text not null default 'BOTH';

alter table public.files drop constraint if exists files_cloud_audience_check;

alter table public.files add constraint files_cloud_audience_check
  check (cloud_audience in ('STUDENTS', 'STAFF', 'BOTH'));

comment on column public.files.cloud_audience is
  'Public cible : STUDENTS (pédagogie / élèves), STAFF (équipe & administration, invisible aux professeurs seuls), BOTH.';
