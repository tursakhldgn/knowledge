"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { cihazKimliginiSakla, yeniDmKimligiOlustur } from "@/lib/dm-encryption";

const SIMDIKI_YIL = new Date().getFullYear();
const CIHAZ_KAYIT_ANAHTARI = "knowledge-cihaz-kaydi-v1";

const benefitBadges = [
  "Gerçek sorular",
  "Açık anlatımlar",
  "Günlük pratik",
];

export default function Giris() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [dmKurtarmaParolasi, setDmKurtarmaParolasi] = useState("");
  const [dmKurtarmaParolasiTekrar, setDmKurtarmaParolasiTekrar] = useState("");
  const [dogumYili, setDogumYili] = useState("");
  const [onay, setOnay] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const [epostaOnerileri, setEpostaOnerileri] = useState<string[]>([]);
  const [aktifSekme, setAktifSekme] = useState<"giris" | "kayit">("giris");
  const [kayitIsleniyor, setKayitIsleniyor] = useState(false);

  function epostaOnerileriniHazirla(adres: string) {
    const [kullanici, alan] = adres.trim().toLowerCase().split("@");
    if (!kullanici || !alan) return [];
    const kok = kullanici.replace(/[+._-]?\d+$/, "");
    return [1, 2, 3].map((sira) => `${kok || kullanici}${sira}@${alan}`);
  }

  async function kayitOl() {
    if (kayitIsleniyor) return;
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
    try {
      if (localStorage.getItem(CIHAZ_KAYIT_ANAHTARI)) {
        setMesaj("Bu cihazdan daha önce hesap oluşturulmuş. Mevcut hesabına giriş yapabilirsin.");
        return;
      }
    } catch {
      setMesaj("Bu tarayıcı cihaz kayıt bilgisini saklayamıyor. Gizli modu kapatıp tekrar dene.");
      return;
    }
    if (dmKurtarmaParolasi.length < 12) {
      setMesaj("DM kurtarma parolası en az 12 karakter olmalı.");
      return;
    }
    if (dmKurtarmaParolasi !== dmKurtarmaParolasiTekrar) {
      setMesaj("DM kurtarma parolaları aynı değil.");
      return;
    }

    // Fast UI check; the database trigger remains the authoritative, race-safe limit.
    setKayitIsleniyor(true);
    const { data: kayitAcik, error: kapasiteHata } = await supabase.rpc("erken_erisim_acik_mi");
    if (kapasiteHata) {
      setMesaj("Erken erişim durumu kontrol edilemedi. Biraz sonra tekrar dene.");
      setKayitIsleniyor(false);
      return;
    }
    if (!kayitAcik) {
      setMesaj("100 kişilik erken erişim kontenjanı doldu. İlgin için teşekkürler!");
      setKayitIsleniyor(false);
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
      const tekrarKullanildi = /already registered|already exists|user already|email.*(taken|registered|exists)/i.test(error.message);
      if (tekrarKullanildi) {
        setEpostaOnerileri(epostaOnerileriniHazirla(email));
        setMesaj("Bu e-posta daha önce kullanılmış, başka bir e-posta adı dene. Şunları deneyebilirsin:");
      } else {
        setMesaj(halaAcik === false
          ? "100 kişilik erken erişim kontenjanı doldu. İlgin için teşekkürler!"
          : error.message);
      }
      setKayitIsleniyor(false);
      return;
    }
    if (data.user && data.user.identities?.length === 0) {
      setEpostaOnerileri(epostaOnerileriniHazirla(email));
      setMesaj("Bu e-posta daha önce kullanılmış, başka bir e-posta adı dene. Şunları deneyebilirsin:");
      setKayitIsleniyor(false);
      return;
    }
    if (data.user) {
      try {
        localStorage.setItem(CIHAZ_KAYIT_ANAHTARI, data.user.id);
      } catch {
        setMesaj("Hesap açıldı ancak bu tarayıcı cihaz kayıt bilgisini saklayamadı. Başka hesap açmamak için bu cihazda kayıt sekmesini kullanma.");
      }
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
        setKayitIsleniyor(false);
        return;
      }

      try {
        const { kimlik, yedek } = await yeniDmKimligiOlustur(dmKurtarmaParolasi);
        const { error: anahtarHata } = await supabase.rpc("dm_anahtar_kur", {
          p_acik_anahtar: kimlik.publicKey,
          p_tuz: yedek.salt,
          p_iv: yedek.iv,
          p_sifreli_ozel_anahtar: yedek.encryptedPrivateKey,
        });
        if (anahtarHata) throw anahtarHata;
        await cihazKimliginiSakla(data.user.id, kimlik);
      } catch {
        setMesaj("Hesabın oluşturuldu ama DM şifrelemesi bu tarayıcıda kurulamadı. Profilini tamamladıktan sonra Mesajlar sayfasından kurtarma parolanla bir kez kurabilirsin.");
        setKayitIsleniyor(false);
        return;
      }

      setKayitIsleniyor(false);
      router.push("/profil");
    } else {
      setMesaj("Kayıt oldun! E-postanı onayla, sonra giriş yap. E-posta onayı açık olduğunda DM şifreleme anahtarı ilk girişte bir kez kurulur.");
      setKayitIsleniyor(false);
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
          <div className="relative mt-8 space-y-4 text-sm text-slate-300">
            <div className="flex flex-wrap gap-2">
              {benefitBadges.map((badge) => (
                <span key={badge} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">
                  {badge}
                </span>
              ))}
            </div>
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
          {kayitModu && <p className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 text-xs leading-5 text-cyan-100/80">Erken erişim 100 kişiyle sınırlı. Kayıt için gerçek bir e-posta adresi gerekmez; giriş bilgilerini unutma. Bu cihazdan yalnızca bir hesap oluşturulabilir, mevcut hesaplara giriş yapabilirsin.</p>}

          <div className="mt-7 grid grid-cols-2 rounded-xl border border-white/10 bg-slate-950/60 p-1" role="tablist" aria-label="Giriş veya kayıt seç">
            <button type="button" role="tab" aria-selected={!kayitModu} onClick={() => { setAktifSekme("giris"); setMesaj(""); }} className={!kayitModu ? "rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white shadow" : "rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:text-white"}>Giriş yap</button>
            <button type="button" role="tab" aria-selected={kayitModu} onClick={() => { setAktifSekme("kayit"); setMesaj(""); }} className={kayitModu ? "rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white shadow" : "rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:text-white"}>Kayıt ol</button>
          </div>

          <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (kayitModu) void kayitOl(); else void girisYap(); }}>
            <label className="text-sm font-medium text-slate-300">E-posta
              <input className={kutu + " mt-1.5"} type="email" autoComplete="email" placeholder="ornek@eposta.com" value={email} onChange={(e) => { setEmail(e.target.value); setEpostaOnerileri([]); setMesaj(""); }} required />
            </label>
            <label className="text-sm font-medium text-slate-300">Şifre
              <input className={kutu + " mt-1.5"} type="password" autoComplete={kayitModu ? "new-password" : "current-password"} placeholder="En az 6 karakter" minLength={6} value={sifre} onChange={(e) => setSifre(e.target.value)} required />
            </label>

            {kayitModu && <>
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3">
                <p className="text-sm font-semibold text-cyan-100">Uçtan uca DM güvenliği</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Bu parola DM anahtarını korur; Knowledge bunu kaydetmez. Yeni bir cihazda eski mesajlarını açmak için gerekebilir.</p>
                <label className="mt-3 block text-sm font-medium text-slate-300">DM kurtarma parolası
                  <input className={kutu + " mt-1.5"} type="password" autoComplete="new-password" placeholder="En az 12 karakter" minLength={12} value={dmKurtarmaParolasi} onChange={(e) => setDmKurtarmaParolasi(e.target.value)} required />
                </label>
                <label className="mt-3 block text-sm font-medium text-slate-300">DM kurtarma parolasını tekrar gir
                  <input className={kutu + " mt-1.5"} type="password" autoComplete="new-password" placeholder="Parolanı tekrar yaz" minLength={12} value={dmKurtarmaParolasiTekrar} onChange={(e) => setDmKurtarmaParolasiTekrar(e.target.value)} required />
                </label>
              </div>
              <label className="text-sm font-medium text-slate-300">Doğum yılı
                <input className={kutu + " mt-1.5"} type="number" min="1900" max={SIMDIKI_YIL - 15} placeholder="Örn. 2005" value={dogumYili} onChange={(e) => setDogumYili(e.target.value)} required />
              </label>
              <label className="flex items-start gap-3 text-sm leading-5 text-slate-400">
                <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-300" />
                15 yaşından büyük olduğumu onaylıyorum.
              </label>
            </>}

            <button type="submit" disabled={kayitIsleniyor} className="mt-1 rounded-xl bg-cyan-300 px-4 py-3.5 font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">
              {kayitModu ? (kayitIsleniyor ? "Hesap ve güvenlik hazırlanıyor…" : "Hesap oluştur") : "Giriş yap"} <span aria-hidden="true">✦</span>
            </button>
          </form>

          {mesaj && <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm leading-5 text-rose-200">{mesaj}</p>}
          {epostaOnerileri.length > 0 && <div className="mt-2 flex flex-wrap gap-2" aria-label="E-posta önerileri">
            {epostaOnerileri.map((oneri) => <button key={oneri} type="button" onClick={() => { setEmail(oneri); setEpostaOnerileri([]); setMesaj(""); }} className="rounded-full border border-cyan-300/30 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-300/10">{oneri}</button>)}
          </div>}

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: "24/7 akış", text: "Tekrar tekrar bakabileceğin soru ve cevaplar." },
              { label: "Gerçek yardım", text: "Ders anlatımı yerine anlaşılır adım adım çözüm." },
              { label: "Topluluk", text: "Sadece dinlemek değil, katkı vermek de var." },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">{item.label}</p>
                <p className="mt-2 text-sm leading-5 text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">Devam ederek topluluk kurallarına ve güvenli kullanım ilkelerine uymayı kabul edersin.</p>
        </section>
      </div>
    </main>
  );
}
