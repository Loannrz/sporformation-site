-- Calendrier : événements personnels vs partagés (direction) et ciblages précis.

alter table public.calendar_events
  add column if not exists personal boolean not null default false;

alter table public.calendar_events
  add column if not exists description text;

alter table public.calendar_events
  add column if not exists audience text;

-- Anciennes lignes : événements publics assimilés au personnel complet.
update public.calendar_events
set audience = 'ALL_STAFF'
where personal = false and audience is null;

alter table public.calendar_events
  drop constraint if exists calendar_events_personal_audience_ck;

alter table public.calendar_events
  add constraint calendar_events_personal_audience_ck check (
    (personal = true and audience is null)
    or (personal = false and audience is not null)
  );

alter table public.calendar_events
  drop constraint if exists calendar_events_audience_values_ck;

alter table public.calendar_events
  add constraint calendar_events_audience_values_ck check (
    audience is null
    or audience in (
      'ALL_STAFF',
      'CLASSROOM_TEACHERS',
      'HEAD_TEACHERS_ONLY',
      'DIRECTION_ONLY',
      'SPECIFIC_TARGETS'
    )
  );

create table if not exists public.calendar_event_targets (
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  entity_type text not null check (entity_type in ('profile', 'class', 'student')),
  entity_id uuid not null,
  primary key (event_id, entity_type, entity_id)
);

create index if not exists calendar_event_targets_entity_idx
  on public.calendar_event_targets (entity_type, entity_id);

alter table public.calendar_event_targets enable row level security;

create policy "staff calendar_event_targets all"
  on public.calendar_event_targets
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
