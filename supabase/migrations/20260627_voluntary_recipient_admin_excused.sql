-- Dispense individuelle pour une campagne de documents volontaires (enseignant sans fichier).

alter table public.teacher_voluntary_document_recipients
  add column if not exists admin_excused_at timestamptz;

alter table public.teacher_voluntary_document_recipients
  add column if not exists admin_excused_by uuid references public.profiles (id) on delete set null;

create index if not exists teacher_voluntary_document_recipients_excused_idx
  on public.teacher_voluntary_document_recipients (admin_excused_at)
  where admin_excused_at is not null;

comment on column public.teacher_voluntary_document_recipients.admin_excused_at is
  'Quand défini : l''enseignant n''est plus sollicité (bannière / modale) pour cette ligne.';
