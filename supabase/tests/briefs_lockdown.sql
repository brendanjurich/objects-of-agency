-- B05 policy test: anon and authenticated can neither read nor write briefs.
-- Run: supabase db query -f supabase/tests/briefs_lockdown.sql  (or paste into the SQL editor)
select
  not has_table_privilege('anon', 'public.briefs', 'select')            as anon_cannot_select,
  not has_table_privilege('anon', 'public.briefs', 'insert')            as anon_cannot_insert,
  not has_table_privilege('authenticated', 'public.briefs', 'select')   as auth_cannot_select,
  not has_table_privilege('authenticated', 'public.briefs', 'insert')   as auth_cannot_insert,
  (select relrowsecurity from pg_class where oid = 'public.briefs'::regclass) as rls_enabled,
  (select count(*) = 0 from pg_policies where tablename = 'briefs')     as no_policies;
-- Every column must be true.

-- Same lockdown for selections (/saved-items "Email me this list").
select
  not has_table_privilege('anon', 'public.selections', 'select')            as anon_cannot_select,
  not has_table_privilege('anon', 'public.selections', 'insert')            as anon_cannot_insert,
  not has_table_privilege('authenticated', 'public.selections', 'select')   as auth_cannot_select,
  not has_table_privilege('authenticated', 'public.selections', 'insert')   as auth_cannot_insert,
  (select relrowsecurity from pg_class where oid = 'public.selections'::regclass) as rls_enabled,
  (select count(*) = 0 from pg_policies where tablename = 'selections')     as no_policies;
