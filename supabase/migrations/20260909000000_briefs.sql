-- Project brief intake — wayfinder B05.
-- One table, closed by default. Only the brief-intake Edge Function (service role) writes.

create table public.briefs (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,
  created_at    timestamptz not null default now(),
  audience      text not null check (audience in ('client','home','venue','looking')),
  after         text[]  not null default '{}',   -- seen | bespoke | unsure
  pieces        text[]  not null default '{}',   -- free text, catalogue-assisted
  bespoke       text[]  not null default '{}',
  setting       text[]  not null default '{}',
  quantity      text,                            -- one | few | ten-plus
  timing        text,                            -- none | this-year | six-months | date
  timing_date   date,
  budget_band   text,                            -- around | above | discuss
  materials     text[]  not null default '{}',
  interest      text[]  not null default '{}',   -- looking branch only
  note          text,
  name          text,
  email         text,
  practice      text,
  referrer      text,
  origin_url    text,
  status        text not null default 'new' check (status in ('new','read','replied','converted','closed')),
  claimed_by    uuid references auth.users (id) on delete set null
);

comment on table public.briefs is 'Project brief submissions from /contact. Written only by the brief-intake Edge Function. Unconverted rows are deleted after 12 months (see delete_stale_briefs).';

-- S1 / S2: nothing for the API roles. RLS on, no policies: only service_role (bypasses RLS) can touch the table.
alter table public.briefs enable row level security;
revoke all on table public.briefs from anon, authenticated;

create index briefs_created_at_idx on public.briefs (created_at desc);
create index briefs_email_idx on public.briefs (lower(email));

-- B03: 12-month retention for briefs that never became a commission.
create or replace function public.delete_stale_briefs()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.briefs
    where status in ('new','read','replied','closed')
      and created_at < now() - interval '12 months'
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.delete_stale_briefs() from public, anon, authenticated;

-- Schedule nightly if pg_cron is available on the plan; harmless no-op otherwise.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('delete-stale-briefs', '17 3 * * *', 'select public.delete_stale_briefs()');
  end if;
end $$;
