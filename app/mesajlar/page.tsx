"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  cihazKimliginiOku,
  cihazKimliginiSakla,
  dmAnahtarParmakIzi,
  dmKimliginiKurtar,
  dmMesajiniCoz,
  dmMesajiniSifrele,
  MESSAGE_PREFIX,
  yeniDmKimligiOlustur,
} from "@/lib/dm-encryption";
import type { DmIdentity, DmKeyBackup } from "@/lib/dm-encryption";

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
  sifreli?: boolean;
};

type EngelDurumu = "yok" | "ben_engelledim" | "beni_engelledi";

async function mesajlariCoz(mesajlar: Mesaj[], benimId: string, karsiId: string, kimlik: DmIdentity | null, karsiAnahtar: string) {
  return Promise.all(mesajlar.map(async (mesaj) => {
    if (!mesaj.icerik.startsWith(MESSAGE_PREFIX)) return { ...mesaj, sifreli: false };
    if (!kimlik || !karsiAnahtar) return { ...mesaj, icerik: "Şifreli mesaj · bu cihazda açılamıyor", sifreli: true };
    try {
      const cozulmus = await dmMesajiniCoz(mesaj.icerik, benimId, karsiId, kimlik, karsiAnahtar);
      return { ...mesaj, icerik: cozulmus.content, sifreli: cozulmus.encrypted };
    } catch {
      return { ...mesaj, icerik: "Şifre çözülemedi · kurtarma parolanı kontrol et", sifreli: true };
    }
  }));
}

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
  const [engelDurumu, setEngelDurumu] = useState<EngelDurumu>("yok");
  const [engelSistemiHazir, setEngelSistemiHazir] = useState(true);
  const [engelGuncelleniyor, setEngelGuncelleniyor] = useState(false);
  const [sikayetMesajiId, setSikayetMesajiId] = useState("");
  const [sikayetNedeni, setSikayetNedeni] = useState("spam");
  const [sikayetAciklama, setSikayetAciklama] = useState("");
  const [sikayetGonderiliyor, setSikayetGonderiliyor] = useState(false);
  const [sikayetBilgisi, setSikayetBilgisi] = useState("");
  const [sifrelemeDurumu, setSifrelemeDurumu] = useState<"yukleniyor" | "kurulum" | "kilitli" | "hazir" | "hata">("yukleniyor");
  const [sifrelemeHatasi, setSifrelemeHatasi] = useState("");
  const [sifrelemeParolasi, setSifrelemeParolasi] = useState("");
  const [sifrelemeParolasiTekrar, setSifrelemeParolasiTekrar] = useState("");
  const [sifrelemeIslemi, setSifrelemeIslemi] = useState(false);
  const [karsiAnahtar, setKarsiAnahtar] = useState("");
  const [karsiParmakIzi, setKarsiParmakIzi] = useState("");
  const [hata, setHata] = useState("");
  const mesajSonu = useRef<HTMLDivElement>(null);
  const aktifSohbetRef = useRef("");
  const urlSohbetiAcildi = useRef(false);
  const dmKimligiRef = useRef<DmIdentity | null>(null);
  const karsiAnahtarRef = useRef("");

  useEffect(() => {
    let aktif = true;
    if (!karsiAnahtar) {
      setKarsiParmakIzi("");
      return;
    }
    void dmAnahtarParmakIzi(karsiAnahtar).then((fingerprint) => {
      if (aktif) setKarsiParmakIzi(fingerprint);
    }).catch(() => {
      if (aktif) setKarsiParmakIzi("");
    });
    return () => { aktif = false; };
  }, [karsiAnahtar]);

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

  const sifrelemeAnahtarlariniYukle = useCallback(async (uid: string) => {
    setSifrelemeDurumu("yukleniyor");
    setSifrelemeHatasi("");
    try {
      const [publicResult, backupResult] = await Promise.all([
        supabase.from("dm_acik_anahtarlar").select("acik_anahtar").eq("kullanici_id", uid).maybeSingle(),
        supabase.from("dm_anahtar_yedekleri").select("tuz, iv, sifreli_ozel_anahtar").eq("kullanici_id", uid).maybeSingle(),
      ]);
      if (publicResult.error || backupResult.error) throw new Error("Uçtan uca şifreleme için yeni Supabase SQL dosyasını çalıştır.");
      if (!publicResult.data && !backupResult.data) {
        dmKimligiRef.current = null;
        setSifrelemeDurumu("kurulum");
        return;
      }
      if (!publicResult.data || !backupResult.data) throw new Error("Şifreleme anahtarı kaydı eksik. Destek için site yöneticisine bildir.");

      const localIdentity = await cihazKimliginiOku(uid);
      if (localIdentity?.publicKey === publicResult.data.acik_anahtar) {
        dmKimligiRef.current = localIdentity;
        setSifrelemeDurumu("hazir");
      } else {
        dmKimligiRef.current = null;
        setSifrelemeDurumu("kilitli");
      }
    } catch (error) {
      dmKimligiRef.current = null;
      setSifrelemeDurumu("hata");
      setSifrelemeHatasi(error instanceof Error ? error.message : "Şifreleme anahtarı yüklenemedi.");
    }
  }, []);

  async function sifrelemeyiKur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!benimId || sifrelemeIslemi) return;
    if (sifrelemeParolasi.length < 12) {
      setSifrelemeHatasi("Kurtarma parolası en az 12 karakter olmalı.");
      return;
    }
    if (sifrelemeParolasi !== sifrelemeParolasiTekrar) {
      setSifrelemeHatasi("İki parola eşleşmiyor.");
      return;
    }
    setSifrelemeIslemi(true);
    setSifrelemeHatasi("");
    try {
      const { kimlik, yedek } = await yeniDmKimligiOlustur(sifrelemeParolasi);
      const { error } = await supabase.rpc("dm_anahtar_kur", {
        p_acik_anahtar: kimlik.publicKey,
        p_tuz: yedek.salt,
        p_iv: yedek.iv,
        p_sifreli_ozel_anahtar: yedek.encryptedPrivateKey,
      });
      if (error) throw new Error(error.code === "23505"
        ? "Bu hesapta bir şifreleme anahtarı zaten var. Kurtarma parolanla açmayı dene."
        : "Şifreleme anahtarı kaydedilemedi. SQL ayarını kontrol et.");
      dmKimligiRef.current = kimlik;
      try {
        await cihazKimliginiSakla(benimId, kimlik);
      } catch {
        setSifrelemeHatasi("Anahtar bu tarayıcıda saklanamadı. Bu cihazda her açışında kurtarma parolan gerekecek.");
      }
      setSifrelemeDurumu("hazir");
      setSifrelemeParolasi("");
      setSifrelemeParolasiTekrar("");
    } catch (error) {
      setSifrelemeHatasi(error instanceof Error ? error.message : "Şifreleme kurulamadı.");
    } finally {
      setSifrelemeIslemi(false);
    }
  }

  async function sifrelemeKilidiniAc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!benimId || sifrelemeIslemi) return;
    setSifrelemeIslemi(true);
    setSifrelemeHatasi("");
    try {
      const [publicResult, backupResult] = await Promise.all([
        supabase.from("dm_acik_anahtarlar").select("acik_anahtar").eq("kullanici_id", benimId).single(),
        supabase.from("dm_anahtar_yedekleri").select("tuz, iv, sifreli_ozel_anahtar").eq("kullanici_id", benimId).single(),
      ]);
      if (publicResult.error || backupResult.error || !publicResult.data || !backupResult.data) {
        throw new Error("Şifreleme anahtarı yedeği bulunamadı. Supabase SQL ayarını kontrol et.");
      }
      const backup: DmKeyBackup = {
        salt: backupResult.data.tuz,
        iv: backupResult.data.iv,
        encryptedPrivateKey: backupResult.data.sifreli_ozel_anahtar,
      };
      const kimlik = await dmKimliginiKurtar(sifrelemeParolasi, backup);
      if (kimlik.publicKey !== publicResult.data.acik_anahtar) {
        throw new Error("Bu hesapla uyuşan şifreleme anahtarı açılamadı.");
      }
      dmKimligiRef.current = kimlik;
      try {
        await cihazKimliginiSakla(benimId, kimlik);
      } catch {
        setSifrelemeHatasi("Anahtar bu tarayıcıda saklanamadı; şimdilik bu sayfa açıkken mesajlaşabilirsin.");
      }
      setSifrelemeDurumu("hazir");
      setSifrelemeParolasi("");
    } catch {
      setSifrelemeHatasi("Kurtarma parolası yanlış olabilir veya anahtar yedeği açılamadı.");
    } finally {
      setSifrelemeIslemi(false);
    }
  }

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
      setTumMesajlar((mesajlarSonucu.data ?? []).map((mesaj) =>
        mesaj.icerik.startsWith(MESSAGE_PREFIX)
          ? { ...mesaj, icerik: "", sifreli: true }
          : { ...mesaj, sifreli: false }
      ));
      setHata("");
      setYukleniyor(false);
    }

    async function sohbetMesajlariniGetir(uid: string, digerId: string) {
      const { data: engel, error: engelHatasi } = await supabase.rpc("dm_engel_durumu", {
        p_kullanici_id: digerId,
      });
      if (!aktif || aktifSohbetRef.current !== digerId) return;
      if (!engelHatasi) {
        setEngelSistemiHazir(true);
        setEngelDurumu(engel as EngelDurumu);
        if (engel !== "yok") {
          setAktifMesajlar([]);
          return;
        }
      } else {
        setEngelSistemiHazir(false);
      }
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
      setAktifMesajlar(await mesajlariCoz(data ?? [], uid, digerId, dmKimligiRef.current, karsiAnahtarRef.current));
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
      await sifrelemeAnahtarlariniYukle(kullaniciId);
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
  }, [router, okunmayanlariIsaretle, sifrelemeAnahtarlariniYukle]);

  useEffect(() => {
    mesajSonu.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aktifMesajlar]);

  const sohbetAc = useCallback(async (kisi: Kisi) => {
    setSecilenId(kisi.kullanici_id);
    aktifSohbetRef.current = kisi.kullanici_id;
    setArama("");
    setHata("");
    setSikayetBilgisi("");
    setAktifMesajlar([]);
    setEngelDurumu("yok");
    setKarsiAnahtar("");
    karsiAnahtarRef.current = "";
    setEngelGuncelleniyor(true);
    const { data: engel, error: engelHatasi } = await supabase.rpc("dm_engel_durumu", {
      p_kullanici_id: kisi.kullanici_id,
    });
    setEngelGuncelleniyor(false);
    if (aktifSohbetRef.current !== kisi.kullanici_id) return;
    if (engelHatasi) {
      setEngelSistemiHazir(false);
    } else {
      setEngelSistemiHazir(true);
      setEngelDurumu(engel as EngelDurumu);
      if (engel !== "yok") return;
    }
    const { data: publicKeyData, error: publicKeyError } = await supabase
      .from("dm_acik_anahtarlar")
      .select("acik_anahtar")
      .eq("kullanici_id", kisi.kullanici_id)
      .maybeSingle();
    if (aktifSohbetRef.current !== kisi.kullanici_id) return;
    if (publicKeyError) {
      setKarsiAnahtar("");
      karsiAnahtarRef.current = "";
      setSifrelemeHatasi("Şifreleme anahtarları yüklenemedi. Supabase SQL ayarını kontrol et.");
    } else {
      const publicKey = publicKeyData?.acik_anahtar ?? "";
      setKarsiAnahtar(publicKey);
      karsiAnahtarRef.current = publicKey;
    }
    const { data, error: mesajHatasi } = await supabase
      .from("mesajlar")
      .select("id, gonderen_id, alici_id, icerik, olusturma_tarihi, okundu_at")
      .or(`and(gonderen_id.eq.${benimId},alici_id.eq.${kisi.kullanici_id}),and(gonderen_id.eq.${kisi.kullanici_id},alici_id.eq.${benimId})`)
      .order("olusturma_tarihi", { ascending: true })
      .limit(200);
    if (aktifSohbetRef.current !== kisi.kullanici_id) return;
    if (mesajHatasi) setHata("Sohbet açılamadı. Mesajlar tablosu ayarını kontrol et.");
    else {
      setAktifMesajlar(await mesajlariCoz(data ?? [], benimId, kisi.kullanici_id, dmKimligiRef.current, karsiAnahtarRef.current));
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
    if (!secilenKisi || !taslak.trim() || gonderiliyor || engelGuncelleniyor || engelDurumu !== "yok") return;
    if (sifrelemeDurumu !== "hazir" || !dmKimligiRef.current) {
      setHata("Mesaj göndermeden önce uçtan uca şifrelemeyi kur veya kurtarma parolanla aç.");
      return;
    }
    if (!karsiAnahtarRef.current) {
      setHata("Bu kullanıcı henüz şifreli mesajlaşmayı etkinleştirmemiş.");
      return;
    }
    setGonderiliyor(true);
    setHata("");
    const icerik = taslak.trim();
    let sifreliIcerik: string;
    try {
      sifreliIcerik = await dmMesajiniSifrele(
        icerik,
        benimId,
        secilenKisi.kullanici_id,
        dmKimligiRef.current,
        karsiAnahtarRef.current
      );
    } catch {
      setGonderiliyor(false);
      setHata("Mesaj cihazında şifrelenemedi. Sayfayı yenileyip tekrar dene.");
      return;
    }
    const { error: gondermeHatasi } = await supabase.from("mesajlar").insert({
      gonderen_id: benimId,
      alici_id: secilenKisi.kullanici_id,
      icerik: sifreliIcerik,
    });
    setGonderiliyor(false);
    if (gondermeHatasi) {
      const { data: guncelEngel, error: engelHatasi } = await supabase.rpc("dm_engel_durumu", {
        p_kullanici_id: secilenKisi.kullanici_id,
      });
      if (!engelHatasi) {
        setEngelSistemiHazir(true);
        setEngelDurumu(guncelEngel as EngelDurumu);
        if (guncelEngel !== "yok") setAktifMesajlar([]);
      }
      setHata("Mesaj gönderilemedi. Kullanıcı seni engellemiş olabilir; sohbeti yeniden açıp kontrol et.");
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
    setAktifMesajlar(await mesajlariCoz(data ?? [], benimId, secilenKisi.kullanici_id, dmKimligiRef.current, karsiAnahtarRef.current));
    setTumMesajlar((eski) => [
      {
        id: crypto.randomUUID(),
        gonderen_id: benimId,
        alici_id: secilenKisi.kullanici_id,
        icerik: "",
        olusturma_tarihi: new Date().toISOString(),
        okundu_at: null,
        sifreli: true,
      },
      ...eski,
    ]);
  }

  async function kullaniciyiEngelleVeyaAc() {
    if (!secilenKisi || !benimId || engelGuncelleniyor || !engelSistemiHazir) return;
    setEngelGuncelleniyor(true);
    setHata("");
    setSikayetBilgisi("");
    const engeliKaldir = engelDurumu === "ben_engelledim";
    const sonuc = engeliKaldir
      ? await supabase
          .from("dm_engellemeleri")
          .delete()
          .eq("engelleyen_id", benimId)
          .eq("engellenen_id", secilenKisi.kullanici_id)
      : await supabase.from("dm_engellemeleri").insert({
          engelleyen_id: benimId,
          engellenen_id: secilenKisi.kullanici_id,
        });
    setEngelGuncelleniyor(false);
    if (sonuc.error) {
      setHata("Engelleme işlemi yapılamadı. Supabase güvenlik ayarlarını kontrol et.");
      return;
    }
    if (engeliKaldir) {
      void sohbetAc(secilenKisi);
      return;
    }
    setEngelDurumu("ben_engelledim");
    setAktifMesajlar([]);
    setTaslak("");
    setTumMesajlar((eski) => eski.filter((mesaj) =>
      !(
        (mesaj.gonderen_id === benimId && mesaj.alici_id === secilenKisi.kullanici_id) ||
        (mesaj.gonderen_id === secilenKisi.kullanici_id && mesaj.alici_id === benimId)
      )
    ));
  }

  async function dmSikayetGonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!secilenKisi || !sikayetMesajiId || !benimId || sikayetGonderiliyor) return;
    setSikayetGonderiliyor(true);
    setSikayetBilgisi("");
    const raporlananMesaj = aktifMesajlar.find((mesaj) => mesaj.id === sikayetMesajiId);
    const { error } = await supabase.from("dm_sikayetleri").insert({
      sikayet_eden_id: benimId,
      sikayet_edilen_id: secilenKisi.kullanici_id,
      mesaj_id: sikayetMesajiId,
      mesaj_icerigi: raporlananMesaj?.icerik ?? "",
      neden: sikayetNedeni,
      aciklama: sikayetAciklama.trim() || null,
    });
    setSikayetGonderiliyor(false);
    if (error) {
      setSikayetBilgisi(error.code === "23505"
        ? "Bu mesajı daha önce şikâyet ettin."
        : "Şikâyet gönderilemedi. Supabase SQL ayarının çalıştırıldığını kontrol et.");
      return;
    }
    setSikayetBilgisi("Şikâyetin moderasyon için iletildi.");
    setSikayetAciklama("");
  }

  const zamanYaz = (tarih: string) =>
    new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(tarih));

  return (
    <main data-app-theme="light" className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-screen-2xl flex-col px-3 pt-4 pb-28 text-slate-100 sm:px-6 sm:pt-7 xl:px-8">
      <header className="mb-5 border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Özel sohbetler</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Mesajların</h1>
      </header>

      <section aria-label="Uçtan uca şifreleme" className="mb-5 border-b border-slate-200 px-1 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Uçtan uca mesaj şifrelemesi</h2>
            <p className="mt-1 text-sm text-slate-400">
              {sifrelemeDurumu === "hazir" ? "Bu cihaz şifreli mesaj göndermeye hazır." :
                sifrelemeDurumu === "yukleniyor" ? "Şifreleme anahtarın kontrol ediliyor…" :
                  sifrelemeDurumu === "kurulum" ? "İlk kullanımda kurtarma parolası belirle." :
                    sifrelemeDurumu === "kilitli" ? "Bu cihazda mesajlarını açmak için kurtarma parolanı gir." :
                      "Şifreleme kurulumu tamamlanamadı."}
            </p>
          </div>
          {sifrelemeDurumu === "hazir" && <span className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">Şifreleme açık</span>}
        </div>

        {sifrelemeDurumu === "kurulum" && (
          <form onSubmit={sifrelemeyiKur} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-medium text-slate-300">Kurtarma parolası (en az 12 karakter)
              <input type="password" autoComplete="new-password" required minLength={12} value={sifrelemeParolasi} onChange={(e) => setSifrelemeParolasi(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300" />
            </label>
            <label className="text-xs font-medium text-slate-300">Parolayı tekrar gir
              <input type="password" autoComplete="new-password" required minLength={12} value={sifrelemeParolasiTekrar} onChange={(e) => setSifrelemeParolasiTekrar(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300" />
            </label>
            <button type="submit" disabled={sifrelemeIslemi} className="min-h-11 rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">{sifrelemeIslemi ? "Kuruluyor…" : "Şifrelemeyi kur"}</button>
          </form>
        )}

        {sifrelemeDurumu === "kilitli" && (
          <form onSubmit={sifrelemeKilidiniAc} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-end">
            <label className="text-xs font-medium text-slate-300">Kurtarma parolan
              <input type="password" autoComplete="current-password" required value={sifrelemeParolasi} onChange={(e) => setSifrelemeParolasi(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300" />
            </label>
            <button type="submit" disabled={sifrelemeIslemi || !sifrelemeParolasi} className="min-h-11 rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">{sifrelemeIslemi ? "Açılıyor…" : "Mesajları aç"}</button>
          </form>
        )}

        {sifrelemeDurumu === "hata" && <p role="alert" className="mt-3 text-sm text-rose-300">{sifrelemeHatasi}</p>}
        {sifrelemeHatasi && sifrelemeDurumu !== "hata" && <p role="status" className="mt-3 text-sm text-amber-200">{sifrelemeHatasi}</p>}
        {(sifrelemeDurumu === "kurulum" || sifrelemeDurumu === "hazir") && <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-500">Kurtarma parolanı güvenli bir yere kaydet. Unutursan yeni cihazda eski mesajlarını açamazsın. Mesaj içeriği şifrelenir; hesaplar ve gönderim zamanları gibi bilgiler gizlenmez.</p>}
        {sifrelemeDurumu === "hazir" && <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Sunucu mesaj metnini çözemez. İlk anahtar güvenini doğrulamak için sohbet ettiğin kişiyle parmak izlerini site dışından karşılaştır.</p>}
      </section>

      <section className="grid min-h-[65dvh] flex-1 overflow-hidden border-y border-slate-200 bg-transparent lg:h-[calc(100dvh-15rem)] lg:min-h-[28rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className={`flex min-h-0 flex-col border-b border-slate-200 lg:border-r lg:border-b-0 ${secilenKisi ? "hidden lg:flex" : ""}`}>
          <div className="border-b border-slate-200 px-3 py-4">
            <h2 className="font-semibold">Sohbetler</h2>
            <label className="mt-3 block">
              <span className="sr-only">Kullanıcı adıyla sohbet ara</span>
              <input
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="Kullanıcı adı ara…"
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-cyan-600"
              />
            </label>
          </div>

          <div className="max-h-[26rem] flex-1 overflow-y-auto lg:max-h-none">
            {hata && !secilenKisi && <p role="alert" className="m-2 rounded-xl bg-rose-300/10 p-3 text-xs text-rose-200">{hata}</p>}
            {arama.trim() ? (
              aramaSonuclari.length ? aramaSonuclari.map((kisi) => (
                <button key={kisi.kullanici_id} onClick={() => void sohbetAc(kisi)} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition hover:bg-slate-100">
                  <Avatar kisi={kisi} />
                  <span className="truncate text-sm font-medium">@{kisi.takma_ad}</span>
                </button>
              )) : <p className="px-3 py-5 text-sm text-slate-500">Bu kullanıcı adı bulunamadı.</p>
            ) : sonSohbetler.length ? sonSohbetler.map(({ kisi, mesaj }) => (
              <button key={kisi.kullanici_id} onClick={() => void sohbetAc(kisi)} className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition ${secilenId === kisi.kullanici_id ? "bg-cyan-50" : "hover:bg-slate-100"}`}>
                <Avatar kisi={kisi} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">@{kisi.takma_ad}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{mesaj.sifreli ? "🔒 Şifreli mesaj" : mesaj.icerik}</span>
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
              <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                <button onClick={() => { setSecilenId(""); aktifSohbetRef.current = ""; }} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 md:hidden" aria-label="Sohbet listesine dön">←</button>
                <Avatar kisi={secilenKisi} />
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">@{secilenKisi.takma_ad}</p><p className="text-xs text-slate-500">{sifrelemeDurumu === "hazir" && karsiAnahtar ? "Uçtan uca şifreli sohbet" : "Knowledge üyesi"}</p>{karsiParmakIzi && <p className="mt-1 break-all font-mono text-[9px] leading-4 text-slate-500">Anahtar: {karsiParmakIzi}</p>}</div>
                {engelSistemiHazir && <button
                  type="button"
                  onClick={() => void kullaniciyiEngelleVeyaAc()}
                  disabled={engelGuncelleniyor}
                  className="ml-auto min-h-10 rounded-full border border-rose-300/30 px-3 text-xs font-semibold text-rose-300 transition hover:bg-rose-300/10 disabled:opacity-50"
                >
                  {engelGuncelleniyor ? "…" : engelDurumu === "ben_engelledim" ? "Engeli kaldır" : "Kullanıcıyı engelle"}
                </button>}
              </header>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6">
                {!engelSistemiHazir && <p role="status" className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-xs leading-5 text-amber-100">Engelleme ve şikâyet özelliklerini açmak için yeni Supabase SQL ayarını çalıştır.</p>}
                {engelDurumu === "ben_engelledim" && <p role="status" className="m-auto max-w-sm py-12 text-center text-sm leading-6 text-slate-400">Bu kullanıcıyı engelledin. Engeli kaldırana kadar mesajlar gizlenir ve yeni mesaj gönderilemez.</p>}
                {engelDurumu === "beni_engelledi" && <p role="status" className="m-auto max-w-sm py-12 text-center text-sm leading-6 text-slate-400">Bu kullanıcı mesajlaşmayı engelledi. Yeni mesaj gönderemezsin.</p>}
                {aktifMesajlar.length ? aktifMesajlar.map((mesaj) => {
                  const benimMesajim = mesaj.gonderen_id === benimId;
                  return (
                    <div key={mesaj.id} className={`flex ${benimMesajim ? "justify-end" : "justify-start"}`}>
                      <article className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${benimMesajim ? "rounded-br-md bg-cyan-700 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"}`}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{mesaj.icerik}</p>
                        <p className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${benimMesajim ? "text-slate-700" : "text-slate-500"}`}>
                          {zamanYaz(mesaj.olusturma_tarihi)}
                          {mesaj.sifreli && <span>· Şifreli</span>}
                          {mesaj.sifreli === false && <span>· Eski, şifrelenmemiş mesaj</span>}
                          {benimMesajim && <span>{mesaj.okundu_at ? "· Görüldü" : "· Gönderildi"}</span>}
                          {!benimMesajim && engelSistemiHazir && <button type="button" onClick={() => { setSikayetMesajiId(mesaj.id); setSikayetNedeni("spam"); setSikayetAciklama(""); setSikayetBilgisi(""); }} className="ml-2 underline decoration-rose-300/50 underline-offset-2 hover:text-rose-300">Şikâyet et</button>}
                        </p>
                      </article>
                    </div>
                  );
                }) : engelDurumu === "yok" ? (
                  <div className="m-auto max-w-xs py-12 text-center">
                    <p className="font-medium text-slate-300">Sohbeti başlat</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">İlk mesajını yazıp @{secilenKisi.takma_ad} ile konuşmaya başlayabilirsin.</p>
                  </div>
                ) : null}
                <div ref={mesajSonu} />
              </div>

              {engelDurumu !== "yok" ? (
                <div className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-500">Mesajlaşma şu anda kapalı.</div>
              ) : sifrelemeDurumu === "hazir" && karsiAnahtar ? (
                <form onSubmit={mesajGonder} className="border-t border-slate-200 p-3 sm:p-4">
                  {hata && <p role="alert" className="mb-2 text-xs text-rose-200">{hata}</p>}
                  <div className="flex items-end gap-2">
                    <textarea value={taslak} onChange={(e) => setTaslak(e.target.value)} maxLength={2000} rows={1} placeholder="Mesaj yaz…" className="max-h-32 min-h-11 flex-1 resize-y rounded-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-cyan-700" />
                    <button type="submit" disabled={!taslak.trim() || gonderiliyor || engelGuncelleniyor} className="rounded-full bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">{gonderiliyor ? "…" : "Gönder"}</button>
                  </div>
                </form>
              ) : (
                <div className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-500">
                  {sifrelemeDurumu !== "hazir" ? "Şifreleme anahtarını kurup açmadan mesaj gönderemezsin." : "Bu kullanıcı henüz şifreli mesajlaşmayı etkinleştirmemiş."}
                </div>
              )}
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

      {sikayetMesajiId && secilenKisi && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSikayetMesajiId(""); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="dm-sikayet-baslik" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6">
            <h2 id="dm-sikayet-baslik" className="text-xl font-semibold text-white">Mesajı şikâyet et</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">@{secilenKisi.takma_ad} tarafından gönderilen mesajı neden bildirdiğini seç. Şikâyet edince seçtiğin mesajın içeriği inceleme için moderasyon ekibiyle paylaşılır.</p>
            <form onSubmit={dmSikayetGonder} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                Şikâyet nedeni
                <select value={sikayetNedeni} onChange={(e) => setSikayetNedeni(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400">
                  <option value="spam">Spam veya istenmeyen içerik</option>
                  <option value="taciz">Taciz veya zorbalık</option>
                  <option value="tehdit">Tehdit</option>
                  <option value="uygunsuz">Uygunsuz içerik</option>
                  <option value="diger">Diğer</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Açıklama <span className="font-normal text-slate-500">(isteğe bağlı)</span>
                <textarea value={sikayetAciklama} onChange={(e) => setSikayetAciklama(e.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" placeholder="Kısaca açıklayabilirsin…" />
              </label>
              {sikayetBilgisi && <p role="status" className="text-sm text-cyan-200">{sikayetBilgisi}</p>}
              <div className="flex justify-end gap-2 pt-1">
                {sikayetBilgisi === "Şikâyetin moderasyon için iletildi." ? (
                  <button type="button" onClick={() => setSikayetMesajiId("")} className="min-h-10 rounded-full bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-600">Kapat</button>
                ) : <>
                  <button type="button" onClick={() => setSikayetMesajiId("")} className="min-h-10 rounded-full px-4 text-sm text-slate-300 hover:bg-white/5">Vazgeç</button>
                  <button type="submit" disabled={sikayetGonderiliyor} className="min-h-10 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">{sikayetGonderiliyor ? "Gönderiliyor…" : "Şikâyeti gönder"}</button>
                </>}
              </div>
            </form>
          </section>
        </div>
      )}
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
