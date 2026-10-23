"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SiraKullanicisi = {
  kullanici_id: string;
  takma_ad: string | null;
  avatar_url: string | null;
  puan: number;
  anlatim_sayisi: number;
};

export default function Siralama() {
  const router = useRouter();
  const [liste, setListe] = useState<SiraKullanicisi[]>([]);
  const [benimId, setBenimId] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  useEffect(() => {
    let aktif = true;
    let kanal: ReturnType<typeof supabase.channel> | null = null;
    let zamanlayici: ReturnType<typeof setTimeout> | undefined;

    async function siralamayiGetir() {
      const { data: kullanici } = await supabase.auth.getUser();
      if (!aktif) return;
      if (!kullanici.user) {
        router.replace("/giris");
        return;
      }
      setBenimId(kullanici.user.id);

      const [anlatimSonucu, oySonucu, profilSonucu] = await Promise.all([
        supabase.from("anlatimlar").select("id, kullanici_id"),
        supabase.from("oylar").select("anlatim_id"),
        supabase.from("profil_kartlari").select("kullanici_id, takma_ad, avatar_url"),
      ]);

      if (!aktif) return;
      const sorguHatasi = anlatimSonucu.error ?? oySonucu.error ?? profilSonucu.error;
      if (sorguHatasi) {
        setHata("Sıralama yüklenemedi. Biraz sonra tekrar dene.");
        setYukleniyor(false);
        return;
      }

      const anlatimlar = anlatimSonucu.data ?? [];
      const oylar = oySonucu.data ?? [];
      const profiller = profilSonucu.data ?? [];
      const oySayilari: Record<string, number> = {};
      oylar.forEach((oy) => {
        oySayilari[oy.anlatim_id] = (oySayilari[oy.anlatim_id] ?? 0) + 1;
      });

      const kullanicilar: Record<string, SiraKullanicisi> = {};
      anlatimlar.forEach((anlatim) => {
        const kisi = kullanicilar[anlatim.kullanici_id] ?? {
          kullanici_id: anlatim.kullanici_id,
          takma_ad: null,
          avatar_url: null,
          puan: 0,
          anlatim_sayisi: 0,
        };
        kisi.anlatim_sayisi += 1;
        kisi.puan += oySayilari[anlatim.id] ?? 0;
        kullanicilar[anlatim.kullanici_id] = kisi;
      });

      profiller.forEach((profil) => {
        const kisi = kullanicilar[profil.kullanici_id];
        if (kisi) {
          kisi.takma_ad = profil.takma_ad;
          kisi.avatar_url = profil.avatar_url;
        }
      });

      const siraliListe = Object.values(kullanicilar).sort(
        (a, b) => b.puan - a.puan || b.anlatim_sayisi - a.anlatim_sayisi
      );
      setListe(siraliListe);
      setHata("");
      setYukleniyor(false);
    }

    function yenilemeyiPlanla() {
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => void siralamayiGetir(), 150);
    }

    void siralamayiGetir();
    kanal = supabase
      .channel("topluluk-siralamasi")
      .on("postgres_changes", { event: "*", schema: "public", table: "anlatimlar" }, yenilemeyiPlanla)
      .on("postgres_changes", { event: "*", schema: "public", table: "oylar" }, yenilemeyiPlanla)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiller" }, yenilemeyiPlanla)
      .subscribe();

    return () => {
      aktif = false;
      if (zamanlayici) clearTimeout(zamanlayici);
      if (kanal) void supabase.removeChannel(kanal);
    };
  }, [router]);

  const benimSiralamam = liste.findIndex((kisi) => kisi.kullanici_id === benimId);

  return (
    <main data-app-theme="light" className="mx-auto min-h-dvh w-full max-w-5xl px-4 pt-6 pb-28 text-slate-100 sm:px-6 sm:pt-10 xl:px-8">
      <header className="mb-6 rounded-3xl border border-amber-200/10 bg-gradient-to-br from-amber-300/10 via-slate-900 to-slate-900 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Katkıların görünür olsun</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Topluluk sıralaması</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Anlatımlarına gelen her faydalı oy bir puan kazandırır. Sıralama yeni oylarla kendiliğinden güncellenir.</p>
        <p className="mt-4 inline-flex rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-400">Tüm zamanlar</p>
      </header>

      {benimSiralamam >= 10 && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm">
          <span className="text-cyan-100">Senin sıran: <strong>#{benimSiralamam + 1}</strong></span>
          <span className="text-cyan-200">{liste[benimSiralamam].puan} puan</span>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/75 shadow-xl shadow-black/10">
        <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem]">
          <span>Sıra</span><span>Öğrenci</span><span className="text-right sm:text-center">Anlatım</span><span className="text-right">Puan</span>
        </div>

        {yukleniyor ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">Sıralama yükleniyor…</p>
        ) : hata ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-rose-200">{hata}</p>
        ) : liste.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-slate-200">Henüz sıralama oluşmadı</p>
            <p className="mt-2 text-sm text-slate-400">İlk anlatımı paylaş, topluluğa katkıda bulun.</p>
          </div>
        ) : (
          liste.slice(0, 10).map((kisi, index) => (
            <article key={kisi.kullanici_id} className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/5 px-4 py-3.5 last:border-0 sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem] ${kisi.kullanici_id === benimId ? "bg-cyan-300/5" : ""}`}>
              <span className={`text-center text-sm font-bold ${index < 3 ? "text-amber-200" : "text-slate-500"}`}>#{index + 1}</span>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800 text-sm font-semibold text-cyan-100">
                  {kisi.avatar_url ? <img src={kisi.avatar_url} alt="" className="h-full w-full object-cover" /> : (kisi.takma_ad?.[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{kisi.takma_ad ? `@${kisi.takma_ad}` : "İsimsiz öğrenci"}</p>
                  {kisi.kullanici_id === benimId && <p className="text-xs text-cyan-300">Sen</p>}
                </div>
              </div>
              <span className="text-right text-sm text-slate-400 sm:text-center">{kisi.anlatim_sayisi}</span>
              <span className="text-right text-sm font-semibold text-amber-100">{kisi.puan}</span>
            </article>
          ))
        )}
      </section>
      <p className="mt-3 text-xs leading-5 text-slate-500">Puan, anlatımların aldığı toplam oy sayısına göre hesaplanır. Eşit puanda daha çok anlatım paylaşan üstte görünür.</p>
    </main>
  );
}
