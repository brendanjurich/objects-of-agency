-- "Automatically expose new tables" is off on this project (B04), so no Data API role —
-- service_role included — receives grants by default. The Edge Function writes as
-- service_role; give it, and only it, the table.
grant all on table public.briefs to service_role;
grant execute on function public.delete_stale_briefs() to service_role;
