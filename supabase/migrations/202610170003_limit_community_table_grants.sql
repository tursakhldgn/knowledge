-- Keep the community tables usable through the app while removing unnecessary
-- table privileges such as TRUNCATE, REFERENCES, and TRIGGER from client roles.
revoke all privileges on table
  public.sorular,
  public.anlatimlar,
  public.oylar,
  public.sikayetler
from anon, authenticated;

grant select, insert, delete on table
  public.sorular,
  public.anlatimlar,
  public.oylar
to authenticated;

grant insert on table public.sikayetler to authenticated;
