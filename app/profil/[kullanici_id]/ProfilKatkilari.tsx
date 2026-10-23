"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profil = { kullanici_id: string; takma_ad: string | null; avatar_url: string | null };
type Soru = { id: string; ders: string; konu: string; baslik: string; aciklama: string | null; olusturma_tarihi: string };
type Anlatim = { id: string; soru_id: string; icerik: string; olusturma_tarihi: string };

export default function ProfilKatkilari({ kullaniciId }: { kullaniciId: string }) {
  const router = useRouter();
  const [benimId, setBenimId] = useState("");
  const [profil, setProfil] = useState<Profil | null>(null);
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [anlatimlar, setAnlatimlar] = useState<Anlatim[]>([]);
  const [soruToplami, setSoruToplami] = useState(0);
  const [anlatimToplami, setAnlatimToplami] = useState(0);
  const [oySayisi, setOySayisi] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  useEffect(() => {
    let aktif = true;
    async function getir() {
      const { data: oturum } = await supabase.auth.getUser();
      if (!oturum.user) {
        router.replace("/giris");
        return;
      }
      setBenimId(oturum.user.id);
      const [profilSonucu, soruSonucu, anlatimSonucu, anlatimIdleriSonucu] = await Promise.all([
        supabase.from("profil_kartlari").select("kullanici_id, takma_ad, avatar_url").eq("kullanici_id", kullaniciId).maybeSingle(),
        supabase.from("sorular").select("id, ders, konu, baslik, aciklama, olusturma_tarihi", { count: "exact" }).eq("kullanici_id", kullaniciId).order("olusturma_tarihi", { ascending: false }).limit(100),
        supabase.from("anlatimlar").select("id, soru_id, icerik, olusturma_tarihi", { count: "exact" }).eq("kullanici_id", kullaniciId).order("olusturma_tarihi", { ascending: false }).limit(100),
        supabase.from("anlatimlar").select("id").eq("kullanici_id", kullaniciId).limit(1000),
      ]);
      if (!aktif) return;
      if (profilSonucu.error || soruSonucu.error || anlatimSonucu.error || anlatimIdleriSonucu.error) {
        setHata("Profil katkıları yüklenemedi. Biraz sonra tekrar dene.");
        setYukleniyor(false);
        return;
      }
      if (!profilSonucu.data) {
        setHata("Bu kullanıcı profili bulunamadı.");
        setYukleniyor(false);
        return;
      }
      const anlatimIdleri = anlatimIdleriSonucu.data?.map(({ id }) => id) ?? [];
      const oySonucu = anlatimIdleri.length
        ? await supabase.from("oylar").select("anlatim_id", { count: "exact", head: true }).in("anlatim_id", anlatimIdleri)
        : { count: 0, error: null };
      if (oySonucu.error) {
        setHata("Profil katkıları yüklenemedi. Biraz sonra tekrar dene.");
        setYukleniyor(false);
        return;
      }
      const kisiSorulari = (soruSonucu.data ?? []) as Soru[];
      const kisiAnlatimlari = (anlatimSonucu.data ?? []) as Anlatim[];
      setProfil(profilSonucu.data as Profil);
      setSorular(kisiSorulari);
      setAnlatimlar(kisiAnlatimlari);
      setSoruToplami(soruSonucu.count ?? 0);
      setAnlatimToplami(anlatimSonucu.count ?? 0);
      setOySayisi(oySonucu.count ?? 0);
      setYukleniyor(false);
    }
    void getir();
    return () => { aktif = false; };
  }, [kullaniciId, router]);

  const tarihYaz = (tarih: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(tarih));

  return (
    <main data-app-theme="light" className="mx-auto min-h-dvh w-full max-w-6xl px-4 pt-6 pb-28 text-slate-100 sm:px-6 sm:pt-10 xl:px-8">
      {yukleniyor ? <p className="py-16 text-center text-slate-400">Profil yükleniyor…</p> : hata ? <p role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-5 text-rose-200">{hata}</p> : profil && (
        <>
          <header className="flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-center sm:gap-8 sm:pb-8">
            <span className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-3xl font-semibold text-cyan-800 sm:h-36 sm:w-36">
              {profil.avatar_url ? <img src={profil.avatar_url} alt="" className="h-full w-full object-cover" /> : profil.takma_ad?.[0]?.toLocaleUpperCase("tr-TR") ?? "?"}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-3xl font-bold tracking-tight text-slate-900">@{profil.takma_ad ?? "isimsiz"}</h1>
              <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-700" aria-label="Katkı istatistikleri">
                <span><strong className="font-bold text-slate-900">{soruToplami}</strong> soru</span>
                <span><strong className="font-bold text-slate-900">{anlatimToplami}</strong> anlatım</span>
                <span><strong className="font-bold text-slate-900">{oySayisi}</strong> faydalı oy</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">Topluluğa yaptığı paylaşımlar</p>
            </div>
            {benimId !== profil.kullanici_id && <Link href={`/mesajlar?kullanici=${profil.kullanici_id}`} className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 sm:ml-auto">Mesaj gönder</Link>}
          </header>

          <div className="mt-5 grid gap-8 xl:grid-cols-2">
            <section className="min-w-0">
              <h2 className="mb-2 border-b border-slate-200 pb-3 text-xl font-semibold text-slate-900">Soruları</h2>
              <div className="divide-y divide-slate-200">
                {sorular.length ? sorular.map((soru) => (
                  <Link key={soru.id} href={`/sorular?soru=${soru.id}#soru-${soru.id}`} className="block py-5 transition hover:bg-cyan-50/70">
                    <p className="text-xs text-cyan-200">{soru.ders} · {soru.konu} · {tarihYaz(soru.olusturma_tarihi)}</p>
                    <h3 className="mt-2 break-words font-semibold">{soru.baslik}</h3>
                    {soru.aciklama && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{soru.aciklama}</p>}
                  </Link>
                )) : <p className="py-6 text-sm text-slate-500">Henüz soru paylaşmamış.</p>}
              </div>
            </section>

            <section className="min-w-0">
              <h2 className="mb-2 border-b border-slate-200 pb-3 text-xl font-semibold text-slate-900">Anlatımları</h2>
              <div className="divide-y divide-slate-200">
                {anlatimlar.length ? anlatimlar.map((anlatim) => (
                  <Link key={anlatim.id} href={`/sorular?anlatim=${anlatim.id}#anlatim-${anlatim.id}`} className="block py-5 transition hover:bg-cyan-50/70">
                    <p className="text-xs text-slate-500">{tarihYaz(anlatim.olusturma_tarihi)}</p>
                    <p className="mt-2 line-clamp-5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{anlatim.icerik}</p>
                  </Link>
                )) : <p className="py-6 text-sm text-slate-500">Henüz anlatım paylaşmamış.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
