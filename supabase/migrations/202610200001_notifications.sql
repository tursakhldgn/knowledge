create table if not exists public.bildirimler (
  id uuid primary key default gen_random_uuid(),
  alici_id uuid not null references auth.users(id) on delete cascade,
  gonderen_id uuid references auth.users(id) on delete set null,
  tur text not null check (tur in ('oy', 'mesaj')),
  anlatim_id uuid references public.anlatimlar(id) on delete cascade,
  mesaj_id uuid references public.mesajlar(id) on delete cascade,
  olusturma_tarihi timestamptz not null default now(),
  okundu_at timestamptz,
  constraint bildirimler_tur_hedef_check check (
    (tur = 'oy' and anlatim_id is not null and mesaj_id is null)
    or (tur = 'mesaj' and mesaj_id is not null and anlatim_id is null)
  )
);

create index if not exists bildirimler_alici_tarih_idx
  on public.bildirimler (alici_id, olusturma_tarihi desc);
create index if not exists bildirimler_alici_okunmamis_idx
  on public.bildirimler (alici_id, okundu_at)
  where okundu_at is null;

alter table public.bildirimler enable row level security;
revoke all privileges on table public.bildirimler from anon, authenticated;
grant select on table public.bildirimler to authenticated;
grant update (okundu_at) on table public.bildirimler to authenticated;

drop policy if exists "bildirimlerini_gor" on public.bildirimler;
create policy "bildirimlerini_gor"
on public.bildirimler for select to authenticated
using (auth.uid() = alici_id);

drop policy if exists "bildirimlerini_okundu_yap" on public.bildirimler;
create policy "bildirimlerini_okundu_yap"
on public.bildirimler for update to authenticated
using (auth.uid() = alici_id)
with check (auth.uid() = alici_id);

create or replace function public.bildirim_olustur()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  yazar_id uuid;
begin
  if tg_table_name = 'oylar' then
    select kullanici_id into yazar_id
    from public.anlatimlar
    where id = new.anlatim_id;

    if yazar_id is not null
      and yazar_id <> new.kullanici_id
      and not exists (
        select 1 from public.bildirimler b
        where b.alici_id = yazar_id
          and b.gonderen_id = new.kullanici_id
          and b.tur = 'oy'
          and b.anlatim_id = new.anlatim_id
          and b.olusturma_tarihi > now() - interval '24 hours'
      ) then
      insert into public.bildirimler (alici_id, gonderen_id, tur, anlatim_id)
      values (yazar_id, new.kullanici_id, 'oy', new.anlatim_id);
    end if;
  elsif tg_table_name = 'mesajlar' then
    insert into public.bildirimler (alici_id, gonderen_id, tur, mesaj_id)
    values (new.alici_id, new.gonderen_id, 'mesaj', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists bildirim_oy_eklendi on public.oylar;
create trigger bildirim_oy_eklendi
after insert on public.oylar
for each row execute function public.bildirim_olustur();

drop trigger if exists bildirim_mesaj_eklendi on public.mesajlar;
create trigger bildirim_mesaj_eklendi
after insert on public.mesajlar
for each row execute function public.bildirim_olustur();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bildirimler'
  ) then
    alter publication supabase_realtime add table public.bildirimler;
  end if;
end;
$$;
