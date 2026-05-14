-- Messagerie : les participants et expéditeurs sont des comptes Auth (enseignants, direction, élèves avec compte activé).
-- Une ligne « profiles » n’est plus obligatoire pour être dans une conversation ou envoyer un message.

alter table public.conversation_participants
  drop constraint if exists conversation_participants_profile_id_fkey;

alter table public.conversation_participants
  add constraint conversation_participants_profile_id_fkey
  foreign key (profile_id) references auth.users (id) on delete cascade;

alter table public.conversations
  drop constraint if exists conversations_created_by_fkey;

alter table public.conversations
  add constraint conversations_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.messages
  drop constraint if exists messages_sender_id_fkey;

alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references auth.users (id) on delete set null;
