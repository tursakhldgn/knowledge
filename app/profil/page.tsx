"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SIMDIKI_YIL = new Date().getFullYear();

export default function Profil() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [ad, setAd] = useState("");
  const [takmaAd, setTakmaAd] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dogumYili, setDogumYili] = useState("");
  const [yasOnayi, setYasOnayi] = useState(false);
  const [dosya, setDosya] = useState<File | null>(null);
  const [onizleme, setOnizleme] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    async function basla() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/giris");
        return;
      }
      setUserId(data.user.id);
      const { data: p } = await supabase
        .from("profiller")
        .select("takma_ad, ad, biyografi, avatar_url, dogum_yili, yas_onayi")
        .eq("kullanici_id", data.user.id)
        .maybeSingle();
      if (p) {
        setAd(p.ad ?? "");
        setTakmaAd(p.takma_ad ?? "");
        setBio(p.biyografi ?? "");
        setAvatarUrl(p.avatar_url ?? "");
        setDogumYili(p.dogum_yili ? String(p.dogum_yili) : "");
        setYasOnayi(p.yas_onayi === true);
      } else {
        const metadataYili = data.user.user_metadata?.dogum_yili;
        if (metadataYili) setDogumYili(String(metadataYili));
        setYasOnayi(data.user.user_metadata?.yas_onayi === true);
      }
    }
    basla();
  }, []);

  function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setMesaj("Sadece jpg, png veya webp yükleyebilirsin.");
      return;
    }
    if (f.size > 1024 * 1024) {
      setMesaj("Fotoğraf en fazla 1 MB olabilir.");
      return;
    }
    setMesaj("");
    setDosya(f);
    setOnizleme(URL.createObjectURL(f));
  }

  async function kaydet() {
    setMesaj("");
    if (!userId) {
      setMesaj("Oturum bilgisi yüklenemedi. Sayfayı yenileyip tekrar dene.");
      return;
    }
    const yil = Number(dogumYili);
    if (!yil || yil < 1900 || yil > SIMDIKI_YIL || SIMDIKI_YIL - yil < 15) {
      setMesaj("15 yaşından büyük olduğunu doğrulamak için geçerli doğum yılını yaz.");
      return;
    }
    if (!yasOnayi) {
      setMesaj("15 yaşından büyük olduğunu onaylamalısın.");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(takmaAd)) {
      setMesaj("Kullanıcı adı 3-20 karakter olmalı: harf, rakam ve _ kullanabilirsin.");
      return;
    }
    setKaydediliyor(true);

    let yeniAvatar = avatarUrl;
    if (dosya) {
      const uzanti = dosya.type.split("/")[1];
      const yol = `${userId}/${Date.now()}.${uzanti}`;
      const { error: yuklemeHata } = await supabase.storage
        .from("avatarlar")
        .upload(yol, dosya, { contentType: dosya.type });
      if (yuklemeHata) {
        setMesaj("Fotoğraf yüklenemedi: " + yuklemeHata.message);
        setKaydediliyor(false);
        return;
      }
      yeniAvatar = supabase.storage.from("avatarlar").getPublicUrl(yol).data.publicUrl;
    }

    const { error } = await supabase.from("profiller").upsert(
      {
        kullanici_id: userId,
        dogum_yili: yil,
        yas_onayi: yasOnayi,
        ad: ad || null,
        takma_ad: takmaAd,
        biyografi: bio || null,
        avatar_url: yeniAvatar || null,
      },
      { onConflict: "kullanici_id" }
    );

    setKaydediliyor(false);
    if (error) {
      setMesaj(
        error.code === "23505"
          ? "Bu kullanıcı adı alınmış, başka bir tane dene."
          : error.code === "42501"
            ? "Supabase tablo yetkisi eksik. SQL Editor'da profiller tablosu için SELECT, INSERT ve UPDATE izni ver."
            : "Hata: " + error.message
      );
      return;
    }
    router.push("/sorular");
  }

  function simdilikGec() {
    localStorage.setItem("profilHatirlatma", String(Date.now()));
    router.push("/sorular");
  }

  const kutu =
    "w-full rounded border border-gray-400 bg-white p-2 text-black placeholder-gray-500";
  const gosterilen = onizleme || avatarUrl;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-3 p-6">
      <h1 className="text-3xl font-bold">Profilini oluştur</h1>
      <p className="text-sm text-gray-400">
        Gerçek adını yazmak zorunda değilsin. Telefon, adres, okul adı gibi
        kişisel bilgileri yazma.
      </p>

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-700">
          {gosterilen ? (
            <img src={gosterilen} alt="Profil" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">👤</span>
          )}
        </div>
        <label className="cursor-pointer rounded bg-gray-600 px-3 py-2 text-sm text-white">
          Fotoğraf seç
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={dosyaSec} className="hidden" />
        </label>
      </div>

      <input className={kutu} placeholder="İsim (isteğe bağlı)" maxLength={40} value={ad} onChange={(e) => setAd(e.target.value)} />
      <input className={kutu} placeholder="Kullanıcı adı (zorunlu)" maxLength={20} value={takmaAd} onChange={(e) => setTakmaAd(e.target.value)} />
      <textarea className={kutu} rows={3} maxLength={200} placeholder="Biyografi (en fazla 200 karakter)" value={bio} onChange={(e) => setBio(e.target.value)} />

      {(!dogumYili || !yasOnayi) && (
        <>
          {!dogumYili && (
            <input
              className={kutu}
              type="number"
              min="1900"
              max={SIMDIKI_YIL - 15}
              placeholder="Doğum yılın"
              value={dogumYili}
              onChange={(e) => setDogumYili(e.target.value)}
            />
          )}
          {!yasOnayi && (
            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={yasOnayi}
                onChange={(e) => setYasOnayi(e.target.checked)}
                className="mt-1"
              />
              15 yaşından büyük olduğumu onaylıyorum.
            </label>
          )}
        </>
      )}

      <button onClick={kaydet} disabled={kaydediliyor} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
      </button>
      <button onClick={simdilikGec} className="text-sm text-gray-400 underline">
        Şimdilik geç
      </button>
      {mesaj && <p className="text-red-400">{mesaj}</p>}
    </main>
  );
}
