"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const yakala = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const kuruldu = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", yakala);
    window.addEventListener("appinstalled", kuruldu);
    return () => {
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

  return (
    <button
      type="button"
      onClick={yukle}
      className="rounded-lg border border-cyan-200/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/10 sm:text-sm"
    >
      Uygulamayı yükle
    </button>
  );
}
