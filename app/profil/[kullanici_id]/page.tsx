import { Suspense } from "react";
import ProfilRotasi from "./ProfilRotasi";

export default function KullaniciProfili({
  params,
}: {
  params: Promise<{ kullanici_id: string }>;
}) {
  return (
    <Suspense fallback={<main data-app-theme="light" className="mx-auto min-h-dvh w-full max-w-6xl px-4 pt-10 text-center text-slate-400">Profil yükleniyor…</main>}>
      <ProfilRotasi params={params} />
    </Suspense>
  );
}
