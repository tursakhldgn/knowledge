"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Bildirim = {
  id: string;
  gonderen_id: string | null;
  tur: "oy" | "mesaj";
  olusturma_tarihi: string;
  okundu_at: string | null;
};

type ProfilKarti = { kullanici_id: string; takma_ad: string | null; avatar_url: string | null };

export default function Bildirimler() {
  const router = useRouter();
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [profiller, setProfiller] = useState<Record<string, ProfilKarti>>({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const getir = useCallback(async () => {
    const { data: oturum } = await supabase.auth.getUser();
    if (!oturum.user) {
      router.replace("/giris");
      return;
    }
    const { data, error } = await supabase
      .from("bildirimler")
      .select("id, gonderen_id, tur, olusturma_tarihi, okundu_at")
      .order("olusturma_tarihi", { ascending: false })
      .limit(100);
    if (error) {
      setHata("Bildirimler yüklenemedi. Veritabanı kurulumunu kontrol edip tekrar dene.");
      setYukleniyor(false);
      return;
    }
    const liste = (data ?? []) as Bildirim[];
    setBildirimler(liste);
    const gonderenler = [...new Set(liste.map((item) => item.gonderen_id).filter((id): id is string => !!id))];
    if (gonderenler.length) {
      const { data: kartlar } = await supabase
        .from("profil_kartlari")
        .select("kullanici_id, takma_ad, avatar_url")
        .in("kullanici_id", gonderenler);
      const harita: Record<string, ProfilKarti> = {};
      (kartlar ?? []).forEach((kart) => { harita[kart.kullanici_id] = kart; });
      setProfiller(harita);
    }
    setHata("");
    setYukleniyor(false);
  }, [router]);

  useEffect(() => {
    let etkin = true;
    let kanal: ReturnType<typeof supabase.channel> | null = null;
    async function basla() {
      const { data } = await supabase.auth.getUser();
      if (!etkin) return;
      if (!data.user) {
        router.replace("/giris");
        return;
      }
      await getir();
      if (!etkin) return;
      kanal = supabase
        .channel(`bildirimler-${data.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "bildirimler", filter: `alici_id=eq.${data.user.id}` }, () => { void getir(); })
        .subscribe();
    }
    void basla();
    return () => {
      etkin = false;
      if (kanal) void supabase.removeChannel(kanal);
    };
  }, [getir, router]);

  async function okunduYap(id: string) {
    const zaman = new Date().toISOString();
    setBildirimler((onceki) => onceki.map((item) => item.id === id ? { ...item, okundu_at: zaman } : item));
    const { error } = await supabase.from("bildirimler").update({ okundu_at: zaman }).eq("id", id);
    if (error) {
      setHata("Bildirim okundu olarak işaretlenemedi.");
      void getir();
    }
  }

  async function tumunuOkunduYap() {
    const okunmamislar = bildirimler.filter((item) => !item.okundu_at);
    if (!okunmamislar.length) return;
    const zaman = new Date().toISOString();
    const ids = okunmamislar.map((item) => item.id);
    setBildirimler((onceki) => onceki.map((item) => ids.includes(item.id) ? { ...item, okundu_at: zaman } : item));
    const { error } = await supabase.from("bildirimler").update({ okundu_at: zaman }).in("id", ids);
    if (error) {
      setHata("Bildirimler okundu olarak işaretlenemedi.");
      void getir();
    }
  }

  const okunmamisSayisi = bildirimler.filter((item) => !item.okundu_at).length;

  return (
    <main className="mx-auto min-h-[calc(100dvh-64px)] w-full max-w-5xl px-4 pt-6 pb-28 text-slate-100 sm:px-6 sm:pt-10 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Haber akışı</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Bildirimler</h1>
          <p className="mt-2 text-sm text-slate-400">Yeni mesajlarını ve anlatımlarına gelen oyları burada görürsün.</p>
        </div>
        <button type="button" onClick={() => void tumunuOkunduYap()} disabled={!okunmamisSayisi} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Tümünü okundu yap</button>
      </div>

      {hata && <p role="alert" className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{hata}</p>}
      <section aria-label="Bildirim listesi" className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
        {yukleniyor ? <p className="p-6 text-sm text-slate-400">Bildirimler yükleniyor…</p> : bildirimler.length ? bildirimler.map((item) => {
          const profil = item.gonderen_id ? profiller[item.gonderen_id] : undefined;
          const href = item.tur === "mesaj" ? "/mesajlar" : "/sorular";
          return (
            <Link key={item.id} href={href} onClick={() => { if (!item.okundu_at) void okunduYap(item.id); }} className={`flex items-center gap-4 border-b border-white/5 p-4 transition last:border-b-0 hover:bg-white/5 sm:p-5 ${item.okundu_at ? "" : "bg-cyan-300/[0.06]"}`}>
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800 text-lg text-cyan-100">
                {profil?.avatar_url ? <img src={profil.avatar_url} alt="" className="h-full w-full object-cover" /> : profil?.takma_ad?.[0]?.toLocaleUpperCase("tr-TR") ?? "?"}
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-cyan-300 text-[10px] text-slate-950">{item.tur === "mesaj" ? "✉" : "↑"}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-6 text-slate-200"><strong className="font-semibold text-white">{profil?.takma_ad ? `@${profil.takma_ad}` : "Bir kullanıcı"}</strong>{item.tur === "mesaj" ? " sana özel mesaj gönderdi." : " anlatımına faydalı oy verdi."}</span>
                <time className="mt-1 block text-xs text-slate-500" dateTime={item.olusturma_tarihi}>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.olusturma_tarihi))}</time>
              </span>
              {!item.okundu_at && <span aria-label="Okunmadı" className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300" />}
            </Link>
          );
        }) : <div className="px-6 py-16 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10 text-2xl text-cyan-200" aria-hidden="true">♧</span><h2 className="mt-4 font-semibold">Şimdilik bildirim yok</h2><p className="mt-2 text-sm text-slate-500">Yeni bir mesaj aldığında veya anlatımına oy geldiğinde burada göreceksin.</p></div>}
      </section>
    </main>
  );
}
