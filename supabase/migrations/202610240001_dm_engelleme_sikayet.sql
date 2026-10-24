create table if not exists public.dm_engellemeleri (
  engelleyen_id uuid not null references auth.users(id) on delete cascade,
  engellenen_id uuid not null references auth.users(id) on delete cascade,
  olusturma_tarihi timestamptz not null default now(),
  constraint dm_engelleme_kendini_engelleme_yok check (engelleyen_id <> engellenen_id),
  primary key (engelleyen_id, engellenen_id)
);

alter table public.dm_engellemeleri enable row level security;
revoke all privileges on table public.dm_engellemeleri from anon, authenticated;
grant select, insert, delete on table public.dm_engellemeleri to authenticated;

drop policy if exists "dm_engellemelerini_kendi_yonetir" on public.dm_engellemeleri;
create policy "dm_engellemelerini_kendi_yonetir"
on public.dm_engellemeleri for all to authenticated
using (auth.uid() = engelleyen_id)
with check (auth.uid() = engelleyen_id and engelleyen_id <> engellenen_id);

create index if not exists dm_engellemeleri_engellenen_idx
  on public.dm_engellemeleri (engellenen_id, engelleyen_id);

create or replace function public.dm_engel_durumu(p_kullanici_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when auth.uid() is null or p_kullanici_id is null or auth.uid() = p_kullanici_id then 'yok'
    when exists (
      select 1
      from public.dm_engellemeleri e
      where e.engelleyen_id = auth.uid()
        and e.engellenen_id = p_kullanici_id
    ) then 'ben_engelledim'
    when exists (
      select 1
      from public.dm_engellemeleri e
      where e.engelleyen_id = p_kullanici_id
        and e.engellenen_id = auth.uid()
    ) then 'beni_engelledi'
    else 'yok'
  end;
$$;

revoke all on function public.dm_engel_durumu(uuid) from public, anon;
grant execute on function public.dm_engel_durumu(uuid) to authenticated;

drop policy if exists "mesajlari_katilimcilar_gorur" on public.mesajlar;
create policy "mesajlari_katilimcilar_gorur"
on public.mesajlar for select to authenticated
using (
  (auth.uid() = gonderen_id or auth.uid() = alici_id)
  and public.dm_engel_durumu(
    case when auth.uid() = gonderen_id then alici_id else gonderen_id end
  ) = 'yok'
);

drop policy if exists "kullanici_kendi_adina_mesaj_gonderir" on public.mesajlar;
create policy "kullanici_kendi_adina_mesaj_gonderir"
on public.mesajlar for insert to authenticated
with check (
  auth.uid() = gonderen_id
  and gonderen_id <> alici_id
  and char_length(trim(icerik)) between 1 and 2000
  and public.dm_engel_durumu(alici_id) = 'yok'
);

drop policy if exists "mesaj_alicisi_okundu_gunceller" on public.mesajlar;
create policy "mesaj_alicisi_okundu_gunceller"
on public.mesajlar for update to authenticated
using (
  auth.uid() = alici_id
  and public.dm_engel_durumu(gonderen_id) = 'yok'
)
with check (
  auth.uid() = alici_id
  and public.dm_engel_durumu(gonderen_id) = 'yok'
);

create table if not exists public.dm_sikayetleri (
  id uuid primary key default gen_random_uuid(),
  sikayet_eden_id uuid not null references auth.users(id) on delete cascade,
  sikayet_edilen_id uuid not null references auth.users(id) on delete cascade,
  mesaj_id uuid not null references public.mesajlar(id) on delete cascade,
  neden text not null check (neden in ('spam', 'taciz', 'tehdit', 'uygunsuz', 'diger')),
  aciklama text check (aciklama is null or char_length(trim(aciklama)) <= 500),
  olusturma_tarihi timestamptz not null default now(),
  constraint dm_sikayet_kendini_sikayet_yok check (sikayet_eden_id <> sikayet_edilen_id),
  constraint dm_sikayet_mesaj_tekrar_yok unique (sikayet_eden_id, mesaj_id)
);

alter table public.dm_sikayetleri enable row level security;
revoke all privileges on table public.dm_sikayetleri from anon, authenticated;
grant select, insert on table public.dm_sikayetleri to authenticated;

drop policy if exists "dm_sikayetini_sahibi_gorur" on public.dm_sikayetleri;
create policy "dm_sikayetini_sahibi_gorur"
on public.dm_sikayetleri for select to authenticated
using (auth.uid() = sikayet_eden_id);

create or replace function public.dm_sikayet_mesaji_kontrol_et(
  p_mesaj_id uuid,
  p_sikayet_edilen_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.mesajlar m
    where m.id = p_mesaj_id
      and m.gonderen_id = p_sikayet_edilen_id
      and m.alici_id = auth.uid()
  );
$$;

revoke all on function public.dm_sikayet_mesaji_kontrol_et(uuid, uuid) from public, anon;
grant execute on function public.dm_sikayet_mesaji_kontrol_et(uuid, uuid) to authenticated;

drop policy if exists "dm_sikayetini_gelen_mesaj_icin_ekle" on public.dm_sikayetleri;
create policy "dm_sikayetini_gelen_mesaj_icin_ekle"
on public.dm_sikayetleri for insert to authenticated
with check (
  auth.uid() = sikayet_eden_id
  and sikayet_eden_id <> sikayet_edilen_id
  and public.dm_sikayet_mesaji_kontrol_et(mesaj_id, sikayet_edilen_id)
);
