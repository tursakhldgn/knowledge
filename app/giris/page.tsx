"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SIMDIKI_YIL = new Date().getFullYear();

export default function Giris() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [dogumYili, setDogumYili] = useState("");
  const [onay, setOnay] = useState(false);
  const [mesaj, setMesaj] = useState("");

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

    const { data, error } = await supabase.auth.signUp({
      email,
      password: sifre,
    });
    if (error) {
      setMesaj(error.message);
      return;
    }
    if (data.session) {
      const { error: profilHata } = await supabase
        .from("profiller")
        .insert({ dogum_yili: yil, yas_onayi: true });
      if (profilHata) {
        setMesaj("Profil kaydedilemedi: " + profilHata.message);
        return;
      }
      router.push("/sorular");
    } else {
      setMesaj("Kayıt oldun! E-postanı onayla, sonra giriş yap.");
    }
  }

  async function girisYap() {
    setMesaj("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: sifre,
    });
    if (error) {
      setMesaj(error.message);
      return;
    }
    router.push("/sorular");
  }

  const kutu =
    "w-72 rounded border border-gray-400 bg-white p-2 text-black placeholder-gray-500";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-3xl font-bold">Giriş / Kayıt</h1>
      <input
        className={kutu}
        placeholder="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className={kutu}
        type="password"
        placeholder="Şifre (en az 6 karakter)"
        value={sifre}
        onChange={(e) => setSifre(e.target.value)}
      />
      <input
        className={kutu}
        type="number"
        placeholder="Doğum yılın (sadece kayıtta)"
        value={dogumYili}
        onChange={(e) => setDogumYili(e.target.value)}
      />
      <label className="flex w-72 items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={onay}
          onChange={(e) => setOnay(e.target.checked)}
          className="mt-1"
        />
        15 yaşından büyük olduğumu onaylıyorum (sadece kayıt için).
      </label>
      <div className="flex gap-2">
        <button
          onClick={girisYap}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Giriş yap
        </button>
        <button
          onClick={kayitOl}
          className="rounded bg-gray-600 px-4 py-2 text-white"
        >
          Kayıt ol
        </button>
      </div>
      {mesaj && <p className="max-w-72 text-center">{mesaj}</p>}
    </main>
  );
}