-- Saved configurations handed from the Saved Items page: [{slug, name, options, labels, qty}].
-- Validated by brief-intake (items.ts); never carries a price (W07).
alter table public.briefs add column items jsonb not null default '[]'::jsonb;
comment on column public.briefs.items is 'Saved configurations from /saved-items: [{slug, name, options, labels, qty}]. No price, ever.';
