"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export default function GeriBildirim() {
  const [kategori, setKategori] = useState("oneri");
  const [mesaj, setMesaj] = useState("");
  const [durum, setDurum] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDurum("");
    setGonderiliyor(true);

    const { data: { user }, error: kullaniciHatasi } = await supabase.auth.getUser();
    if (kullaniciHatasi || !user) {
      setDurum("Geri bildirim göndermek için önce giriş yapmalısın.");
      setGonderiliyor(false);
      return;
    }

    const { error } = await supabase.from("beta_geri_bildirimleri").insert({
      kullanici_id: user.id,
      kategori,
      mesaj: mesaj.trim(),
    });

    setGonderiliyor(false);
    if (error) {
      setDurum(error.message.includes("beta_geri_bildirimleri")
        ? "Geri bildirim sistemi henüz etkinleştirilmemiş. Yönetici Supabase SQL Editor'da erken erişim migration'ını çalıştırmalı."
        : "Gönderilemedi. Lütfen biraz sonra tekrar dene.");
      return;
    }

    setMesaj("");
    setDurum("Teşekkürler! Geri bildirimin Knowledge ekibine ulaştı.");
  }

  const alan = "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

  return (
    <main className="min-h-[calc(100vh-57px)] bg-[radial-gradient(ellipse_at_15%_20%,_rgba(8,145,178,0.12),_transparent_38%),#070b14] px-4 py-8 pb-28 text-slate-100 sm:px-6 sm:py-14">
      <section className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Erken erişim</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Knowledge’ı birlikte geliştirelim</h1>
        <p className="mt-4 leading-7 text-slate-400">Önerini, karşılaştığın bir hatayı veya aklına takılanı yaz. Geri bildirimin hesabınla ilişkilendirilir ve yalnızca sen ile ekip tarafından görüntülenebilir.</p>

        <form onSubmit={gonder} className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-xl shadow-black/20 sm:p-7">
          <label className="block text-sm font-medium text-slate-300">
            Konu
            <select value={kategori} onChange={(e) => setKategori(e.target.value)} className={alan}>
              <option value="oneri">Öneri</option>
              <option value="hata">Hata bildirimi</option>
              <option value="diger">Diğer</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Mesajın
            <textarea value={mesaj} onChange={(e) => setMesaj(e.target.value)} minLength={10} maxLength={1000} required rows={7} placeholder="Neyi geliştirebiliriz? Bir sorun yaşadıysan nasıl tekrarlayabileceğimizi de yaz." className={alan + " resize-y"} />
            <span className="mt-1 block text-right text-xs text-slate-500">{mesaj.length}/1000</span>
          </label>
          <button type="submit" disabled={gonderiliyor || mesaj.trim().length < 10} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
            {gonderiliyor ? "Gönderiliyor…" : "Geri bildirim gönder"}
          </button>
          {durum && <p role="status" className="text-sm leading-6 text-cyan-100">{durum}</p>}
        </form>

        <p className="mt-5 text-sm text-slate-500">Kontenjan veya kayıtla ilgili bir sorun mu var? <Link href="/giris" className="text-cyan-300 underline underline-offset-4">Giriş sayfasına dön</Link>.</p>
      </section>
    </main>
  );
}
