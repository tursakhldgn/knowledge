"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import InstallAppButton from "@/components/InstallAppButton";

export default function Menu() {
  const pathname = usePathname();
  const [kullaniciId, setKullaniciId] = useState("");
  const [okunmamis, setOkunmamis] = useState(0);
  const [soruMenusuAcik, setSoruMenusuAcik] = useState(false);
  const [ayarMenusuAcik, setAyarMenusuAcik] = useState(false);
  const [titretmeIzni, setTitretmeIzni] = useState(false);
  const [ayarSekmesi, setAyarSekmesi] = useState("");
  const [bildirimIzni, setBildirimIzni] = useState("");
  const [gizliProfil, setGizliProfil] = useState(false);
  const [gorunum, setGorunum] = useState(false);
  const [titretmeUyarisi, setTitretmeUyarisi] = useState(false);
  const titretmeUyarisiZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let etkin = true;
    supabase.auth.getUser().then(({ data }) => { if (etkin) setKullaniciId(data.user?.id ?? ""); });
    const { data: dinleyici } = supabase.auth.onAuthStateChange(
      (_olay, oturum) => {
        setKullaniciId(oturum?.user?.id ?? "");
        if (!oturum?.user) setOkunmamis(0);
      }
    );
    return () => {
      etkin = false;
      dinleyici.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!kullaniciId) {
      return;
    }
    let etkin = true;
    const sayiyiGetir = async () => {
      const { count } = await supabase
        .from("bildirimler")
        .select("id", { count: "exact", head: true })
        .is("okundu_at", null);
      if (etkin) setOkunmamis(count ?? 0);
    };
    void sayiyiGetir();
    const kanal = supabase
      .channel(`bildirim-sayaci-${kullaniciId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bildirimler", filter: `alici_id=eq.${kullaniciId}` }, () => {
        void sayiyiGetir();
      })
      .subscribe();
    return () => {
      etkin = false;
      void supabase.removeChannel(kanal);
    };
  }, [kullaniciId]);

  useEffect(() => {
    if (!kullaniciId) return;
    let etkin = true;
    const varlikKanali = supabase.channel("knowledge:dm:presence", {
      config: { private: true, presence: { key: kullaniciId } },
    }).on("presence", { event: "sync" }, () => {
      window.dispatchEvent(new CustomEvent("knowledge:dm-presence-sync", {
        detail: varlikKanali.presenceState(),
      }));
    });
    varlikKanali.subscribe(async (durum) => {
      if (durum === "SUBSCRIBED") {
        await varlikKanali.track({ kullanici_id: kullaniciId, son_gorulme: new Date().toISOString() });
        window.dispatchEvent(new CustomEvent("knowledge:dm-presence-sync", {
          detail: varlikKanali.presenceState(),
        }));
      }
    });

    const titretmeKanali = supabase
      .channel(`dm-titretme-db-${kullaniciId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "dm_titretmeler",
        filter: `alici_id=eq.${kullaniciId}`,
      }, () => {
        if (!etkin) return;
        let cihazTitredi = false;
        try {
          cihazTitredi = typeof navigator !== "undefined"
            && typeof navigator.vibrate === "function"
            && navigator.vibrate([300, 100, 300, 100, 500]);
        } catch {
          cihazTitredi = false;
        }

        if (!cihazTitredi) {
          setTitretmeUyarisi(true);
          if (titretmeUyarisiZamanlayici.current) clearTimeout(titretmeUyarisiZamanlayici.current);
          titretmeUyarisiZamanlayici.current = setTimeout(() => setTitretmeUyarisi(false), 8000);
          try {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Titretildin", { body: "Bir Knowledge Ã¼yesi sana titreÅŸim gÃ¶nderdi." });
            }
          } catch {
            // The in-app alert remains available when system notifications are blocked.
          }
        }
      })
      .subscribe();

    return () => {
      etkin = false;
      void varlikKanali.untrack();
      void supabase.removeChannel(varlikKanali);
      void supabase.removeChannel(titretmeKanali);
      if (titretmeUyarisiZamanlayici.current) clearTimeout(titretmeUyarisiZamanlayici.current);
    };
  }, [kullaniciId]);

  const girisVar = !!kullaniciId;
  const anaSayfa = pathname === "/" || pathname === "/sorular";
  const acikTema = pathname !== "/giris";

  useEffect(() => {
    if (!kullaniciId) return;
    let aktif = true;
    void Promise.all([
      supabase.from("dm_titretme_izinleri").select("etkin").eq("kullanici_id", kullaniciId).maybeSingle(),
      supabase.from("profiller").select("gizli_profil").eq("kullanici_id", kullaniciId).maybeSingle(),
    ]).then(([izin, profil]) => {
      if (!aktif) return;
      setTitretmeIzni(izin.data?.etkin === true);
      setGizliProfil(profil.data?.gizli_profil === true);
      setBildirimIzni("Notification" in window ? Notification.permission : "unsupported");
    });
    return () => { aktif = false; };
  }, [kullaniciId]);

  async function izinGuncelle(etkin: boolean) {
    const onceki = titretmeIzni;
    setTitretmeIzni(etkin);
    if (etkin && "Notification" in window && Notification.permission === "default") {
      setBildirimIzni(await Notification.requestPermission());
    }
    const { error } = await supabase.from("dm_titretme_izinleri").upsert({ kullanici_id: kullaniciId, etkin }, { onConflict: "kullanici_id" });
    if (error) setTitretmeIzni(onceki);
  }

  async function bildirimIzniIste() {
    if (!("Notification" in window)) { setBildirimIzni("unsupported"); return; }
    setBildirimIzni(await Notification.requestPermission());
  }

  return (
    <>
      <header className={`sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl sm:px-6 ${acikTema ? "border-slate-200 bg-white/90 text-slate-800 shadow-sm shadow-slate-900/5" : "border-white/10 bg-slate-950/90 text-slate-100"}`}>
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight" aria-label="Knowledge ana sayfa">
          {pathname === "/giris" ? (
            "Knowledge"
          ) : (
            <>
              <Image
                src="/knowledge-mark.png"
                alt=""
                aria-hidden="true"
                width={720}
                height={508}
                className="h-8 w-11 object-contain sm:h-9 sm:w-12"
                priority
              />
              <span>Knowledge</span>
            </>
          )}
        </Link>
        {girisVar && acikTema && (
          <nav aria-label="MasaÃ¼stÃ¼ menÃ¼sÃ¼" className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50/90 p-1 lg:flex">
            {[
              { href: "/sorular", label: "Ana sayfa" },
              { href: "/kesfet", label: "KeÅŸfet" },
              { href: "/mesajlar", label: "Mesajlar" },
              { href: "/siralama", label: "SÄ±ralama" },
              { href: "/profil", label: "Profil" },
            ].map((item) => {
              const aktif = pathname === item.href || (item.href !== "/sorular" && pathname.startsWith(`${item.href}/`));
              return (
                <Link key={item.href} href={item.href} aria-current={aktif ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${aktif ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="flex items-center gap-3">
        {girisVar && anaSayfa && <div className="relative">
            <button type="button" aria-expanded={soruMenusuAcik} onClick={() => setSoruMenusuAcik((acik) => !acik)} className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-2xl font-normal leading-none text-white transition hover:bg-teal-800" aria-label="OluÅŸtur">+</button>
            {soruMenusuAcik && <div className="absolute right-0 top-12 z-40 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              <Link href="/soru-ekle" onClick={() => setSoruMenusuAcik(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Soru paylaÅŸ</Link>
              <Link href="/geri-bildirim" onClick={() => setSoruMenusuAcik(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Ã–neri gÃ¶nder</Link>
            </div>}
          </div>}
          <InstallAppButton />
          {girisVar && anaSayfa && (
            <Link href="/bildirimler" aria-label={`Bildirimler${okunmamis ? `, ${okunmamis} okunmamÄ±ÅŸ` : ""}`} className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${acikTema ? "text-slate-500 hover:bg-slate-100" : "hover:bg-white/10"} ${pathname === "/bildirimler" ? "text-cyan-700" : acikTema ? "text-slate-500" : "text-slate-300"}`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              {okunmamis > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-5 text-white">{okunmamis > 99 ? "99+" : okunmamis}</span>}
            </Link>
          )}
          {girisVar && pathname === "/profil" && <div className="relative"><button type="button" aria-label="Ayarlar" aria-expanded={ayarMenusuAcik} onClick={() => setAyarMenusuAcik(!ayarMenusuAcik)} className="rounded-xl px-3 py-2 text-xl text-white hover:bg-white/10">?</button>{ayarMenusuAcik && <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-white/10 bg-[#171922] p-4 text-sm shadow-2xl"><h2 className="mb-3 font-bold">Ayarlar</h2>{["Hesap", "Gizlilik", "Bildirimler", "Görünüm"].map(x=><button key={x} onClick={()=>setAyarSekmesi(ayarSekmesi===x?"":x)} className="block w-full border-b border-white/10 py-3 text-left text-slate-200">{x}<span className="float-right">{ayarSekmesi===x?"-":"+"}</span></button>)}{ayarSekmesi==="Hesap"&&<div className="py-3"><Link href="/profil" onClick={()=>setAyarMenusuAcik(false)} className="text-blue-300">Profil bilgilerini düzenle</Link><p className="mt-2 text-slate-400">Kullanýcý adý, biyografi ve fotoðrafýný düzenle.</p></div>}{ayarSekmesi==="Gizlilik"&&<label className="flex items-center justify-between py-3">Profili gizli tut<input type="checkbox" checked={gizliProfil} onChange={e=>{setGizliProfil(e.target.checked);localStorage.setItem("knowledge-gizli-profil",String(e.target.checked));}} /></label>}{ayarSekmesi==="Bildirimler"&&<div className="py-3"><button onClick={()=>void bildirimIzniIste()} className="rounded-lg bg-blue-600 px-3 py-2">Tarayýcý bildirim izni ver</button><p className="mt-2 text-slate-400">Durum: {bildirimIzni||"kontrol ediliyor"}</p><label className="mt-3 flex items-center justify-between">DM titreþim izni<input type="checkbox" checked={titretmeIzni} onChange={e=>void izinGuncelle(e.target.checked)} /></label></div>}{ayarSekmesi==="Görünüm"&&<div className="py-3"><button onClick={()=>{const yeni=!gorunum;setGorunum(yeni);document.documentElement.dataset.contrast=yeni?"high":"normal";localStorage.setItem("knowledge-yuksek-kontrast",String(yeni));}} className="flex w-full items-center justify-between">Yüksek kontrast <input type="checkbox" checked={gorunum} readOnly /></button></div>}<Link href="/profil" onClick={()=>setAyarMenusuAcik(false)} className="mt-3 block text-blue-300">Profili düzenle</Link><button onClick={async()=>{await supabase.auth.signOut();location.href="/giris";}} className="mt-3 block text-orange-400">Çýkýþ yap</button></div>}</div>}
          {!girisVar && (
            <Link href="/giris" className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${acikTema ? "bg-teal-700 text-white hover:bg-teal-800" : "bg-cyan-300 text-slate-950 hover:bg-cyan-200"}`}>
              GiriÅŸ / KayÄ±t
            </Link>
          )}
        </div>
      </header>

      {girisVar && titretmeUyarisi && <div role="status" className="fixed right-4 top-20 z-[60] flex max-w-sm items-center gap-3 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-xl">
        <span aria-hidden="true" className="text-xl">ðŸ“³</span>
        <span className="flex-1">Titretildin Â· Bir Knowledge Ã¼yesi sana titreÅŸim gÃ¶nderdi.</span>
        <button type="button" onClick={() => setTitretmeUyarisi(false)} className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="TitreÅŸim uyarÄ±sÄ±nÄ± kapat">Ã—</button>
      </div>}

      {girisVar && (
        <nav aria-label="Ana menÃ¼" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0d0e12]/95 pb-[env(safe-area-inset-bottom)] text-slate-400 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid max-w-4xl grid-cols-5 px-1 pt-2">
            {[
              { href: "/sorular", label: "Ana sayfa", icon: "home" },
              { href: "/kesfet", label: "KeÅŸfet", icon: "discover" },
              { href: "/mesajlar", label: "DM", icon: "chat" },
              { href: "/siralama", label: "SÄ±ralama", icon: "rank" },
              { href: "/profil", label: "Profil", icon: "profile" },
            ].map((item) => {
              const aktif = pathname === item.href || (item.href !== "/sorular" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 pb-2 text-[11px] font-medium transition ${aktif ? "bg-blue-500/15 text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    {item.icon === "home" && <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>}
                    {item.icon === "discover" && <><circle cx="11" cy="11" r="7" /><path d="m16.2 16.2 4.3 4.3M8.5 13.5l2-5 5-2-2 5-5 2Z" /></>}
                    {item.icon === "chat" && <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>}
                    {item.icon === "rank" && <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" /></>}
                    {item.icon === "profile" && <><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></>}
                  </svg>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}


