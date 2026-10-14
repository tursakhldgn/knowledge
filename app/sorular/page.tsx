"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function Sorular() {
  const router = useRouter();
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [anlatimlar, setAnlatimlar] = useState<Anlatim[]>([]);
  const [oylar, setOylar] = useState<Oy[]>([]);
  const [benimId, setBenimId] = useState("");
  const [ders, setDers] = useState("TYT Matematik");
  const [konu, setKonu] = useState("");
  const [baslik, setBaslik] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [yeniAnlatim, setYeniAnlatim] = useState<Record<string, string>>({});
  const [mesaj, setMesaj] = useState("");

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
  }

  useEffect(() => {
    async function basla() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/giris");
        return;
      }
      setBenimId(data.user.id);
      verileriGetir();
    }
    basla();
  }, []);

  async function soruEkle() {
    setMesaj("");
    const { error } = await supabase
      .from("sorular")
      .insert({ ders, konu, baslik, aciklama });
    if (error) {
      setMesaj("Hata: " + error.message);
      return;
    }
    setKonu("");
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
    const { error } = await supabase
      .from("anlatimlar")
      .insert({ soru_id: soruId, icerik });
    if (error) {
      setMesaj("Hata: " + error.message);
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

  const kutu =
    "w-full rounded border border-gray-400 bg-white p-2 text-black placeholder-gray-500";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <h1 className="text-3xl font-bold">Sorular</h1>

      <section className="flex flex-col gap-2 rounded border border-gray-600 p-4">
        <h2 className="text-xl font-semibold">Neyi anlamadın?</h2>
        <select
          className={kutu}
          value={ders}
          onChange={(e) => setDers(e.target.value)}
        >
          <option>TYT Matematik</option>
        </select>
        <input
          className={kutu}
          placeholder="Konu (ör. Üslü sayılar)"
          value={konu}
          onChange={(e) => setKonu(e.target.value)}
        />
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
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Soruyu paylaş
        </button>
        {mesaj && <p className="text-red-400">{mesaj}</p>}
        <p className="text-sm text-gray-400">
          Telefon numarası, Instagram adı gibi kişisel bilgi paylaşma.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        {sorular.length === 0 && <p>Henüz soru yok. İlk soruyu sen sor!</p>}
        {sorular.map((s) => {
          const buSorununAnlatimlari = anlatimlar
            .filter((a) => a.soru_id === s.id)
            .sort((x, y) => oySayisi(y.id) - oySayisi(x.id));

          return (
            <article
              key={s.id}
              className="rounded border border-gray-600 p-4"
            >
              <p className="text-sm text-gray-400">
                {s.ders} · {s.konu}
              </p>
              <h3 className="text-lg font-semibold">{s.baslik}</h3>
              {s.aciklama && <p className="mt-1">{s.aciklama}</p>}

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

              <div className="mt-4 flex flex-col gap-2 border-t border-gray-700 pt-3">
                <p className="text-sm font-semibold text-gray-300">
                  Anlatımlar ({buSorununAnlatimlari.length})
                </p>

                {buSorununAnlatimlari.map((a) => {
                  const benimki = a.kullanici_id === benimId;
                  const verdim = benimOyumVar(a.id);
                  return (
                    <div
                      key={a.id}
                      className="rounded bg-gray-800 p-3 text-sm"
                    >
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
    </main>
  );
}