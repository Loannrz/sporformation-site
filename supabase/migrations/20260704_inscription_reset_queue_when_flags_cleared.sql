-- Dès qu’il ne reste plus de champ signalé (`admin_field_flags` vide) alors que le dossier
-- était encore « en attente candidat » (`needs_completion`), repasser en file standard
-- (`pending` = à traiter) et lever le message global pour le portail.

create or replace function public.inscription_submissions_reset_when_flags_cleared()
returns trigger
language plpgsql
as $$
begin
  if new.admin_review_status is distinct from 'needs_completion' then
    return new;
  end if;
  if new.admin_field_flags is null or new.admin_field_flags <> '{}'::jsonb then
    return new;
  end if;
  new.admin_review_status := 'pending';
  new.candidate_revision_notice := null;
  new.reviewed_at := null;
  new.reviewer_profile_id := null;
  return new;
end;
$$;

-- DROP puis CREATE dans le même bloc : sinon un « Run » partiel (sans le DROP) provoque 42710 (trigger déjà là).
-- Si la table n’existe pas encore, on ne fait rien (évite l’erreur sur DROP hors relation).
do $$
begin
  if to_regclass('public.inscription_submissions') is not null then
    execute
      'drop trigger if exists inscription_submissions_reset_queue_when_flags_cleared on public.inscription_submissions';
    execute $ddl$
      create trigger inscription_submissions_reset_queue_when_flags_cleared
        before update on public.inscription_submissions
        for each row
        execute function public.inscription_submissions_reset_when_flags_cleared();
    $ddl$;
  end if;
end $$;

comment on function public.inscription_submissions_reset_when_flags_cleared() is
  'Si plus aucun champ n''est marqué à corriger alors que le dossier attendait encore le candidat, repasse en pending (backlog admin).';

notify pgrst,
'reload schema';
