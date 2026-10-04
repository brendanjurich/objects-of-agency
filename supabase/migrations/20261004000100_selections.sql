-- "Email me this list" on /saved-items. Closed by default, like briefs: only the
-- selection-intake Edge Function (service role) writes. Never holds a price (W07).

create table public.selections (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  created_at  timestamptz not null default now(),
  email       text not null,
  project     text,
  items       jsonb not null,                 -- [{slug, name, options, labels, qty}]
  origin_url  text,
  claimed_by  uuid references auth.users (id) on delete set null  -- reserved: /account claims by email (W09)
);

comment on table public.selections is 'Saved lists emailed from /saved-items. Written only by the selection-intake Edge Function. Deleted after 12 months (see delete_stale_selections).';

alter table public.selections enable row level security;
revoke all on table public.selections from anon, authenticated;
grant all on table public.selections to service_role;

create index selections_created_at_idx on public.selections (created_at desc);
create index selections_email_idx on public.selections (lower(email));

-- Same 12-month retention as briefs.
create or replace function public.delete_stale_selections()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.selections
    where claimed_by is null and created_at < now() - interval '12 months'
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.delete_stale_selections() from public, anon, authenticated;
grant execute on function public.delete_stale_selections() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('delete-stale-selections', '23 3 * * *', 'select public.delete_stale_selections()');
  end if;
end $$;
