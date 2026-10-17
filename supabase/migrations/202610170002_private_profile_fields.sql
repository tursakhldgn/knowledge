-- Keep profile rows private while exposing only author-card fields publicly.
drop policy if exists "profil_oku" on public.profiller;
create policy "profil_oku"
on public.profiller
for select
to authenticated
using (auth.uid() = kullanici_id);

-- The view intentionally uses its postgres owner to bypass the table's
-- owner-only SELECT policy, while exposing only non-sensitive card fields.
create or replace view public.profil_kartlari as
select kullanici_id, takma_ad, avatar_url
from public.profiller;

alter view public.profil_kartlari owner to postgres;
revoke all on table public.profil_kartlari from public, anon, authenticated;
grant select on table public.profil_kartlari to authenticated;
