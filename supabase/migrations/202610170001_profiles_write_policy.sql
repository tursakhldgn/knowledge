-- Allow signed-in users to insert and update only their own profile row.
alter table public.profiller enable row level security;

grant select, insert, update on table public.profiller to authenticated;

drop policy if exists "knowledge_profiles_insert_own" on public.profiller;
create policy "knowledge_profiles_insert_own"
on public.profiller
for insert
to authenticated
with check (auth.uid() = kullanici_id);

drop policy if exists "knowledge_profiles_update_own" on public.profiller;
create policy "knowledge_profiles_update_own"
on public.profiller
for update
to authenticated
using (auth.uid() = kullanici_id)
with check (auth.uid() = kullanici_id);
