-- Publish the feed tables so connected clients receive live database changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sorular'
  ) then
    alter publication supabase_realtime add table public.sorular;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'anlatimlar'
  ) then
    alter publication supabase_realtime add table public.anlatimlar;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'oylar'
  ) then
    alter publication supabase_realtime add table public.oylar;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiller'
  ) then
    alter publication supabase_realtime add table public.profiller;
  end if;
end;
$$;
