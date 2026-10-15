"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Menu() {
  const router = useRouter();
  const [girisVar, setGirisVar] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setGirisVar(!!data.user));
    const { data: dinleyici } = supabase.auth.onAuthStateChange(
      (_olay, oturum) => setGirisVar(!!oturum?.user)
    );
    return () => dinleyici.subscription.unsubscribe();
  }, []);

  async function cikisYap() {
    await supabase.auth.signOut();
    router.push("/giris");
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-700 px-6 py-3">
      <Link href="/" className="font-bold">
        Anlat & Öğren
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {girisVar ? (
          <>
            <Link href="/sorular" className="hover:underline">
              Sorular
            </Link>
            <Link href="/profil" className="hover:underline">
              Profil
            </Link>
            <button onClick={cikisYap} className="text-red-400 hover:underline">
              Çıkış yap
            </button>
          </>
        ) : (
          <Link href="/giris" className="hover:underline">
            Giriş / Kayıt
          </Link>
        )}
      </div>
    </nav>
  );
}