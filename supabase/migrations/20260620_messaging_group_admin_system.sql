-- Groupes messagerie : administrateur désigné + messages système (évènements membres/admin).

alter table public.conversations
add column if not exists group_admin_profile_id uuid references auth.users (id) on delete set null;

comment on column public.conversations.group_admin_profile_id is
'Compte désigné comme seul administrateur du groupe messagerie (ajout/retrait/transfert).';

update public.conversations
set group_admin_profile_id = created_by
where is_group is true and group_admin_profile_id is null;

alter table public.messages
add column if not exists kind text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_kind_chk'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages add constraint messages_kind_chk check (
      kind in ('user','system')
    );
  end if;
end $$;

alter table public.messages
add column if not exists system_payload jsonb null;

comment on column public.messages.kind is
'utilisateur ou évènement groupe (voir system_payload).';

comment on column public.messages.system_payload is
'Pour kind=system : type group_member_added|group_member_removed|group_admin_transferred + IDs.';
