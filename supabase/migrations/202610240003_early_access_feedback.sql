-- Limit new accounts to the first 100 total users and provide private feedback storage.
-- Run this in Supabase SQL Editor as one migration.

begin;

-- Stop concurrent auth inserts while initializing the counter and installing its trigger.
lock table auth.users in share row exclusive mode;

create table if not exists public.erken_erisim_sayaci (
  tek_kayit boolean primary key default true check (tek_kayit),
  hesap_sayisi bigint not null check (hesap_sayisi >= 0)
);

insert into public.erken_erisim_sayaci (tek_kayit, hesap_sayisi)
select true, count(*) from auth.users
on conflict (tek_kayit) do update
set hesap_sayisi = excluded.hesap_sayisi;

alter table public.erken_erisim_sayaci enable row level security;
revoke all on table public.erken_erisim_sayaci from public, anon, authenticated;

create or replace function public.erken_erisim_acik_mi()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (select hesap_sayisi < 100
     from public.erken_erisim_sayaci
     where tek_kayit = true),
    false
  );
$$;

revoke all on function public.erken_erisim_acik_mi() from public;
grant execute on function public.erken_erisim_acik_mi() to anon, authenticated;

create or replace function public.erken_erisim_kayit_kontrolu()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  yeni_sayi bigint;
begin
  update public.erken_erisim_sayaci
  set hesap_sayisi = hesap_sayisi + 1
  where tek_kayit = true and hesap_sayisi < 100
  returning hesap_sayisi into yeni_sayi;

  if yeni_sayi is null then
    raise exception 'EARLY_ACCESS_FULL';
  end if;

  return new;
end;
$$;

revoke all on function public.erken_erisim_kayit_kontrolu() from public, anon, authenticated;
drop trigger if exists knowledge_early_access_signup_limit on auth.users;
create trigger knowledge_early_access_signup_limit
before insert on auth.users
for each row execute function public.erken_erisim_kayit_kontrolu();

create table if not exists public.beta_geri_bildirimleri (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  kategori text not null check (kategori in ('oneri', 'hata', 'diger')),
  mesaj text not null check (char_length(btrim(mesaj)) between 10 and 1000),
  olusturulma_zamani timestamptz not null default now()
);

alter table public.beta_geri_bildirimleri enable row level security;
revoke all on table public.beta_geri_bildirimleri from public, anon, authenticated;
grant insert, select on table public.beta_geri_bildirimleri to authenticated;

drop policy if exists beta_geri_bildirim_ekle_kendi on public.beta_geri_bildirimleri;
create policy beta_geri_bildirim_ekle_kendi
on public.beta_geri_bildirimleri
for insert to authenticated
with check (auth.uid() = kullanici_id);

drop policy if exists beta_geri_bildirim_oku_kendi on public.beta_geri_bildirimleri;
create policy beta_geri_bildirim_oku_kendi
on public.beta_geri_bildirimleri
for select to authenticated
using (auth.uid() = kullanici_id);

commit;
