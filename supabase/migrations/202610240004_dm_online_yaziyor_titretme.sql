-- Presence and typing are ephemeral Realtime events. Nudges require both users
-- to opt in and are rate-limited in the database.

create table if not exists public.dm_titretme_izinleri (
  kullanici_id uuid primary key references auth.users(id) on delete cascade,
  etkin boolean not null default false,
  guncelleme_zamani timestamptz not null default now()
);

alter table public.dm_titretme_izinleri enable row level security;
revoke all privileges on table public.dm_titretme_izinleri from public, anon, authenticated;
grant select, insert, update on table public.dm_titretme_izinleri to authenticated;

drop policy if exists dm_titretme_iznini_kendi_gor on public.dm_titretme_izinleri;
create policy dm_titretme_iznini_kendi_gor
on public.dm_titretme_izinleri for select to authenticated
using (auth.uid() = kullanici_id);

drop policy if exists dm_titretme_iznini_kendi_ekle on public.dm_titretme_izinleri;
create policy dm_titretme_iznini_kendi_ekle
on public.dm_titretme_izinleri for insert to authenticated
with check (auth.uid() = kullanici_id);

drop policy if exists dm_titretme_iznini_kendi_guncelle on public.dm_titretme_izinleri;
create policy dm_titretme_iznini_kendi_guncelle
on public.dm_titretme_izinleri for update to authenticated
using (auth.uid() = kullanici_id)
with check (auth.uid() = kullanici_id);

create table if not exists public.dm_titretmeler (
  id uuid primary key default gen_random_uuid(),
  gonderen_id uuid not null references auth.users(id) on delete cascade,
  alici_id uuid not null references auth.users(id) on delete cascade,
  olusturma_zamani timestamptz not null default now(),
  constraint dm_titretme_kendine_yok check (gonderen_id <> alici_id)
);

create index if not exists dm_titretmeler_gonderim_sikligi_idx
  on public.dm_titretmeler (gonderen_id, alici_id, olusturma_zamani desc);
create index if not exists dm_titretmeler_alici_sikligi_idx
  on public.dm_titretmeler (alici_id, olusturma_zamani desc);

alter table public.dm_titretmeler enable row level security;
revoke all privileges on table public.dm_titretmeler from public, anon, authenticated;
grant select on table public.dm_titretmeler to authenticated;

drop policy if exists dm_titretmeleri_katilimcilar_gorur on public.dm_titretmeler;
create policy dm_titretmeleri_katilimcilar_gorur
on public.dm_titretmeler for select to authenticated
using (auth.uid() = gonderen_id or auth.uid() = alici_id);

create or replace function public.dm_titretme_gonder(p_alici_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  gonderen uuid := auth.uid();
  yeni_id uuid;
begin
  if gonderen is null then
    raise exception 'DM_TITRETME_GIRIS_GEREKLI';
  end if;
  if p_alici_id is null or p_alici_id = gonderen then
    raise exception 'DM_TITRETME_ALICI_GECERSIZ';
  end if;

  -- Serialize simultaneous sends between the same pair before checking cooldown.
  perform 1
  from public.dm_titretme_izinleri
  where kullanici_id in (gonderen, p_alici_id)
  order by kullanici_id
  for update;

  if not exists (
    select 1
    from public.dm_titretme_izinleri a
    join public.dm_titretme_izinleri b on b.kullanici_id = p_alici_id
    where a.kullanici_id = gonderen
      and a.etkin = true
      and b.etkin = true
  ) then
    raise exception 'DM_TITRETME_IKI_TARAF_ONAYI_GEREKLI';
  end if;

  if exists (
    select 1 from public.dm_engellemeleri e
    where (e.engelleyen_id = gonderen and e.engellenen_id = p_alici_id)
       or (e.engelleyen_id = p_alici_id and e.engellenen_id = gonderen)
  ) then
    raise exception 'DM_TITRETME_ENGEL_VAR';
  end if;

  if not exists (
    select 1 from public.mesajlar m
    where (m.gonderen_id = gonderen and m.alici_id = p_alici_id)
       or (m.gonderen_id = p_alici_id and m.alici_id = gonderen)
  ) then
    raise exception 'DM_TITRETME_ONCE_SOHBET_GEREKLI';
  end if;

  if exists (
    select 1 from public.dm_titretmeler t
    where t.gonderen_id = gonderen
      and t.alici_id = p_alici_id
      and t.olusturma_zamani > now() - interval '30 seconds'
  ) then
    raise exception 'DM_TITRETME_COK_SIK';
  end if;

  if (
    select count(*) from public.dm_titretmeler t
    where t.alici_id = p_alici_id
      and t.olusturma_zamani > now() - interval '1 minute'
  ) >= 3 then
    raise exception 'DM_TITRETME_ALICI_LIMITI';
  end if;

  insert into public.dm_titretmeler (gonderen_id, alici_id)
  values (gonderen, p_alici_id)
  returning id into yeni_id;

  return yeni_id;
end;
$$;

revoke all on function public.dm_titretme_gonder(uuid) from public, anon;
grant execute on function public.dm_titretme_gonder(uuid) to authenticated;

-- Typing indicators are visible only in the signed-in user's own topic.
drop policy if exists knowledge_dm_presence_oku on realtime.messages;
create policy knowledge_dm_presence_oku
on realtime.messages for select to authenticated
using (
  extension = 'presence'
  and realtime.topic() = 'knowledge:dm:presence'
);

drop policy if exists knowledge_dm_presence_yaz on realtime.messages;
create policy knowledge_dm_presence_yaz
on realtime.messages for insert to authenticated
with check (
  extension = 'presence'
  and realtime.topic() = 'knowledge:dm:presence'
);

drop policy if exists knowledge_dm_typing_kendi_konusmasinda_oku on realtime.messages;
create policy knowledge_dm_typing_kendi_konusmasinda_oku
on realtime.messages for select to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() = 'knowledge:dm:typing:' || auth.uid()::text
);

drop policy if exists knowledge_dm_typing_sohbet_katilimcisi_yazar on realtime.messages;
create policy knowledge_dm_typing_sohbet_katilimcisi_yazar
on realtime.messages for insert to authenticated
with check (
  extension = 'broadcast'
  and exists (
    select 1 from public.mesajlar m
    where (
      (m.gonderen_id = auth.uid() and realtime.topic() = 'knowledge:dm:typing:' || m.alici_id::text)
      or (m.alici_id = auth.uid() and realtime.topic() = 'knowledge:dm:typing:' || m.gonderen_id::text)
    )
    and public.dm_engel_durumu(
      case when m.gonderen_id = auth.uid() then m.alici_id else m.gonderen_id end
    ) = 'yok'
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dm_titretmeler'
  ) then
    alter publication supabase_realtime add table public.dm_titretmeler;
  end if;
end;
$$;
