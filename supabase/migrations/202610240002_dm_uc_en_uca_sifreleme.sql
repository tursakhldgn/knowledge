-- Public identity keys can be read by signed-in users, but cannot be changed
-- after registration. Encrypted private-key backups remain owner-only.
create table if not exists public.dm_acik_anahtarlar (
  kullanici_id uuid primary key references auth.users(id) on delete cascade,
  acik_anahtar text not null check (char_length(acik_anahtar) between 80 and 120),
  olusturma_tarihi timestamptz not null default now()
);

alter table public.dm_acik_anahtarlar enable row level security;
revoke all privileges on table public.dm_acik_anahtarlar from public, anon, authenticated;
grant select on table public.dm_acik_anahtarlar to authenticated;

drop policy if exists "dm_acik_anahtarlari_kullanicilar_gorur" on public.dm_acik_anahtarlar;
create policy "dm_acik_anahtarlari_kullanicilar_gorur"
on public.dm_acik_anahtarlar for select to authenticated
using (true);

create table if not exists public.dm_anahtar_yedekleri (
  kullanici_id uuid primary key references auth.users(id) on delete cascade,
  tuz text not null check (char_length(tuz) between 20 and 32),
  iv text not null check (char_length(iv) between 12 and 24),
  sifreli_ozel_anahtar text not null check (char_length(sifreli_ozel_anahtar) between 80 and 4096),
  olusturma_tarihi timestamptz not null default now()
);

alter table public.dm_anahtar_yedekleri enable row level security;
revoke all privileges on table public.dm_anahtar_yedekleri from public, anon, authenticated;
grant select on table public.dm_anahtar_yedekleri to authenticated;

drop policy if exists "dm_anahtar_yedegini_sahibi_gorur" on public.dm_anahtar_yedekleri;
create policy "dm_anahtar_yedegini_sahibi_gorur"
on public.dm_anahtar_yedekleri for select to authenticated
using (auth.uid() = kullanici_id);

-- Register the public key and encrypted backup atomically, once per account.
create or replace function public.dm_anahtar_kur(
  p_acik_anahtar text,
  p_tuz text,
  p_iv text,
  p_sifreli_ozel_anahtar text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(p_acik_anahtar) not between 80 and 120
    or char_length(p_tuz) not between 20 and 32
    or char_length(p_iv) not between 12 and 24
    or char_length(p_sifreli_ozel_anahtar) not between 80 and 4096 then
    raise exception 'Invalid encryption key data';
  end if;

  insert into public.dm_acik_anahtarlar (kullanici_id, acik_anahtar)
  values (auth.uid(), p_acik_anahtar);

  insert into public.dm_anahtar_yedekleri (kullanici_id, tuz, iv, sifreli_ozel_anahtar)
  values (auth.uid(), p_tuz, p_iv, p_sifreli_ozel_anahtar);
end;
$$;

revoke all on function public.dm_anahtar_kur(text, text, text, text) from public, anon;
grant execute on function public.dm_anahtar_kur(text, text, text, text) to authenticated;

-- When a user files a report, they explicitly share that message with moderation.
alter table public.dm_sikayetleri
  add column if not exists mesaj_icerigi text;
alter table public.dm_sikayetleri
  drop constraint if exists dm_sikayet_mesaj_icerigi_uzunluk;
alter table public.dm_sikayetleri
  add constraint dm_sikayet_mesaj_icerigi_uzunluk
  check (mesaj_icerigi is null or char_length(trim(mesaj_icerigi)) <= 2000);

drop policy if exists "dm_sikayetini_gelen_mesaj_icin_ekle" on public.dm_sikayetleri;
create policy "dm_sikayetini_gelen_mesaj_icin_ekle"
on public.dm_sikayetleri for insert to authenticated
with check (
  auth.uid() = sikayet_eden_id
  and sikayet_eden_id <> sikayet_edilen_id
  and public.dm_sikayet_mesaji_kontrol_et(mesaj_id, sikayet_edilen_id)
  and (mesaj_icerigi is null or char_length(trim(mesaj_icerigi)) <= 2000)
);

-- Ciphertext is larger than plaintext; keep a bounded storage limit.
alter table public.mesajlar drop constraint if exists mesajlar_icerik_check;
alter table public.mesajlar
  add constraint mesajlar_icerik_check
  check (char_length(trim(icerik)) between 1 and 30000);

-- Once this migration is active, clients must submit encrypted envelopes.
drop policy if exists "kullanici_kendi_adina_mesaj_gonderir" on public.mesajlar;
create policy "kullanici_kendi_adina_mesaj_gonderir"
on public.mesajlar for insert to authenticated
with check (
  auth.uid() = gonderen_id
  and gonderen_id <> alici_id
  and icerik like 'e2ee:v1:%'
  and char_length(trim(icerik)) between 1 and 30000
  and public.dm_engel_durumu(alici_id) = 'yok'
);

drop policy if exists "dm_mesajlari_mutlaka_sifreli_olmali" on public.mesajlar;
create policy "dm_mesajlari_mutlaka_sifreli_olmali"
on public.mesajlar as restrictive for insert to authenticated
with check (
  icerik like 'e2ee:v1:%'
  and char_length(trim(icerik)) between 1 and 30000
);
