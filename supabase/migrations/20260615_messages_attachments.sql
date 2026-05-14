-- Pièces jointes messagerie (max 10 Mo côté bucket ; vérif également côté app).
alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_filename text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_size_bytes bigint;

comment on column public.messages.attachment_path is 'Chemin objet dans le bucket Storage message_attachments (conv_id/message_id/nom)';
comment on column public.messages.attachment_filename is 'Nom d’affichage / téléchargement';
comment on column public.messages.attachment_mime is 'Type MIME signalé à l’upload';
comment on column public.messages.attachment_size_bytes is 'Taille en octets';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message_attachments', 'message_attachments', false, 10485760, null)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  public = excluded.public;

-- Accès via service role uniquement depuis le serveur (API téléchargement signé).
