-- Allow authors to edit their own questions and explanations only.
grant update (ders, konu, baslik, aciklama) on table public.sorular to authenticated;
grant update (icerik) on table public.anlatimlar to authenticated;

drop policy if exists "soru_guncelle_kendi" on public.sorular;
create policy "soru_guncelle_kendi"
on public.sorular for update to authenticated
using (auth.uid() = kullanici_id)
with check (auth.uid() = kullanici_id);

drop policy if exists "anlatim_guncelle_kendi" on public.anlatimlar;
create policy "anlatim_guncelle_kendi"
on public.anlatimlar for update to authenticated
using (auth.uid() = kullanici_id)
with check (auth.uid() = kullanici_id);

-- Only the message recipient may set or change the read timestamp.
alter table public.mesajlar add column if not exists okundu_at timestamptz;
grant update (okundu_at) on table public.mesajlar to authenticated;

drop policy if exists "mesaj_alicisi_okundu_gunceller" on public.mesajlar;
create policy "mesaj_alicisi_okundu_gunceller"
on public.mesajlar for update to authenticated
using (auth.uid() = alici_id)
with check (auth.uid() = alici_id);

-- Keep the matching inbox notification in sync when its message is read.
create or replace function public.mesaj_okundu_bildirimi_guncelle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.okundu_at is null and new.okundu_at is not null then
    update public.bildirimler
    set okundu_at = new.okundu_at
    where mesaj_id = new.id
      and alici_id = new.alici_id
      and okundu_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists mesaj_okundu_bildirimi_guncelle on public.mesajlar;
create trigger mesaj_okundu_bildirimi_guncelle
after update of okundu_at on public.mesajlar
for each row execute function public.mesaj_okundu_bildirimi_guncelle();
