-- Rate limits for brief-intake and selection-intake: ≤10 sends per email per hour and
-- ≤20 per IP per day, per intake (limits passed in from functions/_shared/guard.ts).
-- Rows hold keyed hashes only, never a raw email or IP, and are pruned after a day.

create table public.intake_hits (
  id          bigint generated always as identity primary key,
  intake      text not null,                   -- brief | selection
  email_hash  text,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

comment on table public.intake_hits is 'Send counter for the intake Edge Functions. Hashed email/IP, kept one day. Written only via intake_allow().';

alter table public.intake_hits enable row level security;
revoke all on table public.intake_hits from anon, authenticated;
grant all on table public.intake_hits to service_role;

create index intake_hits_email_idx on public.intake_hits (intake, email_hash, created_at);
create index intake_hits_ip_idx on public.intake_hits (intake, ip_hash, created_at);

-- Check and count in one transaction. The advisory lock serialises sends per intake so two
-- requests can't both read "under" and both pass; volume is tiny, so the wait is nil.
create or replace function public.intake_allow(
  p_intake text, p_email text, p_ip text, p_email_max integer, p_ip_max integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('intake_allow:' || p_intake));
  delete from public.intake_hits where created_at < now() - interval '1 day';
  if p_email is not null and (
    select count(*) from public.intake_hits
    where intake = p_intake and email_hash = p_email and created_at > now() - interval '1 hour'
  ) >= p_email_max then return false; end if;
  if p_ip is not null and (
    select count(*) from public.intake_hits
    where intake = p_intake and ip_hash = p_ip
  ) >= p_ip_max then return false; end if;
  insert into public.intake_hits (intake, email_hash, ip_hash) values (p_intake, p_email, p_ip);
  return true;
end;
$$;
revoke all on function public.intake_allow(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.intake_allow(text, text, text, integer, integer) to service_role;
