-- Suivi lecture par participant (pastilles « non lu » + approx. « vu par »).
alter table public.conversation_participants
add column if not exists last_read_at timestamptz;

comment on column public.conversation_participants.last_read_at is
'Dernière prise en compte des messages de la conversation pour ce participant ; mis à jour à l''ouverture du fil. Les messages envoyés après cette date sont « non lus » pour ce participant.';

create index if not exists conversation_participants_profile_conv_idx on public.conversation_participants (
  profile_id,
  conversation_id
);
