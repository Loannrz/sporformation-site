-- Refus administrateur d'un dépôt volontaire : l'enseignant doit renvoyer un fichier valide.

alter table public.teacher_voluntary_document_recipients
  add column if not exists voluntary_invalidated_at timestamptz;

alter table public.teacher_voluntary_document_recipients
  add column if not exists voluntary_invalidated_by uuid references public.profiles (id) on delete set null;

create index if not exists teacher_voluntary_document_recipients_invalidated_idx
  on public.teacher_voluntary_document_recipients (voluntary_invalidated_at)
  where voluntary_invalidated_at is not null;

comment on column public.teacher_voluntary_document_recipients.voluntary_invalidated_at is
  'Administrateur considère le fichier invalide après dépôt ; réinitialisé après un nouveau dépôt accepté ou dispense.';
