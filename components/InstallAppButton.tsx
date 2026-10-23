"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [uygulamaKurulu, setUygulamaKurulu] = useState(false);

  useEffect(() => {
    const kurulumDurumunuKontrolEt = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setUygulamaKurulu(standalone || iosStandalone);
    };
    const yakala = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const kuruldu = () => {
      setInstallPrompt(null);
      setUygulamaKurulu(true);
    };
    kurulumDurumunuKontrolEt();
    const gorunum = window.matchMedia("(display-mode: standalone)");
    gorunum.addEventListener("change", kurulumDurumunuKontrolEt);
    window.addEventListener("beforeinstallprompt", yakala);
    window.addEventListener("appinstalled", kuruldu);
    return () => {
      gorunum.removeEventListener("change", kurulumDurumunuKontrolEt);
      window.removeEventListener("beforeinstallprompt", yakala);
      window.removeEventListener("appinstalled", kuruldu);
    };
  }, []);

  async function yukle() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    window.alert(
      ios
        ? "Knowledge’ı yüklemek için Paylaş düğmesine dokun, ardından Ana Ekrana Ekle’yi seç."
        : "Tarayıcı menüsünü açıp ‘Uygulamayı yükle’ veya ‘Ana ekrana ekle’ seçeneğine dokun."
    );
  }

  if (uygulamaKurulu) return null;

  return (
    <button
      type="button"
      onClick={yukle}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-slate-100 sm:text-sm"
    >
      Uygulamayı yükle
    </button>
  );
}
