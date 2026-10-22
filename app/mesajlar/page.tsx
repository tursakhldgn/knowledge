"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Kisi = {
  kullanici_id: string;
  takma_ad: string;
  avatar_url: string | null;
};

type Mesaj = {
  id: string;
  gonderen_id: string;
  alici_id: string;
  icerik: string;
  olusturma_tarihi: string;
  okundu_at: string | null;
};

export default function Mesajlar() {
  const router = useRouter();
  const [benimId, setBenimId] = useState("");
  const [kisiler, setKisiler] = useState<Kisi[]>([]);
  const [tumMesajlar, setTumMesajlar] = useState<Mesaj[]>([]);
  const [aktifMesajlar, setAktifMesajlar] = useState<Mesaj[]>([]);
  const [secilenId, setSecilenId] = useState("");
  const [arama, setArama] = useState("");
  const [taslak, setTaslak] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState("");
  const mesajSonu = useRef<HTMLDivElement>(null);
  const aktifSohbetRef = useRef("");
  const urlSohbetiAcildi = useRef(false);

  const secilenKisi = kisiler.find((kisi) => kisi.kullanici_id === secilenId);

  const okunmayanlariIsaretle = useCallback(async (gonderenId: string, aliciId: string) => {
    if (!gonderenId || !aliciId || gonderenId === aliciId) return;
    const { error } = await supabase
      .from("mesajlar")
      .update({ okundu_at: new Date().toISOString() })
      .eq("gonderen_id", gonderenId)
      .eq("alici_id", aliciId)
      .is("okundu_at", null);
    if (error) setHata("Mesajların okundu bilgisi güncellenemedi.");
  }, []);

  const sonSohbetler = useMemo(() => {
    const sonlar = new Map<string, Mesaj>();
    [...tumMesajlar]
      .sort((a, b) => Date.parse(b.olusturma_tarihi) - Date.parse(a.olusturma_tarihi))
      .forEach((mesaj) => {
        const digerId = mesaj.gonderen_id === benimId ? mesaj.alici_id : mesaj.gonderen_id;
        if (!sonlar.has(digerId)) sonlar.set(digerId, mesaj);
      });
    return [...sonlar.entries()]
      .map(([kullaniciId, mesaj]) => ({ kisi: kisiler.find((k) => k.kullanici_id === kullaniciId), mesaj }))
      .filter((sohbet): sohbet is { kisi: Kisi; mesaj: Mesaj } => !!sohbet.kisi)
      .sort((a, b) => Date.parse(b.mesaj.olusturma_tarihi) - Date.parse(a.mesaj.olusturma_tarihi));
  }, [tumMesajlar, kisiler, benimId]);

  const aramaSonuclari = useMemo(() => {
    const sorgu = arama.trim().replace(/^@/, "").toLocaleLowerCase("tr-TR");
    if (!sorgu) return [];
    return kisiler.filter((kisi) => kisi.takma_ad.toLocaleLowerCase("tr-TR").includes(sorgu)).slice(0, 8);
  }, [arama, kisiler]);

  useEffect(() => {
    let aktif = true;
    let kanal: ReturnType<typeof supabase.channel> | null = null;
    let yenileme: ReturnType<typeof setTimeout> | undefined;
    let kullaniciId = "";

    async function sohbetleriGetir(uid: string) {
      const [kisilerSonucu, mesajlarSonucu] = await Promise.all([
        supabase
          .from("profil_kartlari")
          .select("kullanici_id, takma_ad, avatar_url")
          .not("takma_ad", "is", null)
          .neq("kullanici_id", uid)
          .order("takma_ad")
          .limit(1000),
        supabase
          .from("mesajlar")
          .select("id, gonderen_id, alici_id, icerik, olusturma_tarihi, okundu_at")
          .or(`gonderen_id.eq.${uid},alici_id.eq.${uid}`)
          .order("olusturma_tarihi", { ascending: false })
          .limit(500),
      ]);
      if (!aktif) return;
      if (kisilerSonucu.error || mesajlarSonucu.error) {
        setHata("Mesajlar yüklenemedi. Veritabanı ayarlarını kontrol edip tekrar dene.");
        setYukleniyor(false);
        return;
      }

      setKisiler((kisilerSonucu.data ?? []).filter((kisi): kisi is Kisi => !!kisi.takma_ad));
      setTumMesajlar(mesajlarSonucu.data ?? []);
      setHata("");
      setYukleniyor(false);
    }

    async function sohbetMesajlariniGetir(uid: string, digerId: string) {
      const { data, error: mesajHatasi } = await supabase
        .from("mesajlar")
        .select("id, gonderen_id, alici_id, icerik, olusturma_tarihi, okundu_at")
        .or(`and(gonderen_id.eq.${uid},alici_id.eq.${digerId}),and(gonderen_id.eq.${digerId},alici_id.eq.${uid})`)
        .order("olusturma_tarihi", { ascending: true })
        .limit(200);
      if (!aktif || aktifSohbetRef.current !== digerId) return;
      if (mesajHatasi) {
        setHata("Bu sohbet yüklenemedi. Tekrar dene.");
        return;
      }
      setAktifMesajlar(data ?? []);
      void okunmayanlariIsaretle(digerId, uid);
    }

    async function basla() {
      const { data } = await supabase.auth.getUser();
      if (!aktif) return;
      if (!data.user) {
        router.replace("/giris");
        return;
      }
      kullaniciId = data.user.id;
      setBenimId(kullaniciId);
      await sohbetleriGetir(kullaniciId);

      kanal = supabase
        .channel("kullanici-dm-mesajlari")
        .on("postgres_changes", { event: "*", schema: "public", table: "mesajlar" }, () => {
          if (yenileme) clearTimeout(yenileme);
          yenileme = setTimeout(() => {
            void sohbetleriGetir(kullaniciId);
            if (aktifSohbetRef.current) void sohbetMesajlariniGetir(kullaniciId, aktifSohbetRef.current);
          }, 150);
        })
        .subscribe();
    }

    void basla();
    return () => {
      aktif = false;
      if (yenileme) clearTimeout(yenileme);
      if (kanal) void supabase.removeChannel(kanal);
    };
  }, [router, okunmayanlariIsaretle]);

  useEffect(() => {
    mesajSonu.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aktifMesajlar]);

  const sohbetAc = useCallback(async (kisi: Kisi) => {
    setSecilenId(kisi.kullanici_id);
    aktifSohbetRef.current = kisi.kullanici_id;
    setArama("");
    setHata("");
    setAktifMesajlar([]);
    const { data, error: mesajHatasi } = await supabase
      .from("mesajlar")
      .select("id, gonderen_id, alici_id, icerik, olusturma_tarihi, okundu_at")
      .or(`and(gonderen_id.eq.${benimId},alici_id.eq.${kisi.kullanici_id}),and(gonderen_id.eq.${kisi.kullanici_id},alici_id.eq.${benimId})`)
      .order("olusturma_tarihi", { ascending: true })
      .limit(200);
    if (aktifSohbetRef.current !== kisi.kullanici_id) return;
    if (mesajHatasi) setHata("Sohbet açılamadı. Mesajlar tablosu ayarını kontrol et.");
    else {
      setAktifMesajlar(data ?? []);
      void okunmayanlariIsaretle(kisi.kullanici_id, benimId);
    }
  }, [benimId, okunmayanlariIsaretle]);

  useEffect(() => {
    if (!benimId || !kisiler.length || urlSohbetiAcildi.current) return;
    const hedefId = new URLSearchParams(window.location.search).get("kullanici");
    if (!hedefId) {
      urlSohbetiAcildi.current = true;
      return;
    }
    const kisi = kisiler.find((item) => item.kullanici_id === hedefId);
    if (!kisi) return;
    urlSohbetiAcildi.current = true;
    const zamanlayici = window.setTimeout(() => void sohbetAc(kisi), 0);
    return () => window.clearTimeout(zamanlayici);
  }, [benimId, kisiler, sohbetAc]);

  async function mesajGonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!secilenKisi || !taslak.trim() || gonderiliyor) return;
    setGonderiliyor(true);
    setHata("");
    const icerik = taslak.trim();
    const { error: gondermeHatasi } = await supabase.from("mesajlar").insert({
      gonderen_id: benimId,
      alici_id: secilenKisi.kullanici_id,
      icerik,
    });
    setGonderiliyor(false);
    if (gondermeHatasi) {
      setHata("Mesaj gönderilemedi. Biraz sonra tekrar dene.");
      return;
    }
    setTaslak("");
    // Realtime is enabled through the migration; refresh immediately for the sender too.
    const { data } = await supabase
      .from("mesajlar")
      .select("id, gonderen_id, alici_id, icerik, olusturma_tarihi, okundu_at")
      .or(`and(gonderen_id.eq.${benimId},alici_id.eq.${secilenKisi.kullanici_id}),and(gonderen_id.eq.${secilenKisi.kullanici_id},alici_id.eq.${benimId})`)
      .order("olusturma_tarihi", { ascending: true })
      .limit(200);
    setAktifMesajlar(data ?? []);
    setTumMesajlar((eski) => [
      {
        id: crypto.randomUUID(),
        gonderen_id: benimId,
        alici_id: secilenKisi.kullanici_id,
        icerik,
        olusturma_tarihi: new Date().toISOString(),
        okundu_at: null,
      },
      ...eski,
    ]);
  }

  const zamanYaz = (tarih: string) =>
    new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(tarih));

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-screen-2xl flex-col px-3 pt-4 pb-28 text-slate-100 sm:px-6 sm:pt-7 xl:px-8">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Özel sohbetler</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Mesajların</h1>
      </header>

      <section className="grid min-h-[65dvh] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/75 shadow-2xl shadow-black/20 sm:rounded-3xl lg:h-[calc(100dvh-15rem)] lg:min-h-[28rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className={`flex min-h-0 flex-col border-b border-white/10 lg:border-r lg:border-b-0 ${secilenKisi ? "hidden lg:flex" : ""}`}>
          <div className="border-b border-white/10 p-4">
            <h2 className="font-semibold">Sohbetler</h2>
            <label className="mt-3 block">
              <span className="sr-only">Kullanıcı adıyla sohbet ara</span>
              <input
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="Kullanıcı adı ara…"
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
              />
            </label>
          </div>

          <div className="max-h-[26rem] flex-1 overflow-y-auto p-2 lg:max-h-none">
            {hata && !secilenKisi && <p role="alert" className="m-2 rounded-xl bg-rose-300/10 p-3 text-xs text-rose-200">{hata}</p>}
            {arama.trim() ? (
              aramaSonuclari.length ? aramaSonuclari.map((kisi) => (
                <button key={kisi.kullanici_id} onClick={() => void sohbetAc(kisi)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-white/5">
                  <Avatar kisi={kisi} />
                  <span className="truncate text-sm font-medium">@{kisi.takma_ad}</span>
                </button>
              )) : <p className="px-3 py-5 text-sm text-slate-500">Bu kullanıcı adı bulunamadı.</p>
            ) : sonSohbetler.length ? sonSohbetler.map(({ kisi, mesaj }) => (
              <button key={kisi.kullanici_id} onClick={() => void sohbetAc(kisi)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${secilenId === kisi.kullanici_id ? "bg-cyan-300/10" : "hover:bg-white/5"}`}>
                <Avatar kisi={kisi} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">@{kisi.takma_ad}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{mesaj.icerik}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[10px] text-slate-500">{zamanYaz(mesaj.olusturma_tarihi)}</span>
                  {tumMesajlar.some((item) => item.gonderen_id === kisi.kullanici_id && item.alici_id === benimId && !item.okundu_at) && <span className="h-2 w-2 rounded-full bg-cyan-300" aria-label="Okunmamış mesaj" />}
                </span>
              </button>
            )) : (
              <p className="px-3 py-5 text-sm leading-6 text-slate-500">Henüz sohbetin yok. Kullanıcı adını arayıp yeni sohbet başlat.</p>
            )}
            {yukleniyor && <p className="px-3 py-5 text-sm text-slate-500">Yükleniyor…</p>}
          </div>
        </aside>

        <div className={`min-h-[60dvh] min-w-0 flex-col lg:min-h-0 ${secilenKisi ? "flex" : "hidden lg:flex"}`}>
          {secilenKisi ? (
            <>
              <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <button onClick={() => { setSecilenId(""); aktifSohbetRef.current = ""; }} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 md:hidden" aria-label="Sohbet listesine dön">←</button>
                <Avatar kisi={secilenKisi} />
                <div><p className="text-sm font-semibold">@{secilenKisi.takma_ad}</p><p className="text-xs text-slate-500">Knowledge üyesi</p></div>
              </header>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6">
                {aktifMesajlar.length ? aktifMesajlar.map((mesaj) => {
                  const benimMesajim = mesaj.gonderen_id === benimId;
                  return (
                    <div key={mesaj.id} className={`flex ${benimMesajim ? "justify-end" : "justify-start"}`}>
                      <article className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${benimMesajim ? "rounded-br-md bg-cyan-300 text-slate-950" : "rounded-bl-md border border-white/10 bg-slate-950/70 text-slate-100"}`}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{mesaj.icerik}</p>
                        <p className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${benimMesajim ? "text-slate-700" : "text-slate-500"}`}>
                          {zamanYaz(mesaj.olusturma_tarihi)}
                          {benimMesajim && <span>{mesaj.okundu_at ? "· Görüldü" : "· Gönderildi"}</span>}
                        </p>
                      </article>
                    </div>
                  );
                }) : (
                  <div className="m-auto max-w-xs py-12 text-center">
                    <p className="font-medium text-slate-300">Sohbeti başlat</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">İlk mesajını yazıp @{secilenKisi.takma_ad} ile konuşmaya başlayabilirsin.</p>
                  </div>
                )}
                <div ref={mesajSonu} />
              </div>

              <form onSubmit={mesajGonder} className="border-t border-white/10 p-3 sm:p-4">
                {hata && <p role="alert" className="mb-2 text-xs text-rose-200">{hata}</p>}
                <div className="flex items-end gap-2">
                  <textarea value={taslak} onChange={(e) => setTaslak(e.target.value)} maxLength={2000} rows={1} placeholder="Mesaj yaz…" className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50" />
                  <button type="submit" disabled={!taslak.trim() || gonderiliyor} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">{gonderiliyor ? "…" : "Gönder"}</button>
                </div>
              </form>
            </>
          ) : (
            <div className="m-auto max-w-sm px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200" aria-hidden="true">✉</span>
              <h2 className="mt-5 text-lg font-semibold">Bir sohbet seç</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Mevcut sohbetlerinden birini aç ya da kullanıcı adı arayarak yeni mesaj gönder.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Avatar({ kisi }: { kisi: Kisi }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800 text-sm font-semibold text-cyan-100">
      {kisi.avatar_url ? <img src={kisi.avatar_url} alt="" className="h-full w-full object-cover" /> : kisi.takma_ad[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
