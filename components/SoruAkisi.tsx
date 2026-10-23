"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DERSLER, DERS_LISTESI } from "@/lib/dersler";

type Soru = {
  id: string;
  ders: string;
  konu: string;
  baslik: string;
  aciklama: string | null;
  olusturma_tarihi: string;
  kullanici_id: string;
};

type Anlatim = {
  id: string;
  soru_id: string;
  kullanici_id: string;
  icerik: string;
  olusturma_tarihi: string;
};

type Oy = {
  anlatim_id: string;
  kullanici_id: string;
};

type Profil = {
  kullanici_id: string;
  takma_ad: string | null;
  avatar_url: string | null;
};

export default function Sorular({ mode = "home" }: { mode?: "home" | "discover" | "create" }) {
  const router = useRouter();
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [anlatimlar, setAnlatimlar] = useState<Anlatim[]>([]);
  const [oylar, setOylar] = useState<Oy[]>([]);
  const [benimId, setBenimId] = useState("");
  const [ders, setDers] = useState(DERS_LISTESI[1]);
  const [konu, setKonu] = useState(DERSLER[DERS_LISTESI[1]][0]);
  const [filtreDers, setFiltreDers] = useState("");
  const [filtreKonu, setFiltreKonu] = useState("");
  const [filtreZaman, setFiltreZaman] = useState("");
  const [filtreDurum, setFiltreDurum] = useState("hepsi");
  const [sirala, setSirala] = useState("yeni");
  const [arama, setArama] = useState("");
  const [baslik, setBaslik] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [yeniAnlatim, setYeniAnlatim] = useState<Record<string, string>>({});
  const [mesaj, setMesaj] = useState("");
  const [profilEksik, setProfilEksik] = useState(false);
  const [profiller, setProfiller] = useState<Record<string, Profil>>({});
  const [anlatimHata, setAnlatimHata] = useState<Record<string, string>>({});
  const [duzenlenenSoruId, setDuzenlenenSoruId] = useState("");
  const [soruDersTaslak, setSoruDersTaslak] = useState("");
  const [soruKonuTaslak, setSoruKonuTaslak] = useState("");
  const [soruBaslikTaslak, setSoruBaslikTaslak] = useState("");
  const [soruAciklamaTaslak, setSoruAciklamaTaslak] = useState("");
  const [duzenlenenAnlatimId, setDuzenlenenAnlatimId] = useState("");
  const [anlatimTaslak, setAnlatimTaslak] = useState("");
  const deepLinkRef = useRef("");
  
  async function verileriGetir() {
    const [s, a, o] = await Promise.all([
      supabase
        .from("sorular")
        .select("*")
        .order("olusturma_tarihi", { ascending: false }),
      supabase
        .from("anlatimlar")
        .select("*")
        .order("olusturma_tarihi", { ascending: true }),
      supabase.from("oylar").select("anlatim_id, kullanici_id"),
    ]);
    if (s.error) setMesaj(s.error.message);
    else setSorular(s.data ?? []);
    if (a.data) setAnlatimlar(a.data);
    if (o.data) setOylar(o.data);

    const { data: p } = await supabase
  .from("profil_kartlari")
  .select("kullanici_id, takma_ad, avatar_url");
if (p) {
  const harita: Record<string, Profil> = {};
  p.forEach((x) => (harita[x.kullanici_id] = x));
  setProfiller(harita);
}
  }

  useEffect(() => {
    let aktif = true;
    let kanal: ReturnType<typeof supabase.channel> | null = null;
    let yenilemeZamani: ReturnType<typeof setTimeout> | undefined;

    function yenilemeyiPlanla() {
      if (yenilemeZamani) clearTimeout(yenilemeZamani);
      yenilemeZamani = setTimeout(() => {
        if (aktif) void verileriGetir();
      }, 150);
    }

    async function basla() {
      const { data } = await supabase.auth.getUser();
      if (!aktif) return;
      if (!data.user) {
        router.replace("/giris");
        return;
      }
      setBenimId(data.user.id);
      const { data: p } = await supabase
  .from("profiller")
  .select("takma_ad")
  .eq("kullanici_id", data.user.id)
  .maybeSingle();
const son = Number(localStorage.getItem("profilHatirlatma") ?? 0);
if (!p?.takma_ad && Date.now() - son > 3 * 24 * 60 * 60 * 1000) {
  setProfilEksik(true);
}
      if (!aktif) return;
      verileriGetir();

      kanal = supabase
        .channel("sorular-anlik-akis")
        .on("postgres_changes", { event: "*", schema: "public", table: "sorular" }, yenilemeyiPlanla)
        .on("postgres_changes", { event: "*", schema: "public", table: "anlatimlar" }, yenilemeyiPlanla)
        .on("postgres_changes", { event: "*", schema: "public", table: "oylar" }, yenilemeyiPlanla)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiller" }, yenilemeyiPlanla)
        .subscribe((durum) => {
          if (durum === "SUBSCRIBED") yenilemeyiPlanla();
        });
    }
    basla();

    return () => {
      aktif = false;
      if (yenilemeZamani) clearTimeout(yenilemeZamani);
      if (kanal) void supabase.removeChannel(kanal);
    };
  }, [router]);

  async function soruEkle() {
    setMesaj("");
    if (baslik.trim().length < 5) {
  setMesaj("Başlık en az 5 karakter olmalı.");
  return;
}
    const { error } = await supabase
      .from("sorular")
      .insert({ ders, konu, baslik, aciklama });
    if (error) {
      setMesaj("Hata: " + error.message);
      return;
    }
    setBaslik("");
    setAciklama("");
    verileriGetir();
  }

  async function soruSil(id: string) {
    await supabase.from("sorular").delete().eq("id", id);
    verileriGetir();
  }

 async function anlatimEkle(soruId: string) {
  setMesaj("");
  const icerik = yeniAnlatim[soruId] ?? "";
  if (icerik.trim().length < 10) {
    setAnlatimHata({
      ...anlatimHata,
      [soruId]: "Anlatım en az 10 karakter olmalı.",
    });
    return;
  }
  setAnlatimHata({ ...anlatimHata, [soruId]: "" });
  const { error } = await supabase
    .from("anlatimlar")
    .insert({ soru_id: soruId, icerik });
  if (error) {
    setAnlatimHata({
      ...anlatimHata,
      [soruId]: "Anlatım kaydedilemedi, tekrar dene.",
    });
    return;
  }
  setYeniAnlatim({ ...yeniAnlatim, [soruId]: "" });
  verileriGetir();
}

  async function anlatimSil(id: string) {
    await supabase.from("anlatimlar").delete().eq("id", id);
    verileriGetir();
  }

  async function soruGuncelle(soruId: string) {
    const baslikYeni = soruBaslikTaslak.trim();
    if (baslikYeni.length < 5) {
      setMesaj("Başlık en az 5 karakter olmalı.");
      return;
    }
    const { error } = await supabase.from("sorular").update({ ders: soruDersTaslak, konu: soruKonuTaslak, baslik: baslikYeni, aciklama: soruAciklamaTaslak.trim() || null }).eq("id", soruId);
    if (error) {
      setMesaj("Soru güncellenemedi. Tekrar dene.");
      return;
    }
    setDuzenlenenSoruId("");
    setMesaj("Soru güncellendi.");
    void verileriGetir();
  }

  async function anlatimGuncelle(anlatimId: string) {
    const icerik = anlatimTaslak.trim();
    if (icerik.length < 10) {
      setMesaj("Anlatım en az 10 karakter olmalı.");
      return;
    }
    const { error } = await supabase.from("anlatimlar").update({ icerik }).eq("id", anlatimId);
    if (error) {
      setMesaj("Anlatım güncellenemedi. Tekrar dene.");
      return;
    }
    setDuzenlenenAnlatimId("");
    setMesaj("Anlatım güncellendi.");
    void verileriGetir();
  }

  async function oyVer(anlatimId: string, verdiMi: boolean) {
    setMesaj("");
    if (verdiMi) {
      await supabase
        .from("oylar")
        .delete()
        .eq("anlatim_id", anlatimId)
        .eq("kullanici_id", benimId);
    } else {
      const { error } = await supabase
        .from("oylar")
        .insert({ anlatim_id: anlatimId });
      if (error) setMesaj("Hata: " + error.message);
    }
    verileriGetir();
  }

  async function sikayetEt(tur: "soru" | "anlatim", id: string) {
    const sebep = window.prompt("Neden şikâyet ediyorsun? (en az 3 karakter)");
    if (!sebep) return;
    const { error } = await supabase.from("sikayetler").insert({
      sebep,
      ...(tur === "soru" ? { soru_id: id } : { anlatim_id: id }),
    });
    setMesaj(
      error ? "Hata: " + error.message : "Şikâyetin alındı, teşekkürler."
    );
  }

  function oySayisi(anlatimId: string) {
    return oylar.filter((o) => o.anlatim_id === anlatimId).length;
  }

  function benimOyumVar(anlatimId: string) {
    return oylar.some(
      (o) => o.anlatim_id === anlatimId && o.kullanici_id === benimId
    );
  }

  function Yazar({ p }: { p?: Profil }) {
  const icerik = (
    <span className="flex items-center gap-2 text-sm text-gray-400">
      <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gray-700 text-xs">
        {p?.avatar_url ? (
          <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          "👤"
        )}
      </span>
      {p?.takma_ad ? "@" + p.takma_ad : "isimsiz"}
    </span>
  );
  return p?.kullanici_id ? <Link href={`/profil/${p.kullanici_id}`} className="w-fit rounded-md outline-none hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300">{icerik}</Link> : icerik;
}

  const gorunen = sorular.filter((s) => {
    const soruAnlatimlari = anlatimlar.filter((anlatim) => anlatim.soru_id === s.id);
    if (filtreDers && s.ders !== filtreDers) return false;
    if (filtreKonu && s.konu !== filtreKonu) return false;
    const zamanAraligi = filtreZaman === "gun" ? 24 * 60 * 60 * 1000 : filtreZaman === "hafta" ? 7 * 24 * 60 * 60 * 1000 : filtreZaman === "ay" ? 30 * 24 * 60 * 60 * 1000 : 0;
    if (zamanAraligi && Date.now() - Date.parse(s.olusturma_tarihi) > zamanAraligi) return false;
    if (filtreDurum === "cevapli" && !soruAnlatimlari.length) return false;
    if (filtreDurum === "cevapsiz" && soruAnlatimlari.length) return false;
    if (arama.trim()) {
      const sorgu = arama.trim().toLocaleLowerCase("tr-TR");
      const yazar = profiller[s.kullanici_id]?.takma_ad ?? "";
      const metin = `${s.baslik} ${s.konu} ${s.ders} ${s.aciklama ?? ""} ${yazar} ${soruAnlatimlari.map((a) => a.icerik).join(" ")}`.toLocaleLowerCase("tr-TR");
      if (!metin.includes(sorgu)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sirala === "oy") {
      const aOy = anlatimlar.filter((item) => item.soru_id === a.id).reduce((toplam, item) => toplam + oySayisi(item.id), 0);
      const bOy = anlatimlar.filter((item) => item.soru_id === b.id).reduce((toplam, item) => toplam + oySayisi(item.id), 0);
      return bOy - aOy || Date.parse(b.olusturma_tarihi) - Date.parse(a.olusturma_tarihi);
    }
    if (sirala === "anlatim") {
      const fark = anlatimlar.filter((item) => item.soru_id === b.id).length - anlatimlar.filter((item) => item.soru_id === a.id).length;
      return fark || Date.parse(b.olusturma_tarihi) - Date.parse(a.olusturma_tarihi);
    }
    return Date.parse(b.olusturma_tarihi) - Date.parse(a.olusturma_tarihi);
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const anlatimId = params.get("anlatim");
    const soruId = params.get("soru");
    const hedef = anlatimId ? `anlatim-${anlatimId}` : soruId ? `soru-${soruId}` : "";
    const yuklendi = anlatimId ? anlatimlar.some((item) => item.id === anlatimId) : soruId ? sorular.some((item) => item.id === soruId) : false;
    if (!hedef || !yuklendi || deepLinkRef.current === hedef) return;
    deepLinkRef.current = hedef;
    const zamanlayici = setTimeout(() => document.getElementById(hedef)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    return () => clearTimeout(zamanlayici);
  }, [anlatimlar, sorular]);

  const kutu =
    "w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

  return (
    <main data-app-theme="light" className={`mx-auto grid min-h-dvh w-full max-w-screen-2xl grid-cols-1 content-start gap-5 px-4 pt-6 pb-28 text-slate-100 sm:px-6 sm:pt-8 xl:px-8 xl:pt-10 ${mode === "create" ? "max-w-3xl" : "xl:grid-cols-1"}`}>
      {mode === "home" && <header className="col-span-full flex items-center justify-between border-b border-slate-200 pb-4">
        <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Sorular</h1><p className="mt-1 text-sm text-slate-500">Topluluğun paylaştığı sorular</p></div>
        <Link href="/soru-ekle" aria-label="Soru paylaş" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-teal-700 text-2xl font-medium text-white transition hover:bg-teal-800">+</Link>
      </header>}
   
    {profilEksik && (
  <div className="col-span-full flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
    <span>Profilini tamamla: kullanıcı adı seç, istersen fotoğraf ekle.</span>
    <span className="flex shrink-0 gap-3">
    <Link href="/profil" className="text-blue-400 underline">Tamamla</Link>
      <button
        onClick={() => {
          localStorage.setItem("profilHatirlatma", String(Date.now()));
          setProfilEksik(false);
        }}
        className="text-gray-400 underline"
      >
        Sonra
      </button>
    </span>
  </div>
)}
      {mode === "discover" && <section className="col-span-full flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/75 p-4 shadow-lg shadow-black/10 sm:p-5">
  <div className="mb-1">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Keşfet</p>
    <h2 className="mt-1 text-lg font-semibold">Sorulara göz at</h2>
  </div>
  <select
    className={kutu}
    value={filtreDers}
    onChange={(e) => {
      setFiltreDers(e.target.value);
      setFiltreKonu("");
    }}
  >
    <option value="">Tüm dersler</option>
    {DERS_LISTESI.map((d) => (
      <option key={d}>{d}</option>
    ))}
  </select>
  {filtreDers && (
    <select
      className={kutu}
      value={filtreKonu}
      onChange={(e) => setFiltreKonu(e.target.value)}
    >
      <option value="">Tüm konular</option>
      {DERSLER[filtreDers].map((k) => (
        <option key={k}>{k}</option>
      ))}
    </select>
  )}
  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
    <select className={kutu} value={filtreDurum} onChange={(e) => setFiltreDurum(e.target.value)} aria-label="Yanıt durumuna göre filtrele">
      <option value="hepsi">Tüm sorular</option>
      <option value="cevapli">Yanıtı olanlar</option>
      <option value="cevapsiz">Yanıtsız sorular</option>
    </select>
    <select className={kutu} value={sirala} onChange={(e) => setSirala(e.target.value)} aria-label="Soruları sırala">
      <option value="yeni">En yeni</option>
      <option value="oy">En çok faydalı oy</option>
      <option value="anlatim">En çok anlatım</option>
    </select>
  </div>
  <select className={kutu} value={filtreZaman} onChange={(e) => setFiltreZaman(e.target.value)} aria-label="Yayın zamanına göre filtrele">
    <option value="">Her zaman</option>
    <option value="gun">Son 24 saat</option>
    <option value="hafta">Son 7 gün</option>
    <option value="ay">Son 30 gün</option>
  </select>
  <input
    className={kutu}
    placeholder="Soru, anlatım veya kullanıcı ara"
    value={arama}
    onChange={(e) => setArama(e.target.value)}
  />
</section>}


      {mode !== "create" && <section className="flex min-w-0 flex-col gap-4 xl:col-start-1">
       {gorunen.length === 0 && (
         <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 px-6 py-12 text-center">
           <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-2xl text-cyan-200">?</span>
           <h2 className="mt-4 text-lg font-semibold text-white">Henüz soru yok</h2>
           <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">Bu filtrede henüz soru bulunamadı. İstersen ilk soruyu paylaşarak sohbeti başlat.</p>
           <a href="#soru-paylas" className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">Soru sor</a>
         </div>
       )}
       {gorunen.map((s) => {
          const buSorununAnlatimlari = anlatimlar
            .filter((a) => a.soru_id === s.id)
            .sort((x, y) => oySayisi(y.id) - oySayisi(x.id));

          return (
            <article
              key={s.id}
              id={`soru-${s.id}`}
              className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:shadow-xl hover:shadow-black/20 sm:p-6"
            >
              <p className="text-sm text-gray-400">
                {s.ders} · {s.konu}
              </p>
              <Yazar p={profiller[s.kullanici_id]} />
              {duzenlenenSoruId === s.id ? (
                <div className="mt-3 flex min-w-0 flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select className={kutu} value={soruDersTaslak} onChange={(e) => { setSoruDersTaslak(e.target.value); setSoruKonuTaslak(DERSLER[e.target.value][0]); }} aria-label="Ders">
                      {DERS_LISTESI.map((dersSecenegi) => <option key={dersSecenegi}>{dersSecenegi}</option>)}
                    </select>
                    <select className={kutu} value={soruKonuTaslak} onChange={(e) => setSoruKonuTaslak(e.target.value)} aria-label="Konu">
                      {(DERSLER[soruDersTaslak] ?? []).map((konuSecenegi) => <option key={konuSecenegi}>{konuSecenegi}</option>)}
                    </select>
                  </div>
                  <input className={kutu} maxLength={180} value={soruBaslikTaslak} onChange={(e) => setSoruBaslikTaslak(e.target.value)} aria-label="Soru başlığı" />
                  <textarea className={kutu} rows={3} maxLength={2000} value={soruAciklamaTaslak} onChange={(e) => setSoruAciklamaTaslak(e.target.value)} placeholder="Açıklama (isteğe bağlı)" aria-label="Soru açıklaması" />
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => void soruGuncelle(s.id)} className="min-h-10 rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950">Değişiklikleri kaydet</button>
                    <button onClick={() => setDuzenlenenSoruId("")} className="min-h-10 rounded-lg border border-white/10 px-4 py-2 text-slate-300">Vazgeç</button>
                  </div>
                </div>
              ) : <>
                <h3 className="mt-3 text-xl font-bold leading-snug tracking-tight">{s.baslik}</h3>
                {s.aciklama && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{s.aciklama}</p>}
              </>}

              {s.kullanici_id === benimId ? (
                <div className="mt-2 flex flex-wrap gap-4">
                  <button onClick={() => { setDuzenlenenSoruId(s.id); setSoruDersTaslak(s.ders); setSoruKonuTaslak(s.konu); setSoruBaslikTaslak(s.baslik); setSoruAciklamaTaslak(s.aciklama ?? ""); }} className="min-h-10 text-sm text-cyan-200 underline underline-offset-4">Düzenle</button>
                  <button onClick={() => soruSil(s.id)} className="min-h-10 text-sm text-red-400 underline underline-offset-4">Soruyu sil</button>
                </div>
              ) : (
                <button
                  onClick={() => sikayetEt("soru", s.id)}
                  className="mt-2 text-sm text-gray-400 underline"
                >
                  Şikâyet et
                </button>
              )}

              <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4">
                <p className="text-sm font-semibold text-slate-200">
                  Anlatımlar ({buSorununAnlatimlari.length})
                </p>

                {buSorununAnlatimlari.map((a) => {
                  const benimki = a.kullanici_id === benimId;
                  const verdim = benimOyumVar(a.id);
                  return (
                    <div
                      key={a.id}
                      id={`anlatim-${a.id}`}
                      className="rounded-xl border border-white/5 bg-slate-950/70 p-4 text-sm"
                    >
                      <Yazar p={profiller[a.kullanici_id]} />
                      {duzenlenenAnlatimId === a.id ? (
                        <div className="mt-3 flex flex-col gap-3">
                          <textarea className={kutu} rows={4} maxLength={5000} value={anlatimTaslak} onChange={(e) => setAnlatimTaslak(e.target.value)} aria-label="Anlatım içeriği" />
                          <div className="flex flex-wrap gap-3">
                            <button onClick={() => void anlatimGuncelle(a.id)} className="min-h-10 rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950">Değişiklikleri kaydet</button>
                            <button onClick={() => setDuzenlenenAnlatimId("")} className="min-h-10 rounded-lg border border-white/10 px-4 py-2 text-slate-300">Vazgeç</button>
                          </div>
                        </div>
                      ) : <p className="whitespace-pre-wrap break-words">{a.icerik}</p>}
                      <div className="mt-2 flex items-center gap-3">
                        {benimki ? (
                          <>
                            <span className="text-gray-400">
                              👍 {oySayisi(a.id)} · senin anlatımın
                            </span>
                            <button onClick={() => { setDuzenlenenAnlatimId(a.id); setAnlatimTaslak(a.icerik); }} className="min-h-10 text-cyan-200 underline">Düzenle</button>
                            <button
                              onClick={() => anlatimSil(a.id)}
                              className="text-red-400 underline"
                            >
                              Sil
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => oyVer(a.id, verdim)}
                              className={
                                verdim
                                  ? "rounded bg-green-700 px-3 py-1 text-white"
                                  : "rounded border border-gray-500 px-3 py-1"
                              }
                            >
                              👍 İşe yaradı · {oySayisi(a.id)}
                            </button>
                            <button
                              onClick={() => sikayetEt("anlatim", a.id)}
                              className="text-gray-400 underline"
                            >
                              Şikâyet et
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

               <textarea
  className={kutu}
  rows={3}
  placeholder="Bu konuyu nasıl anlatırsın? (en az 10 karakter)"
  value={yeniAnlatim[s.id] ?? ""}
  onChange={(e) =>
    setYeniAnlatim({ ...yeniAnlatim, [s.id]: e.target.value })
  }
/>
{anlatimHata[s.id] && (
  <p className="text-sm text-red-400">{anlatimHata[s.id]}</p>
)}
<button
  onClick={() => anlatimEkle(s.id)}
  className="self-start rounded bg-gray-600 px-4 py-2 text-white"
>
  Anlat
</button>
              </div>
            </article>
          );
        })}
      </section>}

      {mode === "create" && <section id="soru-paylas" className="flex min-w-0 flex-col gap-3 px-1 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Topluluğa katkıda bulun</p>
          <h2 className="mt-1 text-xl font-semibold">Neyi anlamadın?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Sorunu paylaş, birlikte bir yanıt bulalım.</p>
        </div>
        <select
  className={kutu}
  value={ders}
  onChange={(e) => {
    setDers(e.target.value);
    setKonu(DERSLER[e.target.value][0]);
  }}
>
  {DERS_LISTESI.map((d) => (
    <option key={d}>{d}</option>
  ))}
</select>
<select
  className={kutu}
  value={konu}
  onChange={(e) => setKonu(e.target.value)}
>
  {DERSLER[ders].map((k) => (
    <option key={k}>{k}</option>
  ))}
</select>

        <input
          className={kutu}
          placeholder="Kısaca neyi anlamadın? (en az 5 karakter)"
          value={baslik}
          onChange={(e) => setBaslik(e.target.value)}
        />
        <textarea
          className={kutu}
          rows={3}
          placeholder="Detay (isteğe bağlı)"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
        />
        <button
          onClick={soruEkle}
          className="rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Soruyu paylaş
        </button>
        {mesaj && (
  <p className="text-red-400">
    {mesaj.startsWith("Hata:") ? "Bir sorun oldu, tekrar dene." : mesaj}
  </p>
)}
        <p className="text-sm text-gray-400">
          Telefon numarası, Instagram adı gibi kişisel bilgi paylaşma.
        </p>
      </section>}
    </main>
  );
}
