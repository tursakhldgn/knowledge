create table if not exists public.mesajlar (
  id uuid primary key default gen_random_uuid(),
  gonderen_id uuid not null references auth.users(id) on delete cascade,
  alici_id uuid not null references auth.users(id) on delete cascade,
  icerik text not null check (char_length(trim(icerik)) between 1 and 2000),
  olusturma_tarihi timestamptz not null default now(),
  constraint mesajlar_kendine_gonderme_yok check (gonderen_id <> alici_id)
);

create index if not exists mesajlar_gonderen_tarih_idx
  on public.mesajlar (gonderen_id, olusturma_tarihi desc);
create index if not exists mesajlar_alici_tarih_idx
  on public.mesajlar (alici_id, olusturma_tarihi desc);

alter table public.mesajlar enable row level security;
revoke all privileges on table public.mesajlar from anon, authenticated;
grant select, insert on table public.mesajlar to authenticated;

drop policy if exists "mesajlari_katilimcilar_gorur" on public.mesajlar;
create policy "mesajlari_katilimcilar_gorur"
on public.mesajlar
for select
to authenticated
using (auth.uid() = gonderen_id or auth.uid() = alici_id);

drop policy if exists "kullanici_kendi_adina_mesaj_gonderir" on public.mesajlar;
create policy "kullanici_kendi_adina_mesaj_gonderir"
on public.mesajlar
for insert
to authenticated
with check (
  auth.uid() = gonderen_id
  and gonderen_id <> alici_id
  and char_length(trim(icerik)) between 1 and 2000
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mesajlar'
  ) then
    alter publication supabase_realtime add table public.mesajlar;
  end if;
end;
$$;
