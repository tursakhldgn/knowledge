"use client";

import { useEffect, useState } from "react";
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

export default function Sorular() {
  const router = useRouter();
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [anlatimlar, setAnlatimlar] = useState<Anlatim[]>([]);
  const [oylar, setOylar] = useState<Oy[]>([]);
  const [benimId, setBenimId] = useState("");
  const [ders, setDers] = useState(DERS_LISTESI[1]);
  const [konu, setKonu] = useState(DERSLER[DERS_LISTESI[1]][0]);
  const [filtreDers, setFiltreDers] = useState("");
  const [filtreKonu, setFiltreKonu] = useState("");
  const [arama, setArama] = useState("");
  const [baslik, setBaslik] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [yeniAnlatim, setYeniAnlatim] = useState<Record<string, string>>({});
  const [mesaj, setMesaj] = useState("");
  const [profilEksik, setProfilEksik] = useState(false);
  const [profiller, setProfiller] = useState<Record<string, Profil>>({});
  const [anlatimHata, setAnlatimHata] = useState<Record<string, string>>({});
  
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
  }, []);

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
  return (
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
}
  const gorunen = sorular.filter((s) => {
  if (filtreDers && s.ders !== filtreDers) return false;
  if (filtreKonu && s.konu !== filtreKonu) return false;
  if (arama) {
    const a = arama.toLowerCase();
    const metin = (s.baslik + " " + s.konu + " " + (s.aciklama ?? "")).toLowerCase();
    if (!metin.includes(a)) return false;
  }
  return true;
});  

  const kutu =
    "w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-screen-2xl grid-cols-1 content-start gap-5 px-4 pt-6 pb-28 text-slate-100 sm:px-6 sm:pt-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-7 xl:px-8 xl:pt-10">
      <header className="relative col-span-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/70 p-6 shadow-2xl shadow-black/20 sm:p-10">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">● Öğrenme topluluğu</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Birlikte sor, birlikte öğren.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Takıldığın konuyu paylaş, başkalarının anlatımlarından faydalan ya da bildiklerinle birine yardımcı ol.</p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            <span className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-slate-200"><strong className="mr-2 text-white">{sorular.length}</strong>soru</span>
            <span className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-slate-200"><strong className="mr-2 text-white">{anlatimlar.length}</strong>anlatım</span>
            <a href="#soru-paylas" className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-200">Soru paylaş ↓</a>
          </div>
        </div>
      </header>
   
    {profilEksik && (
  <div className="col-span-full flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
    <span>Profilini tamamla: kullanıcı adı seç, istersen fotoğraf ekle.</span>
    <span className="flex shrink-0 gap-3">
      <a href="/profil" className="text-blue-400 underline">Tamamla</a>
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
      <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/75 p-4 shadow-lg shadow-black/10 sm:p-5">
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
  <input
    className={kutu}
    placeholder="Ara (başlık, konu, açıklama)"
    value={arama}
    onChange={(e) => setArama(e.target.value)}
  />
</section>


      <section className="flex min-w-0 flex-col gap-4 xl:col-start-1">
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
              className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:shadow-xl hover:shadow-black/20 sm:p-6"
            >
              <p className="text-sm text-gray-400">
                {s.ders} · {s.konu}
              </p>
              <Yazar p={profiller[s.kullanici_id]} />
              <h3 className="mt-3 text-xl font-bold leading-snug tracking-tight">{s.baslik}</h3>
              {s.aciklama && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{s.aciklama}</p>}

              {s.kullanici_id === benimId ? (
                <button
                  onClick={() => soruSil(s.id)}
                  className="mt-2 text-sm text-red-400 underline"
                >
                  Soruyu sil
                </button>
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
                      className="rounded-xl border border-white/5 bg-slate-950/70 p-4 text-sm"
                    >
                      <Yazar p={profiller[a.kullanici_id]} />
                      <p className="whitespace-pre-wrap">{a.icerik}</p>
                      <div className="mt-2 flex items-center gap-3">
                        {benimki ? (
                          <>
                            <span className="text-gray-400">
                              👍 {oySayisi(a.id)} · senin anlatımın
                            </span>
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
      </section>

      <section id="soru-paylas" className="flex min-w-0 flex-col gap-3 rounded-2xl border border-cyan-300/15 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-xl shadow-black/20 xl:sticky xl:top-20 xl:col-start-2 xl:self-start sm:p-6">
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
      </section>
    </main>
  );
}
