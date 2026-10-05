-- The Saved Items list's project name, carried into a brief started from /saved-items.
alter table public.briefs add column project text;
comment on column public.briefs.project is 'Project name from the Saved Items list, when the brief started there.';
