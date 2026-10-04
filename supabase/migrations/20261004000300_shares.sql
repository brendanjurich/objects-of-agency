-- Short share links for /saved-items (?l=<id>). A pasted ?s= link runs to ~600 characters
-- and mail clients cut it, so the list is stored here and the link carries only the id.
-- Closed like selections: only the share-list and selection-intake Edge Functions (service
-- role) read or write. No email, no IP, never a price (W07) — a ticked price rides in the
-- link's #fragment, which never reaches a server.

create table public.shares (
  id          text primary key,                -- "smith-residence-k3f9x2", or 10 random chars
  hash        text not null unique,            -- SHA-256 of project + items: sharing the same list again reuses its id
  created_at  timestamptz not null default now(),
  touched_at  timestamptz not null default now(),  -- last shared; retention counts from here
  project     text,
  items       jsonb not null                   -- [{slug, name, options, labels, qty}]
);

comment on table public.shares is 'Short share links for /saved-items. Written only by the share-list and selection-intake Edge Functions. Deleted 12 months after last shared (see delete_stale_shares).';

alter table public.shares enable row level security;
revoke all on table public.shares from anon, authenticated;
grant all on table public.shares to service_role;

create index shares_touched_at_idx on public.shares (touched_at);

-- Same 12-month retention as selections, counted from the last share.
create or replace function public.delete_stale_shares()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.shares
    where touched_at < now() - interval '12 months'
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.delete_stale_shares() from public, anon, authenticated;
grant execute on function public.delete_stale_shares() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('delete-stale-shares', '29 3 * * *', 'select public.delete_stale_shares()');
  end if;
end $$;
