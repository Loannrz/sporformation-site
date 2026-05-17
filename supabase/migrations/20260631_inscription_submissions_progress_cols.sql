-- Bases où `inscription_submissions` existe sans progression (avant alignement du DDL).
-- Même logique que 20260630 : IF NOT EXISTS sans toucher aux tables neuves.

alter table public.inscription_submissions
  add column if not exists current_step_index integer not null default 0,
  add column if not exists progress_percent integer not null default 0;

comment on column public.inscription_submissions.progress_percent is
  'Progression enregistrée côté portail (0–100), distincte du calcul live admin.';
