"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SIMDIKI_YIL = new Date().getFullYear();
const AVATAR_HEDEF_BOYUTU = 950 * 1024;

async function fotografiSikistir(file: File): Promise<File> {
  const kaynakUrl = URL.createObjectURL(file);

  try {
    const resim = new Image();
    resim.src = kaynakUrl;
    await resim.decode();

    const maksimumKenar = 1600;
    const oran = Math.min(1, maksimumKenar / Math.max(resim.naturalWidth, resim.naturalHeight));
    let genislik = Math.max(1, Math.round(resim.naturalWidth * oran));
    let yukseklik = Math.max(1, Math.round(resim.naturalHeight * oran));
    const tuval = document.createElement("canvas");
    const context = tuval.getContext("2d");
    if (!context) throw new Error("Fotoğraf işlenemedi. Başka bir fotoğraf dene.");

    for (let deneme = 0; deneme < 12; deneme++) {
      tuval.width = genislik;
      tuval.height = yukseklik;
      context.clearRect(0, 0, genislik, yukseklik);
      context.drawImage(resim, 0, 0, genislik, yukseklik);

      const kalite = Math.max(0.42, 0.88 - deneme * 0.08);
      const blob = await new Promise<Blob | null>((resolve) =>
        tuval.toBlob(resolve, "image/webp", kalite)
      );
      if (!blob) throw new Error("Fotoğraf işlenemedi. Başka bir fotoğraf dene.");
      if (blob.size <= AVATAR_HEDEF_BOYUTU) {
        const ad = file.name.replace(/\.[^.]+$/, "") || "profil-fotografi";
        return new File([blob], `${ad}.webp`, {
          type: "image/webp",
          lastModified: Date.now(),
        });
      }

      if (deneme >= 5) {
        genislik = Math.max(1, Math.round(genislik * 0.82));
        yukseklik = Math.max(1, Math.round(yukseklik * 0.82));
      }
    }

    throw new Error("Bu fotoğraf 1 MB altına küçültülemedi. Daha küçük bir fotoğraf dene.");
  } catch (hata) {
    if (hata instanceof Error && hata.message.includes("1 MB altına")) throw hata;
    throw new Error("Fotoğraf açılamadı veya küçültülemedi. JPG, PNG ya da WebP fotoğrafı dene.");
  } finally {
    URL.revokeObjectURL(kaynakUrl);
  }
}

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
  const [fotografIsleniyor, setFotografIsleniyor] = useState(false);

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
  }, [router]);

  async function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (!f.type.startsWith("image/")) {
      setMesaj("Bir fotoğraf dosyası seç.");
      return;
    }

    setMesaj("");
    setFotografIsleniyor(true);
    try {
      const kucukDosya = await fotografiSikistir(f);
      setDosya(kucukDosya);
      const yeniOnizleme = URL.createObjectURL(kucukDosya);
      setOnizleme((onceki) => {
        if (onceki) URL.revokeObjectURL(onceki);
        return yeniOnizleme;
      });
    } catch (hata) {
      setDosya(null);
      setOnizleme((onceki) => {
        if (onceki) URL.revokeObjectURL(onceki);
        return "";
      });
      setMesaj(hata instanceof Error ? hata.message : "Fotoğraf küçültülemedi.");
    } finally {
      setFotografIsleniyor(false);
    }
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
      const yol = `${userId}/${Date.now()}.webp`;
      const { error: yuklemeHata } = await supabase.storage
        .from("avatarlar")
        .upload(yol, dosya, { contentType: "image/webp" });
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

  async function cikisYap() {
    await supabase.auth.signOut();
    router.push("/giris");
  }

  const kutu =
    "w-full border-0 border-b border-slate-300 bg-transparent px-1 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-cyan-700 focus:ring-0";
  const gosterilen = onizleme || avatarUrl;

  return (
    <main data-app-theme="light" className="mx-auto mt-5 mb-24 grid w-[calc(100%-1.5rem)] max-w-4xl grid-cols-1 gap-5 px-1 py-4 text-slate-800 sm:mt-8 sm:w-[calc(100%-3rem)] sm:gap-6 sm:py-7 xl:mt-10 xl:grid-cols-2 xl:gap-x-12 xl:gap-y-6 xl:px-4 xl:py-10">
      <div className="flex min-w-0 items-start justify-between gap-3 xl:col-span-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Topluluğun bir parçasısın</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Profilini oluştur</h1>
        </div>
        <button onClick={cikisYap} className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-rose-300/30 hover:bg-rose-300/10 hover:text-rose-200 sm:text-sm">
          Çıkış yap
        </button>
      </div>
      <p className="text-sm leading-6 text-slate-400 xl:col-span-2">
        Gerçek adını yazmak zorunda değilsin. Telefon, adres, okul adı gibi
        kişisel bilgileri yazma.
      </p>
      {userId && <Link href={`/profil/${userId}`} className="w-fit text-sm font-medium text-cyan-200 underline underline-offset-4 hover:text-cyan-100 xl:col-span-2">Profilini görüntüle ve katkılarını gör</Link>}

      <div className="flex min-w-0 items-center gap-5 border-y border-slate-200 py-5 xl:col-span-2">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          {gosterilen ? (
            <img src={gosterilen} alt="Profil" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">👤</span>
          )}
        </div>
        <label className="cursor-pointer rounded-full bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800">
          Fotoğraf seç
          <input type="file" accept="image/*" onChange={dosyaSec} className="hidden" />
        </label>
      </div>
      {fotografIsleniyor && <p className="text-sm text-cyan-200">Fotoğraf 1 MB altına küçültülüyor…</p>}
      {dosya && !fotografIsleniyor && <p className="text-xs text-slate-500">Hazır: {(dosya.size / 1024).toFixed(0)} KB · WebP</p>}

      <input className={kutu} placeholder="İsim (isteğe bağlı)" maxLength={40} value={ad} onChange={(e) => setAd(e.target.value)} />
      <input className={kutu} placeholder="Kullanıcı adı (zorunlu)" maxLength={20} value={takmaAd} onChange={(e) => setTakmaAd(e.target.value)} />
      <textarea className={`${kutu} xl:col-span-2`} rows={3} maxLength={200} placeholder="Biyografi (en fazla 200 karakter)" value={bio} onChange={(e) => setBio(e.target.value)} />

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
            <label className="flex items-start gap-3 text-sm leading-5 text-slate-300">
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

      <button onClick={kaydet} disabled={kaydediliyor || fotografIsleniyor} className="rounded-full bg-cyan-700 px-4 py-3 font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50 xl:col-span-2">
        {fotografIsleniyor ? "Fotoğraf hazırlanıyor..." : kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
      </button>
      <button onClick={simdilikGec} className="justify-self-center py-2 text-sm text-slate-400 underline underline-offset-4 hover:text-slate-200 xl:col-span-2">
        Şimdilik geç
      </button>
      {mesaj && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm leading-5 text-rose-200 xl:col-span-2">{mesaj}</p>}
    </main>
  );
}
