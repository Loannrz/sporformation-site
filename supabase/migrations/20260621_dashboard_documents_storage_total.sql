-- Somme des tailles objet du bucket Storage « documents » (metadata.size dans storage.objects).

create or replace function public.dashboard_documents_storage_bytes_total()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    sum(
      case
        when (o.metadata->>'size') is not null
          and trim(o.metadata->>'size') <> ''
          and trim(o.metadata->>'size') ~ '^[0-9]+(\.[0-9]+)?$'
          then greatest(
            0::bigint,
            floor(trim(o.metadata->>'size')::double precision)::bigint
          )
        else 0::bigint
      end
    ),
    0::bigint
  )
  from storage.objects o
  where o.bucket_id = 'documents';
$$;

comment on function public.dashboard_documents_storage_bytes_total() is
  'Total octets fichiers bucket documents (somme metadata.size) pour tableau de bord direction.';

revoke all on function public.dashboard_documents_storage_bytes_total() from public;
grant execute on function public.dashboard_documents_storage_bytes_total() to service_role;
