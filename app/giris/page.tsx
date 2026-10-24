"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const SIMDIKI_YIL = new Date().getFullYear();

export default function Giris() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [dogumYili, setDogumYili] = useState("");
  const [onay, setOnay] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const [aktifSekme, setAktifSekme] = useState<"giris" | "kayit">("giris");

  async function kayitOl() {
    setMesaj("");
    const yil = Number(dogumYili);
    if (!yil || yil < 1990 || yil > SIMDIKI_YIL) {
      setMesaj("Geçerli bir doğum yılı yaz.");
      return;
    }
    if (SIMDIKI_YIL - yil < 15) {
      setMesaj("Bu uygulama 15 yaş ve üzeri içindir.");
      return;
    }
    if (!onay) {
      setMesaj("15 yaşından büyük olduğunu onaylamalısın.");
      return;
    }

    // Fast UI check; the database trigger remains the authoritative, race-safe limit.
    const { data: kayitAcik, error: kapasiteHata } = await supabase.rpc("erken_erisim_acik_mi");
    if (kapasiteHata) {
      setMesaj("Erken erişim durumu kontrol edilemedi. Biraz sonra tekrar dene.");
      return;
    }
    if (!kayitAcik) {
      setMesaj("100 kişilik erken erişim kontenjanı doldu. İlgin için teşekkürler!");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: sifre,
      options: {
        data: { dogum_yili: yil, yas_onayi: true },
      },
    });
    if (error) {
      // A concurrent signup may take the final slot between the check and signUp.
      const { data: halaAcik } = await supabase.rpc("erken_erisim_acik_mi");
      setMesaj(halaAcik === false
        ? "100 kişilik erken erişim kontenjanı doldu. İlgin için teşekkürler!"
        : error.message);
      return;
    }
    if (data.session && data.user) {
      const { error: profilHata } = await supabase
        .from("profiller")
        .upsert(
          {
            kullanici_id: data.user.id,
            dogum_yili: yil,
            yas_onayi: true,
          },
          { onConflict: "kullanici_id" }
        );
      if (profilHata) {
        setMesaj("Profil kaydedilemedi: " + profilHata.message);
        return;
      }
      router.push("/profil");
    } else {
      setMesaj("Kayıt oldun! E-postanı onayla, sonra giriş yap.");
    }
  }

  async function girisYap() {
    setMesaj("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: sifre,
    });
    if (error) {
      setMesaj(error.message);
      return;
    }

    const { data: profil, error: profilOkumaHata } = await supabase
      .from("profiller")
      .select("kullanici_id")
      .eq("kullanici_id", data.user.id)
      .maybeSingle();

    if (profilOkumaHata) {
      setMesaj("Profil kontrol edilemedi: " + profilOkumaHata.message);
      return;
    }

    if (!profil) {
      const yil = Number(data.user.user_metadata?.dogum_yili);
      if (yil && data.user.user_metadata?.yas_onayi === true) {
        const { error: profilHata } = await supabase.from("profiller").upsert(
          {
            kullanici_id: data.user.id,
            dogum_yili: yil,
            yas_onayi: true,
          },
          { onConflict: "kullanici_id" }
        );

        if (profilHata) {
          setMesaj("Profil oluşturulamadı: " + profilHata.message);
          return;
        }
      }
      router.push("/profil");
      return;
    }

    router.push("/sorular");
  }

  const kutu =
    "w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";
  const kayitModu = aktifSekme === "kayit";

  return (
    <main className="min-h-[calc(100vh-57px)] bg-[radial-gradient(ellipse_at_15%_20%,_rgba(8,145,178,0.16),_transparent_38%),#070b14] px-4 py-8 text-slate-100 sm:px-6 sm:py-14">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30 md:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-950 p-10 md:flex lg:p-12">
          <div className="pointer-events-none absolute -bottom-16 -left-12 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative">
            <Image src="/knowledge-mark.png" alt="Knowledge kuş ve kitap logosu" width={720} height={508} className="h-12 w-16 object-contain" priority />
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Knowledge</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">Öğrenmenin en iyi yolu, birlikte düşünmek.</h1>
            <p className="mt-5 leading-7 text-slate-300">Sorunu sor, anlaşılır yanıtlar al ve bildiklerini paylaşarak başkasına yol göster.</p>
          </div>
          <div className="relative mt-12 space-y-3 text-sm text-slate-300">
            <p className="flex items-center gap-3"><span className="text-cyan-300">✦</span> Merak ettiğin konuyu sor</p>
            <p className="flex items-center gap-3"><span className="text-cyan-300">✦</span> Farklı açıklamalardan öğren</p>
            <p className="flex items-center gap-3"><span className="text-cyan-300">✦</span> Topluluğa katkı ver</p>
          </div>
        </section>

        <section className="p-6 sm:p-9 lg:p-12">
          <div className="mb-8 md:hidden">
            <Image src="/knowledge-mark.png" alt="Knowledge kuş ve kitap logosu" width={720} height={508} className="h-10 w-14 object-contain" priority />
            <p className="mt-3 text-sm font-semibold text-cyan-200">Knowledge</p>
          </div>
          <p className="text-sm font-medium text-cyan-300">Öğrenci topluluğuna hoş geldin</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">{kayitModu ? "Hesabını oluştur" : "Kaldığın yerden devam et"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{kayitModu ? "Ücretsiz katıl, sorularını paylaşmaya başla." : "Sorularına ve topluluğa dönmek için giriş yap."}</p>
          {kayitModu && <p className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 text-xs leading-5 text-cyan-100/80">Erken erişim 100 kişiyle sınırlı. Kontenjan dolunca yeni kayıtlar kapanır.</p>}

          <div className="mt-7 grid grid-cols-2 rounded-xl border border-white/10 bg-slate-950/60 p-1" role="tablist" aria-label="Giriş veya kayıt seç">
            <button type="button" role="tab" aria-selected={!kayitModu} onClick={() => { setAktifSekme("giris"); setMesaj(""); }} className={!kayitModu ? "rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white shadow" : "rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:text-white"}>Giriş yap</button>
            <button type="button" role="tab" aria-selected={kayitModu} onClick={() => { setAktifSekme("kayit"); setMesaj(""); }} className={kayitModu ? "rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white shadow" : "rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:text-white"}>Kayıt ol</button>
          </div>

          <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (kayitModu) void kayitOl(); else void girisYap(); }}>
            <label className="text-sm font-medium text-slate-300">E-posta
              <input className={kutu + " mt-1.5"} type="email" autoComplete="email" placeholder="ornek@eposta.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="text-sm font-medium text-slate-300">Şifre
              <input className={kutu + " mt-1.5"} type="password" autoComplete={kayitModu ? "new-password" : "current-password"} placeholder="En az 6 karakter" minLength={6} value={sifre} onChange={(e) => setSifre(e.target.value)} required />
            </label>

            {kayitModu && <>
              <label className="text-sm font-medium text-slate-300">Doğum yılı
                <input className={kutu + " mt-1.5"} type="number" min="1900" max={SIMDIKI_YIL - 15} placeholder="Örn. 2005" value={dogumYili} onChange={(e) => setDogumYili(e.target.value)} required />
              </label>
              <label className="flex items-start gap-3 text-sm leading-5 text-slate-400">
                <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-300" />
                15 yaşından büyük olduğumu onaylıyorum.
              </label>
            </>}

            <button type="submit" className="mt-1 rounded-xl bg-cyan-300 px-4 py-3.5 font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-200">
              {kayitModu ? "Hesap oluştur" : "Giriş yap"} <span aria-hidden="true">✦</span>
            </button>
          </form>

          {mesaj && <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm leading-5 text-rose-200">{mesaj}</p>}
          <p className="mt-6 text-center text-xs leading-5 text-slate-500">Devam ederek topluluk kurallarına ve güvenli kullanım ilkelerine uymayı kabul edersin.</p>
        </section>
      </div>
    </main>
  );
}
