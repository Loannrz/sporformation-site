-- Permet à un compte Auth lié à une fiche élève (sans ligne profiles) de lire sa propre ligne,
-- même si les politiques « staff » ont été restreintes.
drop policy if exists "students_select_own" on public.students;

create policy "students_select_own" on public.students
  for select
  using (auth.uid() = auth_user_id);
