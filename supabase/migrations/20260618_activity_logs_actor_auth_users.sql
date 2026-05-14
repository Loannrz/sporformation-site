-- activity_logs.actor_id doit pouvoir référencer tout utilisateur authentifié
-- (staff via public.profiles ET élèves via public.students.auth_user_id).
-- On retire la FK sur public.profiles et on la remplace par une FK sur auth.users.
-- Cohérent avec ce que getSessionUser renvoie (user.id = auth.users.id).

alter table public.activity_logs
  drop constraint if exists activity_logs_actor_id_fkey;

alter table public.activity_logs
  add constraint activity_logs_actor_id_fkey
  foreign key (actor_id) references auth.users (id) on delete set null;
