"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Menu() {
  const pathname = usePathname();
  const [girisVar, setGirisVar] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setGirisVar(!!data.user));
    const { data: dinleyici } = supabase.auth.onAuthStateChange(
      (_olay, oturum) => setGirisVar(!!oturum?.user)
    );
    return () => dinleyici.subscription.unsubscribe();
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-4 py-3 text-slate-100 backdrop-blur-xl sm:px-6">
        <Link href="/" className="font-bold tracking-tight">Knowledge</Link>
        {!girisVar && (
          <Link href="/giris" className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
            Giriş / Kayıt
          </Link>
        )}
      </header>

      {girisVar && (
        <nav aria-label="Ana menü" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] text-slate-300 shadow-[0_-12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="mx-auto grid max-w-lg grid-cols-4 px-2 pt-2">
            {[
              { href: "/sorular", label: "Ana sayfa", icon: "home" },
              { href: "/mesajlar", label: "DM", icon: "chat" },
              { href: "/siralama", label: "Sıralama", icon: "rank" },
              { href: "/profil", label: "Profil", icon: "profile" },
            ].map((item) => {
              const aktif = pathname === item.href || (item.href !== "/sorular" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 pb-2 text-[11px] font-medium transition ${aktif ? "text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    {item.icon === "home" && <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>}
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
